import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createSheet, createRow, fillHourlyTimes, createNextHourlyRow, fieldMinutes, normalizeSheet, validateSheet, MAX_ROWS } from '../callback/sheets/sheet-model.js';
const require = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768';
const OUT = process.env.QA_OUTPUT || '/tmp/presence-hourly-times-qa';
const checks = [], errors = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }
for (const [start, minutes] of [['12:00', 60], ['12:10', 50], ['12:59', 1], ['23:10', 50], ['00:00', 60]]) {
  const sheet = createSheet(); const before = structuredClone(sheet); fillHourlyTimes(sheet.rows, start);
  check(`${start} first interval reaches next hour`, fieldMinutes(sheet.rows[0]) === minutes);
  check(`${start} subsequent intervals are full hours`, sheet.rows.slice(1).every(row => row.time.endsWith(':00') && fieldMinutes(row) === 60));
  check(`${start} normalized schedule is valid`, validateSheet(normalizeSheet(sheet)).valid);
  check(`${start} only time fields change`, sheet.rows.every((row, i) => JSON.stringify({ ...row, time: '', endTime: '' }) === JSON.stringify(before.rows[i])));
}
check('midnight wraps in 24-hour clock', (() => { const rows = Array.from({ length: 3 }, createRow); fillHourlyTimes(rows, '23:10'); return rows[0].endTime === '00:00' && rows[1].time === '00:00' && rows[2].time === '01:00'; })());
check('missing historical endpoint stays unknown', fieldMinutes({ time: '12:10', endTime: '' }) === null);
check('manual end produces actual minutes', fieldMinutes({ time: '12:10', endTime: '12:35' }) === 25);
check('same times mean zero, not invented full day', fieldMinutes({ time: '12:10', endTime: '12:10' }) === 0);
check('invalid start never mutates schedule', (() => { const rows = [createRow()]; const before = JSON.stringify(rows); return !fillHourlyTimes(rows, '99:00') && JSON.stringify(rows) === before; })());
check('append after non-round start uses next round hour', createNextHourlyRow({ time: '13:10' }).time === '14:00');
check('append to empty history stays empty', createNextHourlyRow({ time: '' }).time === '');
check('model respects row ceiling', (() => { const rows = Array.from({ length: MAX_ROWS + 1 }, createRow); fillHourlyTimes(rows, '12:10'); return rows[MAX_ROWS].time === '' && rows[MAX_ROWS - 1].time.endsWith(':00'); })());
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const role of ['member', 'leader', 'admin']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const tag = `${role}-${viewport.width}`, uid = `hourly-${role}`;
    const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block', reducedMotion: 'reduce', acceptDownloads: true });
    let writes = 0, remote = {};
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!/firebasedatabase\.app$|firebaseio\.com$|googleapis\.com$|gstatic\.com$/.test(url.hostname)) return route.continue();
      let body = 'null', contentType = 'application/json', etag = '"synthetic"';
      if (url.pathname.endsWith('firebase-app.js')) { body = 'export const getApp=()=>({});export const initializeApp=()=>({});'; contentType = 'text/javascript'; }
      else if (url.pathname.endsWith('firebase-auth.js')) { body = 'export const browserLocalPersistence={};const user={uid:"hourly-session",getIdToken:async()=>"test-token"};export const getAuth=()=>({currentUser:user,authStateReady:async()=>{}});export const setPersistence=async()=>{};export const signInAnonymously=async()=>({user});export const signOut=async()=>{};'; contentType = 'text/javascript'; }
      else if (url.pathname.startsWith('/callbackSessions/')) body = JSON.stringify({ userUid: uid, accessKey: 'synthetic-only', createdAt: 1 });
      else if (url.pathname.includes('/_paperSheets')) {
        assert.ok(url.pathname.includes(`/${uid}/`), 'only synthetic account is accessed');
        const id = url.pathname.split('/_paperSheets/')[1]?.replace(/\.json$/, '');
        if (request.method() === 'PUT') { writes++; remote[id] = JSON.parse(request.postData()); body = JSON.stringify(remote[id]); }
        else body = JSON.stringify(id ? remote[id] || null : remote);
      }
      await route.fulfill({ status: 200, contentType, body, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag', ETag: etag } });
    });
    await context.addInitScript(({ uid, role }) => { localStorage.setItem('fcos_hub_identity', JSON.stringify({ uid, name: `QA ${role}`, role })); localStorage.setItem('fcos_callback_access_key', 'synthetic-only'); const draw = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...args) { (window.__drawnText ||= []).push({ text: String(text), x, y }); return draw.call(this, text, x, y, ...args); }; }, { uid, role });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(`${tag}: ${e.message}`)); page.on('console', m => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
    await page.goto(`${BASE}/callback/overview/index.html`, { waitUntil: 'networkidle' });
    const legacy = createSheet(new Date('2026-10-08T12:00:00Z')); legacy.id = 'hourly-preserved'; legacy.meta.name = `QA ${role}`; legacy.rows[0].time = '11:45'; legacy.rows[0].contact = 7; legacy.rows[0].stop = 3; legacy.rows[0].presentation = 2; legacy.rows[0].close = 1; legacy.rows[0].donorCases = [{ id: 'donor', donor: true, counts: { contact: 1, stop: 1, presentation: 1, close: 1 }, note: '시간 자동 입력 후에도 보존할 후원자 메모' }]; legacy.review.loa.good = '수치와 회고 보존';
    await page.evaluate(async ({ uid, sheet }) => new Promise((resolve, reject) => { const open = indexedDB.open('presence-paper-sheets-v1', 1); open.onupgradeneeded = () => { const db = open.result, store = db.createObjectStore('records', { keyPath: 'key' }); store.createIndex('namespace', 'namespace'); db.createObjectStore('drafts', { keyPath: 'namespace' }); }; open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ namespace: `user:${uid}`, sheet }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), { uid, sheet: legacy });
    await page.goto(`${BASE}/callback/sheets/index.html?qa=hours1`, { waitUntil: 'networkidle' });
    await page.locator('[data-field="rows.0.time"]').waitFor();
    check(`${tag} opening legacy draft never changes times`, await page.locator('[data-field="rows.0.time"]').inputValue() === '11:45' && await page.locator('[data-field="rows.0.endTime"]').inputValue() === '' && await page.locator('[data-field="rows.1.time"]').inputValue() === '');
    check(`${tag} missing historical duration remains unknown`, await page.locator('[data-field-minutes="0"]').textContent() === '—');
    await page.locator('[data-field="rows.0.time"]').fill('12:00');
    check(`${tag} exact-hour start has 60 minutes`, await page.locator('[data-field-minutes="0"]').textContent() === '60분');
    await page.locator('[data-field="rows.0.time"]').fill('12:59');
    check(`${tag} last-minute start has 1 minute`, await page.locator('[data-field-minutes="0"]').textContent() === '1분');
    await page.locator('[data-field="rows.0.time"]').fill('12:10');
    const times = await page.locator('#time-rows input[type="time"]').evaluateAll(nodes => nodes.map(n => n.value));
    check(`${tag} first input fills ten hourly intervals`, times.length === 20 && times[0] === '12:10' && times[1] === '13:00' && times[2] === '13:00' && times[3] === '14:00' && times[18] === '21:00' && times[19] === '22:00');
    check(`${tag} duration reads 50 then 60 minutes`, await page.locator('[data-field-minutes="0"]').textContent() === '50분' && await page.locator('[data-field-minutes="1"]').textContent() === '60분');
    check(`${tag} existing results and donor note survive`, await page.locator('[data-field="rows.0.contact"]').inputValue() === '7' && await page.locator('[data-field="rows.0.donorCases.0.note"]').inputValue() === legacy.rows[0].donorCases[0].note && await page.locator('[data-field="review.loa.good"]').inputValue() === legacy.review.loa.good);
    await page.locator('[data-field="rows.1.time"]').fill('13:15'); await page.locator('[data-field="rows.1.endTime"]').fill('13:40');
    check(`${tag} manual interval override remains local`, await page.locator('[data-field-minutes="1"]').textContent() === '25분' && await page.locator('[data-field="rows.2.time"]').inputValue() === '14:00');
    await page.locator('#add-row').click();
    check(`${tag} appended row continues at next hour`, await page.locator('[data-field="rows.10.time"]').inputValue() === '22:00' && await page.locator('[data-field-minutes="10"]').textContent() === '60분' && await page.locator('[data-field="rows.1.time"]').inputValue() === '13:15');
    await page.locator('#save-sheet').click(); await page.waitForFunction(() => document.querySelector('#save-status').textContent === '보관함에 저장됨');
    const saved = JSON.parse(remote['hourly-preserved'].sheetJson);
    check(`${tag} explicit save persists schedule without data loss`, writes === 1 && saved.rows[0].time === '12:10' && saved.rows[0].endTime === '13:00' && saved.rows[1].time === '13:15' && saved.rows[1].endTime === '13:40' && saved.rows[0].contact === 7 && saved.review.loa.good === legacy.review.loa.good);
    await page.reload({ waitUntil: 'networkidle' });
    check(`${tag} saved manual times survive reload`, await page.locator('[data-field="rows.1.time"]').inputValue() === '13:15' && await page.locator('[data-field="rows.1.endTime"]').inputValue() === '13:40');
    await page.locator('[data-field="rows.0.time"]').fill('23:10');
    check(`${tag} midnight generates 00:00 and 01:00`, await page.locator('[data-field="rows.0.endTime"]').inputValue() === '00:00' && await page.locator('[data-field="rows.1.time"]').inputValue() === '00:00' && await page.locator('[data-field="rows.2.time"]').inputValue() === '01:00');
    await page.evaluate(() => { window.__drawnText = []; });
    await page.locator('[data-field="rows.0.time"]').fill('12:10');
    await page.waitForFunction(() => window.__drawnText?.some(call => call.text === '50' && call.x === 144));
    check(`${tag} paper slash right side draws actual minutes`, await page.evaluate(() => window.__drawnText.some(call => call.text === '50' && call.x === 144) && window.__drawnText.some(call => call.text === '60' && call.x === 144) && window.__drawnText.some(call => call.text === '13:00' && call.x === 58) && !window.__drawnText.some(call => call.text === '13:15' && call.x === 58)));
    const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, targets: [...document.querySelectorAll('button,input,textarea,a[href]')].filter(el => el.getBoundingClientRect().height).map(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right }; }) }));
    check(`${tag} controls retain 44px without horizontal clipping`, geometry.scroll <= geometry.width + 1 && geometry.targets.every(r => r.width >= 43.5 && r.height >= 43.5 && r.left >= 0 && r.right <= geometry.width + 1));
    check(`${tag} time inputs never overlap delete controls`, await page.locator('.row-header').evaluateAll(headers => headers.every(header => { const inputs = [...header.querySelectorAll('input')].map(input => input.getBoundingClientRect()); const button = header.querySelector('button').getBoundingClientRect(); const separateInputs = inputs[0].right <= inputs[1].left - 7 || inputs[0].bottom <= inputs[1].top - 7; return separateInputs && inputs.every(input => input.right <= button.left - 7 && input.width >= 125); })));
    await page.locator('[data-field="rows.0.time"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${OUT}/hours-${tag}.png` });
    await page.locator('#export-image').click(); await page.locator('#image-dialog').waitFor({ state: 'visible' });
    check(`${tag} PNG export remains available`, await page.locator('#export-preview-image').evaluate(async image => { await image.decode(); return image.naturalWidth > 1000 && image.naturalHeight > 1000; }));
    await page.keyboard.press('Escape');
    check(`${tag} member and leader do not receive admin UI`, role === 'admin' || await page.locator('[data-admin-only],#admin-panel').count() === 0);
    await context.close();
  }
  check('zero browser or console errors', errors.length === 0);
} finally { await browser.close(); await fs.writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, passed: checks.length, checks, errors }, null, 2)); }
console.log(JSON.stringify({ passed: checks.length, errors, output: OUT }));
