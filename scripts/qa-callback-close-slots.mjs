import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createSheet, createRow, fillHourlyTimes, createNextHourlyRow, fieldMinutes, normalizeSheet, validateSheet, MAX_ROWS, incrementPaperMetric, getPaperNotes, getDonorSummary, replaceObjectionNote } from '../callback/sheets/sheet-model.js';
const require = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768';
const OUT = process.env.QA_OUTPUT || '/tmp/presence-case-close-qa';
const checks = [], errors = [];
const oldSource = execFileSync('git', ['show', 'd0949b6:callback/sheets/sheet-model.js'], { encoding: 'utf8' });
const oldModel = await import(`data:text/javascript;base64,${Buffer.from(oldSource).toString('base64')}`);
function check(name, value) { assert.ok(value, name); checks.push(name); }
const sheet = createSheet(); sheet.objections = '1.\n\n2.\n\n3.'; sheet.rows[0].time = '13:00'; Object.assign(sheet.rows[0], { contact: 4, stop: 4, presentation: 4, close: 4, donorCases: [{ id:'case1', donor:true, counts:{ contact:1, stop:1, presentation:1, close:1 }, note:'ㄴㄴ' }] });
const before = JSON.stringify(sheet), notes = getPaperNotes(sheet); assert.deepEqual(notes.map(note => note.text), ['1. ㄴㄴ','2.','3.','4.']); assert.equal(notes[0].kind,'case'); assert.equal(notes[0].caseId,'case1'); assert.equal(notes[0].donor,true); assert.equal(notes[3].virtual,true); assert.equal(JSON.stringify(sheet),before);
sheet.donorObjections=['1.']; assert.equal(getDonorSummary(sheet).count,1);
sheet.objections='1. 기존 원문\n\n2.\n\n3.'; sheet.donorObjections=[]; assert.ok(getPaperNotes(sheet)[0].text.includes('기존 원문')); assert.ok(getPaperNotes(sheet)[0].text.includes('ㄴㄴ'));
sheet.objections='1.\n\n2.\n\n3.'; incrementPaperMetric(sheet,sheet.rows[0].id,'close'); assert.deepEqual(getPaperNotes(sheet).map(note=>note.slot),[1,2,3,4,5]); assert.equal(validateSheet(sheet).valid,true);
const later=createSheet(); later.rows[0].close=2; Object.assign(later.rows[1],{ contact:1,stop:1,presentation:1,close:1,donorCases:[{id:'later',donor:true,counts:{contact:1,stop:1,presentation:1,close:1},note:'다음 시간'}] }); assert.equal(getPaperNotes(later)[2].text,'3. 다음 시간'); assert.equal(getDonorSummary(later).count,1);
check('Close slot model invariants and donor dedup pass', true);
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const role of ['member', 'leader', 'admin']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const tag = `${role}-${viewport.width}`, uid = `paper-direct-${role}`;
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
    const legacy = createSheet(new Date('2026-10-18T12:00:00Z')); legacy.id = 'case-close'; legacy.meta.name = `QA ${role}`; legacy.objections = '1. 원래 적은 본문\n\n2.\n\n3.'; legacy.donorObjections = ['1. 원래 적은 본문'];
    Object.assign(legacy.rows[0], { time:'13:00',endTime:'14:00', contact:4,stop:4,presentation:4,close:4,donorCases:[{id:'linked-donor',donor:true,counts:{contact:1,stop:1,presentation:1,close:1},note:'ㄴㄴ'}] });
    await page.evaluate(async ({ uid, sheet }) => new Promise((resolve, reject) => { const open = indexedDB.open('presence-paper-sheets-v1', 1); open.onupgradeneeded = () => { const db = open.result, store = db.createObjectStore('records', { keyPath: 'key' }); store.createIndex('namespace', 'namespace'); db.createObjectStore('drafts', { keyPath: 'namespace' }); }; open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ namespace: `user:${uid}`, sheet }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), { uid, sheet: legacy });
    await page.goto(`${BASE}/callback/sheets/index.html?qa=case-close`, { waitUntil: 'networkidle' });
    await page.locator('.paper-hit').first().waitFor({ state:'attached' });
    if (viewport.width<800) await page.locator('#preview-tab').click();
    if (viewport.width<1300) await page.locator('#paper-edit-toggle').click();
    await page.getByRole('button',{name:/^1\. ㄴㄴ/}).click();
    check(`${tag} first Close opens the linked donor case`, await page.locator('#paper-note-body').inputValue()==='ㄴㄴ' && await page.locator('#paper-note-donor').isChecked() && (await page.locator('#paper-note-existing').textContent()).includes('원래 적은 본문'));
    await page.locator('#paper-note-body').fill('정확한 후원자 메모'); await page.locator('#paper-note-form button[type="submit"]').click();
    check(`${tag} paper edit changes the same case in the form`, await page.locator('[data-field="rows.0.donorCases.0.note"]').inputValue()==='정확한 후원자 메모');
    await page.getByRole('button',{name:'2. 메모 수정',exact:true}).click(); await page.locator('#paper-note-body').fill('두번째 오브젝션'); await page.locator('#paper-note-form button[type="submit"]').click();
    check(`${tag} editing slot two retains its number and the first common body`, (await page.locator('#objections').inputValue()).includes('2. 두번째 오브젝션') && (await page.locator('#objections').inputValue()).includes('1. 원래 적은 본문'));
    await page.getByRole('button',{name:'4. 메모 수정',exact:true}).click(); await page.locator('#paper-note-body').fill('네번째 오브젝션'); await page.locator('#paper-note-form button[type="submit"]').click();
    check(`${tag} missing fourth Close slot is editable and becomes a real numbered note`, (await page.locator('#objections').inputValue()).endsWith('4. 네번째 오브젝션'));
    await page.locator(`[data-row-id="${legacy.rows[0].id}"][data-paper-metric="close"]`).click();
    await page.getByRole('button',{name:'5. 메모 수정',exact:true}).waitFor();
    check(`${tag} new Close adds only the next fifth slot`, await page.locator('[data-field="rows.0.close"]').inputValue()==='5' && await page.locator('.paper-note-hit').count()===5);
    await page.locator('#save-sheet').click(); await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='보관함에 저장됨');
    const saved=JSON.parse(remote['case-close'].sheetJson);
    const result=await page.evaluate(async saved=>{const model=await import('./sheet-model.js?v=20261018-case1');const renderer=await import('./sheet-renderer.js?v=20261018-case1');const geometry=await renderer.renderSheet(document.createElement('canvas'),saved);return {notes:model.getPaperNotes(saved),donors:model.getDonorSummary(saved).count,color:geometry.notes[0].color};},saved);
    check(`${tag} saved numbered notes have no gaps and donor is counted once`, result.notes.map(n=>n.slot).join(',')==='1,2,3,4,5' && result.notes[0].caseId==='linked-donor' && result.notes[0].text.includes('원래 적은 본문') && result.notes[1].text==='2. 두번째 오브젝션' && result.donors===1 && result.color==='#b13e43' && writes===1);
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('.paper-hit')].map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height};})}));
    check(`${tag} paper scroller contains overflow`,geometry.scroll<=geometry.width+1);
    if(viewport.width<1300)check(`${tag} direct paper targets remain 44px`,geometry.targets.every(r=>r.width>=43.5&&r.height>=43.5));
    await page.locator('#paper-edit-toggle').scrollIntoViewIfNeeded(); await page.screenshot({path:`${OUT}/case-${tag}.png`});
    await context.close();
  }
  check('zero browser or console errors', errors.length === 0);
} finally { await browser.close(); await fs.writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, passed: checks.length, checks, errors }, null, 2)); }
console.log(JSON.stringify({ passed: checks.length, errors, output: OUT }));
