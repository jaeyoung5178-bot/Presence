import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createSheet } from '../callback/sheets/sheet-model.js';

const require = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768';
const OUT = process.env.QA_OUTPUT || '/tmp/presence-open-record-qa';
const reproduce = process.env.QA_EXPECT_DELAY === '1';
const checks = [], errors = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
await fs.mkdir(OUT, { recursive: true });
try {
  for (const role of (reproduce ? ['member'] : ['member', 'leader', 'admin'])) for (const viewport of (reproduce ? [{ width: 390, height: 844 }] : [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }])) {
    const tag = `${role}-${viewport.width}`, uid = `open-record-${role}`;
    const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block', reducedMotion: 'reduce', acceptDownloads: true });
    let release, requested = false, hold = true, writes = 0;
    const gate = new Promise(resolve => { release = resolve; });
    let remote = {};
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!/firebasedatabase\.app$|firebaseio\.com$|googleapis\.com$|gstatic\.com$/.test(url.hostname)) return route.continue();
      let body = 'null', contentType = 'application/json', etag = '"synthetic"';
      if (url.pathname.endsWith('firebase-app.js')) { body = 'export const getApp=()=>({});export const initializeApp=()=>({});'; contentType = 'text/javascript'; }
      else if (url.pathname.endsWith('firebase-auth.js')) { body = 'export const browserLocalPersistence={};const user={uid:"open-record-session",getIdToken:async()=>"test-token"};export const getAuth=()=>({currentUser:user,authStateReady:async()=>{}});export const setPersistence=async()=>{};export const signInAnonymously=async()=>({user});export const signOut=async()=>{};'; contentType = 'text/javascript'; }
      else if (url.pathname.startsWith('/callbackSessions/')) body = JSON.stringify({ userUid: uid, accessKey: 'synthetic-only', createdAt: 1 });
      else if (url.pathname.endsWith('/_paperSheetsAnalysisIndex.json')) body = request.method() === 'PUT' ? request.postData() : 'null';
      else if (url.pathname.includes('/_paperSheets')) {
        assert.ok(url.pathname.includes(`/${uid}/`), 'only current synthetic namespace is accessed');
        const id = url.pathname.split('/_paperSheets/')[1]?.replace(/\.json$/, '');
        if (request.method() === 'PUT') { writes++; remote[id] = JSON.parse(request.postData()); body = JSON.stringify(remote[id]); }
        else if (id) { body = JSON.stringify(remote[id] || null); etag = JSON.stringify(remote[id]?.revision || 'null'); }
        else { requested = true; if (hold) await gate; body = JSON.stringify(remote); }
      }
      await route.fulfill({ status: 200, contentType, body, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag', ETag: etag } });
    });
    await context.addInitScript(({ uid, role }) => { localStorage.setItem('fcos_hub_identity', JSON.stringify({ uid, name: `QA ${role}`, role })); localStorage.setItem('fcos_callback_access_key', 'synthetic-only'); }, { uid, role });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${tag}: ${message.text()}`); });
    await page.goto(`${BASE}/callback/overview/index.html`, { waitUntil: 'networkidle' });
    const manual = createSheet(new Date('2024-05-01T12:00:00Z')); manual.id = 'manual-first'; manual.meta.name = `QA ${role}`;
    Object.assign(manual.rows[0], { time: '10:00', contact: 7, stop: 4, presentation: 3, close: 2, rehash: 1, donorCases: [{ id: 'donor-one', donor: true, counts: { contact: 1, stop: 1, presentation: 1, close: 1 }, note: '경청 후 후원에 참여함' }] });
    const next = structuredClone(manual); next.id = 'manual-second'; next.date = '2024-05-02';
    const photo = createSheet(new Date('2024-05-03T12:00:00Z')); photo.id = 'photo-original'; photo.meta.name = `QA ${role}`;
    photo.source = { type: 'photo', imageDataUrl: '', filename: 'synthetic.png', duplicateCount: 0, dateBasis: role === 'leader' ? 'unknown' : 'capture', notes: '합성 시험용 사진', donorCount: 1 };
    photo.review.pitch.bad = '질문 뒤에 상대방의 말을 더 경청하기';
    const seeded = await page.evaluate(async ({ sheets, uid }) => {
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 340; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f8f3e5'; ctx.fillRect(0, 0, 240, 340); ctx.fillStyle = '#292c2a'; ctx.font = '20px sans-serif'; ctx.fillText('합성 콜백싯', 25, 55); sheets[2].source.imageDataUrl = canvas.toDataURL();
      await new Promise((resolve, reject) => { const open = indexedDB.open('presence-paper-sheets-v1', 1); open.onupgradeneeded = () => { const db = open.result, store = db.createObjectStore('records', { keyPath: 'key' }); store.createIndex('namespace', 'namespace'); db.createObjectStore('drafts', { keyPath: 'namespace' }); }; open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction('records', 'readwrite'), namespace = `user:${uid}`; for (const sheet of sheets) tx.objectStore('records').put({ key: namespace + '\0' + sheet.id, namespace, id: sheet.id, pending: false, baseRevision: 'synthetic', document: { version: 1, revision: 'synthetic', deleted: false, updatedAt: sheet.updatedAt, sheet } }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
      return sheets;
    }, { sheets: [manual, next, photo], uid });
    remote = Object.fromEntries(seeded.map(sheet => [sheet.id, { version: 1, revision: 'synthetic', deleted: false, updatedAt: sheet.updatedAt, sheetJson: JSON.stringify(sheet) }]));
    await page.locator('#open-calendar').click();
    await page.locator('[data-calendar-date="2024-05-03"]').waitFor();
    for (let i = 0; i < 100 && !requested; i++) await new Promise(resolve => setTimeout(resolve, 20));
    check(`${tag} archive sync is deliberately pending`, requested && hold);
    await page.locator('[data-calendar-date="2024-05-03"]').click();
    await page.locator('#source-dialog').waitFor({ state: 'visible', timeout: 1500 });
    check(`${tag} original photo opens immediately during sync`, await page.locator('#source-image').evaluate(image => image.complete && image.naturalWidth > 0));
    await page.keyboard.press('Escape');
    await page.locator('[data-calendar-date="2024-05-01"]').click();
    await page.waitForFunction(() => document.querySelector('#sheet-date').value === '2024-05-01');
    if (reproduce) {
      await page.waitForTimeout(500);
      check('reproduced: hydrated manual editor stays hidden behind calendar while sync blocks draft', await page.locator('#archive-dialog').isVisible());
      hold = false; release(); await page.locator('#archive-dialog').waitFor({ state: 'hidden' });
      check('reproduced: calendar closes only after the sync response is released', !await page.locator('#archive-dialog').isVisible());
      await context.close(); continue;
    }
    await page.locator('#archive-dialog').waitFor({ state: 'hidden', timeout: 1500 });
    check(`${tag} manual editor is visible before cloud response`, hold && await page.locator('#editor-panel').isVisible());
    check(`${tag} opening an already saved record does not warn on departure`, await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return !event.defaultPrevented; }));
    await page.locator('[data-field="meta.theme"]').fill('동기화 중에도 수정한 내용');
    await page.waitForTimeout(550);
    check(`${tag} delayed draft does not block typing`, await page.locator('[data-field="meta.theme"]').inputValue() === '동기화 중에도 수정한 내용');
    check(`${tag} new edits warn before departure while draft is queued`, await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }));
    await page.screenshot({ path: `${OUT}/editor-pending-${tag}.png` });
    await page.locator('#open-archive').click();
    await page.locator('[data-calendar-date="2024-05-02"]').click();
    await page.locator('#confirm-dialog').waitFor({ state: 'visible' });
    await page.locator('#confirm-dialog button[value="cancel"]').click();
    check(`${tag} dirty-record cancellation keeps edited record`, await page.locator('#sheet-date').inputValue() === '2024-05-01' && await page.locator('[data-field="meta.theme"]').inputValue() === '동기화 중에도 수정한 내용');
    await page.locator('[data-close-dialog="archive-dialog"]').click();
    hold = false; release();
    await page.waitForFunction(async uid => new Promise(resolve => { const open = indexedDB.open('presence-paper-sheets-v1'); open.onsuccess = () => { const db = open.result, tx = db.transaction('drafts'), request = tx.objectStore('drafts').get(`user:${uid}`); request.onsuccess = () => resolve(request.result?.sheet.meta.theme === '동기화 중에도 수정한 내용'); tx.oncomplete = () => db.close(); }; }), uid);
    check(`${tag} latest edit survives queued opening draft`, await page.locator('[data-field="meta.theme"]').inputValue() === '동기화 중에도 수정한 내용');
    await page.waitForFunction(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return !event.defaultPrevented; });
    check(`${tag} departure warning clears once the latest draft is durable`, await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return !event.defaultPrevented; }));
    await page.locator('#save-sheet').click();
    await page.waitForFunction(() => document.querySelector('#save-status').textContent === '보관함에 저장됨');
    check(`${tag} explicit save keeps same ID and edited content`, writes === 1 && JSON.parse(remote['manual-first'].sheetJson).meta.theme === '동기화 중에도 수정한 내용' && Object.keys(remote).length === 3);
    await page.locator('#export-image').click();
    await page.locator('#image-dialog').waitFor({ state: 'visible' });
    const pixels = await page.locator('#export-preview-image').evaluate(async image => { await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let red = 0, black = 0; for (let i = 0; i < data.length; i += 4) { if (data[i] > 100 && data[i] > data[i+1] * 1.6 && data[i] > data[i+2] * 1.3) red++; if (data[i] < 70 && data[i+1] < 70 && data[i+2] < 70) black++; } return { width: canvas.width, height: canvas.height, red, black }; });
    check(`${tag} full-resolution PNG includes donor red and normal black`, pixels.width >= 2000 && pixels.height > pixels.width && pixels.red > 100 && pixels.black > 100);
    const downloadWait = page.waitForEvent('download'); await page.locator('#image-download').click(); const download = await downloadWait; await download.saveAs(`${OUT}/sheet-${tag}.png`);
    check(`${tag} PNG is downloadable`, (await fs.readFile(`${OUT}/sheet-${tag}.png`)).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    await page.keyboard.press('Escape');
    const tally = await page.evaluate(async () => { const r = await import('./sheet-renderer.js?v=20261009-transcription1'); return { strokes: r.tallyStrokes(5), groups: r.tallyGroups(7) }; });
    check(`${tag} 正 remains five ordered strokes with partial remainder`, tally.strokes.length === 5 && tally.groups.join(',') === '5,2' && tally.strokes[1][0][0] === 11 && tally.strokes[3][0][0] === 3.5);
    const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, targets: [...document.querySelectorAll('.workspace-actions button,.actionbar button,.breadcrumb a')].filter(el => el.getBoundingClientRect().height).map(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right }; }) }));
    check(`${tag} main actions retain 44px and stay in viewport`, geometry.scroll <= geometry.width + 1 && geometry.targets.every(r => r.width >= 43.5 && r.height >= 43.5 && r.left >= 0 && r.right <= geometry.width + 1));
    await page.locator('.breadcrumb a').click(); await page.locator('#open-record-options').click();
    check(`${tag} recording choices preserve both routes`, (await page.locator('#record-auto').getAttribute('href')) === '../index.html' && (await page.locator('#record-manual').getAttribute('href')) === '../sheets/index.html');
    await page.keyboard.press('Escape'); await page.locator('#open-analysis').click();
    await page.locator('#account-status[data-state="connected"]').waitFor();
    check(`${tag} analysis navigation reaches saved records`, (await page.locator('#coverage-title').textContent()).includes('3개의 콜백싯'));
    const basis = role === 'leader' ? '날짜 미확인' : '촬영일 기준';
    check(`${tag} analysis period explains uncertain date counts`, (await page.locator('#coverage-detail').textContent()).includes(`${basis} 1건`) && (await page.locator('#coverage-detail').textContent()).includes('실제 기록일 확인 필요'));
    check(`${tag} review evidence preserves date provenance`, (await page.locator('#pitch-review .quote footer').textContent()).includes(basis) && (await page.locator('#source-detail').textContent()).includes(`${basis} 1건`));
    check(`${tag} chart table and suggested practice retain date basis`, (await page.locator('#trend-rows').textContent()).includes(basis) && (await page.locator('#pitch-review .practice small').textContent()).includes(basis));
    const analysisGeometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, targets: [...document.querySelectorAll('button,input,select,a[href]')].filter(el => el.getBoundingClientRect().height).map(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right }; }) }));
    check(`${tag} date guidance wraps without clipping controls`, analysisGeometry.scroll <= analysisGeometry.width + 1 && analysisGeometry.targets.every(r => r.width >= 43.5 && r.height >= 43.5 && r.left >= 0 && r.right <= analysisGeometry.width + 1));
    await page.screenshot({ path: `${OUT}/analysis-dates-${tag}.png`, fullPage: true });
    await page.locator('#anchor-date').fill('2024-05-02'); await page.locator('#anchor-date').dispatchEvent('change');
    check(`${tag} periods without uncertain dates omit the notice`, !(await page.locator('#coverage-detail').textContent()).includes('실제 기록일 확인 필요') && !(await page.locator('#source-detail').textContent()).includes('날짜 근거:'));
    await context.close();
  }
  check('zero browser or console errors', errors.length === 0);
} finally { await browser.close(); await fs.writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, reproducedOldDelay: reproduce, passed: checks.length, checks, errors }, null, 2)); }
console.log(JSON.stringify({ passed: checks.length, errors, output: OUT }));
