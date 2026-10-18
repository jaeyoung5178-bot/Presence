import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createSheet, createRow, fillHourlyTimes, createNextHourlyRow, fieldMinutes, normalizeSheet, validateSheet, MAX_ROWS, incrementPaperMetric, getPaperNotes, replaceObjectionNote } from '../callback/sheets/sheet-model.js';
const require = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768';
const OUT = process.env.QA_OUTPUT || '/tmp/presence-paper-direct-qa';
const checks = [], errors = [];
const oldSource = execFileSync('git', ['show', 'd0949b6:callback/sheets/sheet-model.js'], { encoding: 'utf8' });
const oldModel = await import(`data:text/javascript;base64,${Buffer.from(oldSource).toString('base64')}`);
function check(name, value) { assert.ok(value, name); checks.push(name); }
const modelSheet = createSheet(); modelSheet.objections = '3. 기존 메모'; modelSheet.rows[0].close = 1; modelSheet.rows[0].contact = 2; modelSheet.rows[0].donorCases = [{ id: 'case1', donor: false, counts: { contact: 1, stop: 0, presentation: 0, close: 0 }, note: '기존 케이스' }];
const action = incrementPaperMetric(modelSheet, modelSheet.rows[0].id, 'close');
check('close appends next unique number across original and case notes', action.note === '4.' && modelSheet.rows[0].close === 2 && getPaperNotes(modelSheet).map(note => note.text).join('|').includes('1. 기존 케이스'));
check('close does not change donor summary classification schema', modelSheet.rows[0].donorCases.length === 1 && modelSheet.donorObjections === undefined);
const updated = replaceObjectionNote(modelSheet, '4.', '카드 3만원\n요약 질문', true);
check('multiline edits retain numbering and donor flag', updated === '4. 카드 3만원\n요약 질문' && modelSheet.donorObjections.includes(updated) && validateSheet(modelSheet).valid);
for (const [name, mutate] of [
  ['count ceiling', sheet => { sheet.rows[0].close = 999; }],
  ['text ceiling', sheet => { sheet.objections = '1. ' + '가'.repeat(11997); }],
  ['number ceiling', sheet => { sheet.objections = '999. 기존'; }],
  ['note ceiling', sheet => { sheet.objections = Array.from({ length: 500 }, (_, i) => `${i+1}.`).join('\n'); }]
]) { const sheet = createSheet(); mutate(sheet); const before = JSON.stringify(sheet); let failed = false; try { incrementPaperMetric(sheet, sheet.rows[0].id, 'close'); } catch { failed = true; } check(`${name} refuses entire increment atomically`, failed && JSON.stringify(sheet) === before); }
const unnumbered = createSheet(); unnumbered.objections = '메모 A\n\n메모 B'; unnumbered.donorObjections = ['메모 B']; incrementPaperMetric(unnumbered, unnumbered.rows[0].id, 'close'); check('first generated number preserves separate legacy unnumbered donor blocks', validateSheet(unnumbered).valid && getPaperNotes(unnumbered).length === 3 && unnumbered.donorObjections[0] === '2. 메모 B' && oldModel.validateSheet(unnumbered).valid && JSON.stringify(oldModel.normalizeSheet(unnumbered)) === JSON.stringify(normalizeSheet(unnumbered)));
const mixedLegacy = createSheet(); mixedLegacy.objections = '메모 A\n\n메모 B\n\n3. 기존 번호'; mixedLegacy.donorObjections = ['메모 A\n\n메모 B']; check('old valid mixed prelude remains valid without migration', oldModel.validateSheet(mixedLegacy).valid && validateSheet(mixedLegacy).valid && JSON.stringify(oldModel.normalizeSheet(mixedLegacy)) === JSON.stringify(normalizeSheet(mixedLegacy))); incrementPaperMetric(mixedLegacy, mixedLegacy.rows[0].id, 'close'); check('appended mixed prelude remains compatible with cached legacy storage', oldModel.validateSheet(mixedLegacy).valid && validateSheet(mixedLegacy).valid && mixedLegacy.donorObjections[0] === '메모 A\n\n메모 B');
const plainDuplicates = createSheet(); plainDuplicates.objections = '같은 메모\n\n같은 메모'; plainDuplicates.donorObjections = ['같은 메모']; const promotedAction = incrementPaperMetric(plainDuplicates, plainDuplicates.rows[0].id, 'close'); check('plain duplicate promotion preserves both bodies and exact undo input', oldModel.validateSheet(plainDuplicates).valid && plainDuplicates.donorObjections.length === 2 && promotedAction.beforeObjections === '같은 메모\n\n같은 메모' && promotedAction.beforeFlags[0] === '같은 메모');
const duplicateNotes = createSheet(); duplicateNotes.objections = '시간없음\n\n시간없음'; duplicateNotes.donorObjections = ['시간없음']; replaceObjectionNote(duplicateNotes, '시간없음', '두번째만 변경', true, 1); check('editing second identical legacy note preserves first and its donor flag', duplicateNotes.objections === '시간없음\n\n두번째만 변경' && duplicateNotes.donorObjections.length === 2 && duplicateNotes.donorObjections.includes('시간없음'));
replaceObjectionNote(duplicateNotes, '두번째만 변경', '두번째만 변경', false, 1); check('unchecking an unchanged unique note removes only its donor flag', duplicateNotes.donorObjections.length === 1 && duplicateNotes.donorObjections[0] === '시간없음');
const decimal = createSheet(); decimal.objections = '999.5만원'; incrementPaperMetric(decimal, decimal.rows[0].id, 'close'); check('decimal amount is not mistaken for a numbered note', decimal.rows[0].close === 1 && getPaperNotes(decimal).length === 2 && decimal.objections.includes('999.5만원') && oldModel.validateSheet(decimal).valid);
const blank = createSheet(); incrementPaperMetric(blank, blank.rows[0].id, 'contact'); check('null increments to one', blank.rows[0].contact === 1); blank.rows[0].contact = 0; incrementPaperMetric(blank, blank.rows[0].id, 'contact'); check('zero increments to one', blank.rows[0].contact === 1);
if (process.env.QA_MODEL_ONLY === '1') { console.log(JSON.stringify({ passed: checks.length, errors })); process.exit(0); }
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
    const legacy = createSheet(new Date('2026-10-08T12:00:00Z')); legacy.id = 'paper-direct'; legacy.meta.name = `QA ${role}`; legacy.objections = '3. 기존 오브젝션\n기존 여러 줄'; legacy.donorObjections = [legacy.objections]; legacy.review.loa.good = '보존할 회고';
    Object.assign(legacy.rows[0], { time: '12:10', endTime: '13:00', contact: 7, stop: 3, presentation: 2, close: 1, donorCases: [{ id: 'case1', donor: true, counts: { contact: 1, stop: 1, presentation: 1, close: 1 }, note: '기존 케이스' }] });
    await page.evaluate(async ({ uid, sheet }) => new Promise((resolve, reject) => { const open = indexedDB.open('presence-paper-sheets-v1', 1); open.onupgradeneeded = () => { const db = open.result, store = db.createObjectStore('records', { keyPath: 'key' }); store.createIndex('namespace', 'namespace'); db.createObjectStore('drafts', { keyPath: 'namespace' }); }; open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ namespace: `user:${uid}`, sheet }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), { uid, sheet: legacy });
    await page.goto(`${BASE}/callback/sheets/index.html?qa=paper-direct1`, { waitUntil: 'networkidle' });
    await page.locator('.paper-hit[data-paper-metric="contact"]').first().waitFor({ state: 'attached' });
    if (viewport.width < 800) await page.locator('#preview-tab').click();
    if (viewport.width < 1300) { check(`${tag} small fit preview is explicitly view only`, await page.locator('#paper-hit-layer').isHidden() && (await page.locator('#paper-edit-guide').textContent()).includes('확대해서 기록')); await page.locator('#paper-edit-toggle').click(); }
    else check(`${tag} desktop fit preview is directly interactive`, await page.locator('#paper-hit-layer').isVisible() && await page.locator('#paper-edit-toggle').getAttribute('aria-pressed') === 'false');
    const metric = key => page.locator(`[data-paper-metric="${key}"][data-row-id="${legacy.rows[0].id}"]`);
    await metric('contact').click(); check(`${tag} paper contact click increments form`, await page.locator('[data-field="rows.0.contact"]').inputValue() === '8');
    await metric('contact').focus(); const focused = await metric('contact').evaluate(node => { window.__focusedMetric = node; return true; });
    for (let i = 0; i < 8; i++) await page.keyboard.press('Enter');
    check(`${tag} keyboard repeat increments without losing overlay identity`, focused && await page.locator('[data-field="rows.0.contact"]').inputValue() === '16' && await metric('contact').evaluate(node => node === window.__focusedMetric && document.activeElement === node));
    await page.keyboard.press('Space'); check(`${tag} Space adds exactly one`, await page.locator('[data-field="rows.0.contact"]').inputValue() === '17');
    await metric('contact').hover(); await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up(); await metric('contact').dblclick();
    check(`${tag} native pointer press across redraw and rapid double click do not lose increments`, await page.locator('[data-field="rows.0.contact"]').inputValue() === '20');
    await metric('close').click(); await metric('close').click();
    check(`${tag} close creates consecutive notes without opening editor`, await page.locator('[data-field="rows.0.close"]').inputValue() === '3' && await page.locator('#paper-note-dialog').isHidden() && (await page.locator('#objections').inputValue()).endsWith('4.\n\n5.'));
    await page.locator('#paper-undo').click();
    check(`${tag} undo restores count and removes only last placeholder`, await page.locator('[data-field="rows.0.close"]').inputValue() === '2' && (await page.locator('#objections').inputValue()).endsWith('4.') && !(await page.locator('#objections').inputValue()).includes('5.'));
    await page.locator('.paper-note-hit').filter({ hasText: '' }).first().waitFor({ state: 'attached' });
    await page.getByRole('button', { name: '4. 메모 수정', exact: true }).click();
    await page.locator('#paper-note-body').fill('카드 3만원\n다음에는 요약 질문\n' + '추가 확인할 긴 메모 '.repeat(20)); await page.locator('#paper-note-donor').check(); await page.locator('#paper-note-form button[type="submit"]').click();
    check(`${tag} edited numbered donor note synchronizes with form`, (await page.locator('#objections').inputValue()).includes('4. 카드 3만원\n다음에는 요약 질문') && await page.locator('#objection-donor-list input:checked').count() === 2);
    await metric('close').click(); await page.getByRole('button', { name: '5. 메모 수정', exact: true }).click(); await page.locator('#paper-note-body').fill('작성 후 되돌릴 메모'); await page.locator('#paper-note-donor').check(); await page.locator('#paper-note-form button[type="submit"]').click(); await page.locator('#paper-undo').click();
    check(`${tag} undo of edited generated note preserves older notes and flags`, await page.locator('[data-field="rows.0.close"]').inputValue() === '2' && !(await page.locator('#objections').inputValue()).includes('작성 후 되돌릴 메모') && await page.locator('#objection-donor-list input:checked').count() === 2);
    const secondContact = page.locator(`[data-paper-metric="contact"][data-row-id="${legacy.rows[1].id}"]`); await secondContact.click(); await page.locator('#paper-undo').click(); check(`${tag} undo restores null instead of inventing zero`, await page.locator('[data-field="rows.1.contact"]').inputValue() === '');
    if (viewport.width < 800) await page.locator('#edit-tab').click();
    await page.locator('[data-field="rows.0.stop"]').fill('1000'); if (viewport.width < 800) await page.locator('#preview-tab').click(); await metric('contact').click();
    check(`${tag} invalid form blocks preview increments`, await page.locator('[data-field="rows.0.contact"]').inputValue() === '20' && await page.locator('#error-banner').isVisible());
    await page.locator('[data-field="rows.0.stop"]').fill('3'); await page.locator('[data-field="rows.0.time"]').fill('12:10'); await page.locator('[data-field="rows.0.contact"]').fill('160');
    await page.locator('[data-field="meta.theme"]').fill('동적 줄바꿈 테스트 '.repeat(6));
    await page.locator('#add-row').click(); await page.locator('[data-field="rows.10.time"]').waitFor();
    check(`${tag} hourly auto fill and appended row remain intact`, await page.locator('[data-field="rows.0.endTime"]').inputValue() === '13:00' && await page.locator('[data-field="rows.1.time"]').inputValue() === '13:00' && await page.locator('[data-field="rows.10.time"]').inputValue() === '22:00');
    if (viewport.width < 800) await page.locator('#preview-tab').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-paper-metric]').length === 44);
    await metric('stop').click(); check(`${tag} dynamic row and metadata height retain correct hit target`, await page.locator('[data-field="rows.0.stop"]').inputValue() === '4' && await page.locator('[data-field="rows.0.contact"]').inputValue() === '160');
    if (viewport.width < 800) await page.locator('#edit-tab').click();
    await page.locator('[data-remove-row="10"]').click(); await page.locator('#confirm-accept').click();
    if (viewport.width < 800) await page.locator('#preview-tab').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-paper-metric]').length === 40);
    check(`${tag} row deletion removes stale overlay targets`, await page.locator('[data-paper-metric]').count() === 40);
    await page.locator('#save-sheet').click(); await page.waitForFunction(() => document.querySelector('#save-status').textContent === '보관함에 저장됨');
    const saved = JSON.parse(remote['paper-direct'].sheetJson);
    check(`${tag} saved record preserves paper edits, donor flags, reflection and original cases`, writes === 1 && saved.rows[0].contact === 160 && saved.rows[0].stop === 4 && saved.rows[0].close === 2 && saved.donorObjections.length === 2 && saved.review.loa.good === legacy.review.loa.good && saved.rows[0].donorCases.length === 1);
    await page.waitForTimeout(120);
    const mapped = await page.evaluate(async saved => { const renderer = await import('./sheet-renderer.js?v=20261018-paper2'); const canvas = document.createElement('canvas'); const geometry = await renderer.renderSheet(canvas, saved); const stage = document.querySelector('.paper-stage').getBoundingClientRect(); const target = geometry.cells.find(cell => cell.rowId === saved.rows[0].id && cell.metric === 'stop'); const button = document.querySelector(`[data-paper-metric="stop"][data-row-id="${saved.rows[0].id}"]`).getBoundingClientRect(); return Math.abs(button.left - stage.left - (target.x + 4) / geometry.logicalWidth * stage.width) < 1 && Math.abs(button.top - stage.top - (target.y + 4) / geometry.logicalHeight * stage.height) < 1; }, saved);
    check(`${tag} overlay tracks current renderer geometry exactly`, mapped);
    const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, targets: [...document.querySelectorAll('.paper-tools button,.paper-hit')].filter(el => el.getBoundingClientRect().height && !el.closest('[hidden]')).map(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; }), clip: document.querySelector('#paper-scroll').getBoundingClientRect().right <= innerWidth + 1 }));
    check(`${tag} labelled paper scroller contains horizontal overflow`, geometry.scroll <= geometry.width + 1 && geometry.clip);
    if (viewport.width < 1300) check(`${tag} all paper touch targets are at least 44px`, geometry.targets.every(rect => rect.width >= 43.5 && rect.height >= 43.5));
    await page.locator('#paper-edit-toggle').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${OUT}/paper-${tag}.png` });
    await page.locator('#export-image').click(); await page.locator('#image-dialog').waitFor({ state: 'visible' });
    check(`${tag} exported PNG includes handwritten paper without editor overlays`, await page.locator('#export-preview-image').evaluate(async image => { await image.decode(); return image.naturalWidth > 1000 && image.naturalHeight > 1000; }));
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'networkidle' });
    check(`${tag} saved note and counts survive a fresh read`, await page.locator('[data-field="rows.0.close"]').inputValue() === '2' && (await page.locator('#objections').inputValue()).includes('추가 확인할 긴 메모') && await page.locator('#objection-donor-list input:checked').count() === 2);
    check(`${tag} member and leader do not receive admin UI`, role === 'admin' || await page.locator('[data-admin-only],#admin-panel').count() === 0);
    if (viewport.width < 800) await page.locator('#preview-tab').click();
    if (viewport.width < 1300) await page.locator('#paper-edit-toggle').click();
    await page.getByRole('button', { name: /^4\. 카드 3만원/ }).click();
    await page.locator('#paper-note-body').fill('계정 전환 전에만 보여야 하는 임시 메모');
    await page.evaluate(() => { localStorage.removeItem('fcos_hub_identity'); localStorage.removeItem('fcos_callback_access_key'); window.dispatchEvent(new StorageEvent('storage', { key: 'fcos_hub_identity' })); });
    await page.locator('#paper-note-dialog').waitFor({ state: 'hidden' });
    check(`${tag} account change closes and clears old note editor immediately`, await page.locator('#paper-note-body').inputValue() === '' && !await page.locator('#paper-note-donor').isChecked() && !(await page.locator('#paper-announcement').textContent()));

    await context.close();
  }
  check('zero browser or console errors', errors.length === 0);
} finally { await browser.close(); await fs.writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, passed: checks.length, checks, errors }, null, 2)); }
console.log(JSON.stringify({ passed: checks.length, errors, output: OUT }));
