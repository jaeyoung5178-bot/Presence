import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

// Always use a disposable browser context. Never use the user's Chrome profile.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = process.env.QA_OUTPUT || '/tmp/presence-paper-qa';
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768';
const RUNTIME = '/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node';
const require = createRequire(`${RUNTIME}/package.json`);
const results = { base: BASE, startedAt: new Date().toISOString(), checks: [], geometry: [], browserErrors: [], blockedRemoteRequests: [] };
const check = (name, condition, details) => {
  results.checks.push({ name, pass: Boolean(condition), ...(details === undefined ? {} : { details }) });
  assert.ok(condition, `${name}${details === undefined ? '' : `: ${JSON.stringify(details)}`}`);
};
await fs.mkdir(OUT, { recursive: true });

async function modelChecks() {
  const source = await fs.readFile(path.join(ROOT, 'callback/sheets/sheet-model.js'), 'utf8');
  const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const sheet = model.createSheet(new Date('2026-10-08T12:00:00Z'));
  check('fresh sheet is empty and valid', model.validateSheet(sheet).valid && sheet.meta.name === '' && sheet.rows.every(row => model.METRICS.every(key => row[key] === null)));
  sheet.rows.forEach((row, i) => { row.contact = i; row.stop = i % 3; row.presentation = i % 2; row.close = i === 9 ? 1 : 0; row.rehash = i === 9 ? 2 : null; });
  check('ten rows total exactly', JSON.stringify(model.getTotals(sheet)) === JSON.stringify({ contact: 45, stop: 9, presentation: 5, close: 1, rehash: 2 }), model.getTotals(sheet));
  const copy = model.normalizeSheet(sheet); copy.rows[0].contact = 999;
  check('normalization makes an independent copy', sheet.rows[0].contact === 0);
  for (const value of [-1, 1.5, Infinity, NaN, '3', 1000]) {
    const invalid = structuredClone(sheet); invalid.rows[0].contact = value;
    check(`invalid count ${String(value)} rejected`, !model.validateSheet(invalid).valid);
  }
  for (const date of ['2026-02-30', '2026-13-01', '', '2026-1-1']) {
    const invalid = structuredClone(sheet); invalid.date = date;
    check(`invalid date ${date} rejected`, !model.validateSheet(invalid).valid);
  }
  const zero = structuredClone(sheet); zero.rows.forEach(row => { row.contact = null; });
  check('blank count remains unfilled', !model.hasValues(zero, 'contact'));
  zero.rows[0].contact = 0;
  check('explicit zero remains filled', model.hasValues(zero, 'contact'));
  const imported = model.normalizeSheet({ ...sheet, arbitrary: '<script>bad</script>' });
  check('unknown import properties omitted', !('arbitrary' in imported));
  const duplicate = structuredClone(sheet); duplicate.rows[1].id = duplicate.rows[0].id;
  check('duplicate row IDs rejected', !model.validateSheet(duplicate).valid);
  check('new records have independent IDs on same date', model.createSheet().id !== model.createSheet().id);
  return model;
}

async function serviceWorkerChecks() {
  const events = new Map(), cached = new Map(); let offline = false;
  const key = value => typeof value === 'string' ? value : value.url;
  const scope = {
    URL, Promise,
    self: { addEventListener: (type, fn) => events.set(type, fn), skipWaiting() {}, clients: { claim() {} } },
    caches: { open: async () => ({ put: async (url, response) => cached.set(key(url), response), addAll: async () => {} }), match: async value => cached.get(key(value)), keys: async () => [], delete: async () => true },
    fetch: async request => { if (offline) throw new Error('offline'); return new Response(request.url.includes('/sheets/') ? 'PAPER' : 'FIELD'); },
  };
  vm.createContext(scope);
  vm.runInContext(await fs.readFile(path.join(ROOT, 'callback/sw.js'), 'utf8'), scope);
  const visit = async (pathname, mode = 'navigate') => {
    let response; events.get('fetch')({ request: { url: `https://hub.presence.co.kr${pathname}`, method: 'GET', mode }, respondWith: promise => { response = promise; } });
    return response;
  };
  await visit('/callback/?u=qa&k=secret');
  await visit('/callback/sheets/index.html?u=qa&k=secret');
  check('SW preserves separate field and paper document caches', cached.has('/callback/index.html') && cached.has('/callback/sheets/index.html') && cached.size === 2);
  check('SW never stores identity query credentials in document keys', [...cached.keys()].every(value => !value.includes('?') && !value.includes('secret')));
  offline = true;
  check('SW offline field route returns only field shell', await (await visit('/callback/index.html?u=another')).clone().text() === 'FIELD');
  check('SW offline paper route returns only paper shell', await (await visit('/callback/sheets/?k=another')).clone().text() === 'PAPER');
  check('SW unknown document cannot fall back to wrong app shell', await visit('/callback/unknown.html') === undefined);
}

function donorModelChecks(model) {
  const legacy = model.createSheet(new Date('2026-06-10T12:00:00Z'));
  legacy.id = 'legacy-before-donor-feature';
  legacy.meta = { name: 'QA 이름', weather: '맑음', team: 'QA 팀', location: 'QA 장소', theme: 'QA 테마' };
  legacy.rows.forEach(row => { delete row.donorCases; });
  Object.assign(legacy.rows[0], { time: '11:45', endTime: '12:15', contact: 7, stop: 4, presentation: 3, close: 2 });
  check('legacy record stays byte-equivalent through normalization', JSON.stringify(model.normalizeSheet(legacy)) === JSON.stringify({ ...legacy, meta: { name: 'QA 이름', location: 'QA 장소', team: 'QA 팀', weather: '맑음', theme: 'QA 테마' } }));
  const mixed = structuredClone(legacy); mixed.id = 'mixed-donor-reference';
  mixed.rows[0].donorCases = [
    { id: 'case-a', donor: true, counts: { contact: 2, stop: 1, presentation: 1, close: 1 }, note: 'DONOR-RED-NOTE-A 후원자 기본정보' },
    { id: 'case-b', donor: false, counts: { contact: 1, stop: 1, presentation: 1, close: 0 }, note: 'ORDINARY-BLACK-NOTE 일반 대화' },
    { id: 'case-c', donor: true, counts: { contact: 1, stop: 0, presentation: 0, close: 0 }, note: 'DONOR-RED-NOTE-C 후원자 대화' },
  ];
  check('mixed donor and ordinary cases are valid', model.validateSheet(mixed).valid);
  check('case annotations do not inflate hourly totals', JSON.stringify(model.getTotals(mixed)) === JSON.stringify(model.getTotals(legacy)));
  check('only selected cases contribute donor counts', JSON.stringify(model.getCaseTotals(mixed.rows[0], { donorsOnly: true })) === JSON.stringify({ contact: 3, stop: 1, presentation: 1, close: 1 }));
  const clone = model.normalizeSheet(mixed); clone.rows[0].donorCases[0].counts.contact = 0;
  check('case normalization deeply copies nested counts', mixed.rows[0].donorCases[0].counts.contact === 2);
  for (const mutate of [
    sheet => { sheet.rows[0].donorCases[0].counts.contact = 8; },
    sheet => { sheet.rows[0].donorCases[0].counts.close = -1; },
    sheet => { sheet.rows[0].donorCases[0].counts.stop = 1.5; },
    sheet => { sheet.rows[0].donorCases[0].donor = 'true'; },
    sheet => { sheet.rows[0].donorCases[1].id = 'case-a'; },
    sheet => { sheet.rows[0].donorCases[0].note = 'x'.repeat(12001); },
  ]) { const bad = structuredClone(mixed); mutate(bad); check('invalid or excess donor contribution rejected', !model.validateSheet(bad).valid); }
  const unchecked = structuredClone(mixed); unchecked.rows[0].donorCases.forEach(item => { item.donor = false; });
  check('unchecking donors changes no totals and removes donor contributions', JSON.stringify(model.getTotals(unchecked)) === JSON.stringify(model.getTotals(mixed)) && Object.values(model.getCaseTotals(unchecked.rows[0], { donorsOnly: true })).every(value => value === 0));
  return { legacy, mixed };
}

const isRed = color => { const match = /^#([0-9a-f]{6})$/i.exec(color); if (!match) return false; const rgb = match[1].match(/../g).map(value => parseInt(value, 16)); return rgb[0] > rgb[1] * 1.3 && rgb[0] > rgb[2] * 1.3; };

async function donorRendererChecks(browser, mixed) {
  const { context, page } = await fixture(browser);
  try {
    await openPage(page);
    const result = await page.evaluate(async sheet => {
      const renderer = await import('./sheet-renderer.js?v=20261008-paper2');
      await document.fonts.ready;
      const originalText = CanvasRenderingContext2D.prototype.fillText;
      const originalCurve = CanvasRenderingContext2D.prototype.quadraticCurveTo;
      const originalStroke = CanvasRenderingContext2D.prototype.stroke;
      let texts = [], strokes = [];
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) { texts.push({ text: String(text), x, y, color: this.fillStyle }); return originalText.call(this, text, x, y, ...args); };
      CanvasRenderingContext2D.prototype.quadraticCurveTo = function (...args) { this.__qaTallyStroke = true; return originalCurve.apply(this, args); };
      CanvasRenderingContext2D.prototype.stroke = function (...args) { if (this.__qaTallyStroke) { strokes.push(this.strokeStyle); delete this.__qaTallyStroke; } return originalStroke.apply(this, args); };
      try {
        const canvas = document.createElement('canvas');
        await renderer.renderSheet(canvas, sheet, { scale: 1.7 });
        const previewTrace = { texts, strokes }; texts = []; strokes = [];
        const output = await renderer.exportSheetPNG(sheet);
        const exportTrace = { texts, strokes };
        const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(output.blob); });
        return { previewTrace, exportTrace, png, width: output.width, height: output.height };
      } finally {
        CanvasRenderingContext2D.prototype.fillText = originalText;
        CanvasRenderingContext2D.prototype.quadraticCurveTo = originalCurve;
        CanvasRenderingContext2D.prototype.stroke = originalStroke;
      }
    }, mixed);
    check('preview and downloaded PNG use identical text, positions, and ink', JSON.stringify(result.previewTrace) === JSON.stringify(result.exportTrace));
    const calls = result.exportTrace.texts, text = calls.map(call => call.text).join(' ');
    for (const label of ['Call Back Sheet', 'Field Time', 'Contact', 'Stop', 'Presentation', 'Close', '오브젝션 핸들링 사유', '과정 목표(Goal)', '시리얼(기본정보)', 'Number', 'Pitch(Skill)', 'Attitude(Mental)']) check(`new reference label ${label} is present`, calls.some(call => call.text === label));
    check('reference summary includes exact motto', text.includes('환경을 탓하지 말고 나의 노력을 탓하라'));
    check('unrequested branding, quote, and per-result captions removed', !/P\s*R\s*E\s*S\s*E\s*N\s*C\s*E|FIELD\s*NOTES|매일의 기록|목표\s*\/\s*결과/.test(text));
    for (const label of ['Number', 'Pitch(Skill)', 'Attitude(Mental)']) check(`${label} prints only on positive review row`, calls.filter(call => call.text === label).length === 1);
    const meta = label => calls.find(call => call.text === label || call.text === label + ':');
    const name = meta('Name'), weather = meta('Weather'), team = meta('Team'), location = meta('Location'), date = meta('Date'), theme = meta('오늘의 테마');
    check('reference metadata uses Name/Weather, Team/Location, Date/Theme columns', name && weather && team && location && date && theme && name.x === weather.x && team.x === location.x && date.x === theme.x && name.x < team.x && team.x < date.x && weather.y > name.y && location.y > team.y && theme.y > date.y);
    for (const [label, value] of [['Name', 'QA 이름'], ['Weather', '맑음'], ['Team', 'QA 팀'], ['Location', 'QA 장소'], ['오늘의 테마', 'QA 테마']]) { const key = meta(label), entered = calls.find(call => call.text === value); check(`${label} value is inline beside its printed label`, key && entered && Math.abs(key.y - entered.y) < 1 && entered.x > key.x); }
    const colors = result.exportTrace.strokes.map(isRed);
    const expected = [false,false,false,true,true,false,true, false,false,true,false, false,true,false, false,true];
    check('only selected case strokes turn red inside mixed 正 groups', JSON.stringify(colors) === JSON.stringify(expected), result.exportTrace.strokes);
    const redText = calls.filter(call => isRed(call.color)).map(call => call.text).join('');
    const blackText = calls.filter(call => !isRed(call.color)).map(call => call.text).join('');
    check('only donor case notes are red', redText.includes('DONOR-RED-NOTE-A') && redText.includes('DONOR-RED-NOTE-C') && !redText.includes('ORDINARY-BLACK-NOTE') && blackText.includes('ORDINARY-BLACK-NOTE'));
    check('new paper still exports a high-resolution PNG', result.width >= 2000 && result.height >= 3000);
    await fs.writeFile(path.join(OUT, 'exact-reference-mixed-donors.png'), Buffer.from(result.png.split(',')[1], 'base64'));
  } finally { await context.close(); }
}

async function donorMatrix(browser, specimens) {
  for (const role of ['member', 'leader', 'admin']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    if (process.argv.includes('--donor-unload') && !(role === 'member' && viewport.width === 390)) continue;
    const { context, page } = await fixture(browser, { role, viewport, connected: true });
    const label = `donor-${role}-${viewport.width}`;
    try {
      await openPage(page);
      await field(page, 'meta.name').fill(`QA ${role}`);
      for (const key of ['contact', 'stop', 'presentation', 'close']) await field(page, `rows.0.${key}`).fill(String(specimens.mixed.rows[0][key]));
      for (let i = 0; i < 3; i++) {
        if (!(await page.locator('[data-add-case="0"]').isVisible())) await page.locator('[data-add-case="0"]').locator('xpath=ancestor::details').locator('summary').click();
        await page.locator('[data-add-case="0"]').click();
        const item = specimens.mixed.rows[0].donorCases[i];
        for (const key of ['contact', 'stop', 'presentation', 'close']) await field(page, `rows.0.donorCases.${i}.counts.${key}`).fill(String(item.counts[key]));
        await field(page, `rows.0.donorCases.${i}.donor`).setChecked(item.donor);
        await field(page, `rows.0.donorCases.${i}.note`).fill(item.note);
      }
      await geometry(page, label);
      check(`${label} annotations leave Contact total at seven`, await page.locator('#total-contact').textContent() === '7');
      await page.locator('#save-sheet').click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('보관함에 저장됨'));
      await page.reload({ waitUntil: 'networkidle' });
      check(`${label} donor selection and case counts survive saved reload`, await field(page, 'rows.0.donorCases.0.donor').isChecked() && !(await field(page, 'rows.0.donorCases.1.donor').isChecked()) && await field(page, 'rows.0.donorCases.2.donor').isChecked() && await field(page, 'rows.0.donorCases.0.counts.contact').inputValue() === '2');
      if (await page.locator('[data-view="preview"]').isVisible()) await page.locator('[data-view="preview"]').click();
      await geometry(page, `${label}-preview`);
      if (role === 'member' && viewport.width === 390) {
        if (await page.locator('[data-view="edit"]').isVisible()) await page.locator('[data-view="edit"]').click();
        if (!(await field(page, 'rows.0.donorCases.0.counts.contact').isVisible())) await page.locator('[data-add-case="0"]').locator('xpath=ancestor::details').locator('summary').click();
        await field(page, 'rows.0.donorCases.0.counts.contact').fill('8');
        await page.locator('#save-sheet').click();
        check('overallocated donor cases cannot be saved', await page.locator('#error-banner').isVisible());
        check('overallocated cases protect unload while autosave is suspended', await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }));
        await field(page, 'rows.0.donorCases.0.counts.contact').fill('2');
        check('valid donor record does not trigger unload warning', !(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; })));
        await page.locator('#open-archive').click();
        await page.locator('#archive-dialog').waitFor({ state: 'visible' });
        const pending = page.waitForEvent('download'); await page.locator('#backup-export').click(); const download = await pending;
        await download.saveAs(path.join(OUT, 'donor-backup.json'));
        const backup = JSON.parse(await fs.readFile(path.join(OUT, 'donor-backup.json'), 'utf8'));
        check('JSON backup retains case order, selected flags, counts, and notes', JSON.stringify(backup.sheets[0].rows[0].donorCases.map(({ id, ...item }) => item)) === JSON.stringify(specimens.mixed.rows[0].donorCases.map(({ id, ...item }) => item)));
      }
    } finally { await context.close(); }
  }
  const { context, page } = await fixture(browser);
  try {
    await openPage(page);
    await page.evaluate(async legacy => {
      await new Promise((resolve, reject) => { const req = indexedDB.open('presence-paper-sheets-v1', 1); req.onerror = () => reject(req.error); req.onsuccess = () => { const db = req.result, tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put({ key: `guest\0${legacy.id}`, namespace: 'guest', id: legacy.id, pending: false, baseRevision: 'legacy-rev-1', document: { version: 1, revision: 'legacy-rev-1', deleted: false, updatedAt: legacy.updatedAt, sheet: legacy } }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
    }, specimens.legacy);
    await page.locator('#open-archive').click(); await page.locator(`[data-open-sheet="${specimens.legacy.id}"]`).click();
    check('already-saved legacy record opens with its original totals', await field(page, 'rows.0.contact').inputValue() === '7' && await field(page, 'meta.name').inputValue() === 'QA 이름');
    check('valid legacy record does not trigger unload warning', !(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; })));
    await page.locator('#save-sheet').click();
    await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('보관함에 저장됨'));
    const persisted = await page.evaluate(async () => (await import('./storage.js?v=20261008-paper2')).loadSheets());
    check('legacy save does not invent cases or rewrite old totals', persisted.length === 1 && !('donorCases' in persisted[0].rows[0]) && persisted[0].rows[0].contact === 7 && persisted[0].rows[0].close === 2);
  } finally { await context.close(); }
}

async function fixture(browser, { viewport = { width: 1440, height: 900 }, role = 'member', connected = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
  const mockData = {}; let mockVersion = 1;
  // Deny all external data endpoints, including Firebase, even on the deployed run.
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (/firebasedatabase\.app$|firebaseio\.com$|googleapis\.com$|gstatic\.com$/.test(url.hostname)) {
      results.blockedRemoteRequests.push({ method: request.method(), host: url.hostname, path: url.pathname });
      let body = 'null', contentType = 'application/json';
      if (request.headers().accept?.includes('text/event-stream')) { body = 'event: put\ndata: {"path":"/","data":null}\n\n'; contentType = 'text/event-stream'; }
      else if (url.pathname.endsWith('firebase-app.js')) {
        body = 'const apps={};export function initializeApp(config,name="default"){return apps[name]={name,config};}export function getApp(name="default"){if(!apps[name])throw Error("missing");return apps[name];}'; contentType = 'text/javascript';
      } else if (url.pathname.endsWith('firebase-auth.js')) {
        body = 'export const browserLocalPersistence={}; const user={uid:"paper-qa-anonymous",getIdToken:async()=>"qa-token"};const auth={currentUser:user,authStateReady:async()=>{}};export const getAuth=()=>auth;export const setPersistence=async()=>{};export const signInAnonymously=async()=>{auth.currentUser=user;return {user};};export const signOut=async()=>{auth.currentUser=null;};'; contentType = 'text/javascript';
      } else if (url.pathname.endsWith('.js')) { body = 'export {};'; contentType = 'text/javascript'; }
      else if (/firebasedatabase\.app$|firebaseio\.com$/.test(url.hostname)) {
        const parts = url.pathname.replace(/^\//, '').replace(/\.json$/, '').split('/');
        if (request.method() === 'PUT' || request.method() === 'PATCH') {
          let node = mockData; for (const part of parts.slice(0, -1)) node = node[part] ||= {};
          node[parts.at(-1)] = request.postDataJSON(); mockVersion++;
        }
        let node = mockData; for (const part of parts) node = node?.[part];
        body = JSON.stringify(node ?? null);
      }
      await route.fulfill({ status: 200, contentType, body, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag', ETag: `"qa-${mockVersion}"` } });
      return;
    }
    await route.continue();
  });
  await context.addInitScript(({ role, connected }) => {
    localStorage.setItem('fcos_hub_identity', JSON.stringify({ uid: `paper-qa-${role}`, name: `QA ${role}`, role }));
    if (connected) localStorage.setItem('fcos_callback_access_key', 'qa-only-not-real'); else localStorage.removeItem('fcos_callback_access_key');
    localStorage.removeItem('fcos_personal_launch_v2');
  }, { role, connected });
  const page = await context.newPage();
  page.on('pageerror', error => results.browserErrors.push({ role, viewport, type: 'pageerror', message: error.message }));
  page.on('console', message => { if (message.type() === 'error') results.browserErrors.push({ role, viewport, type: 'console', message: message.text() }); });
  return { context, page };
}

async function openPage(page, suffix = '') {
  await page.goto(`${BASE}/callback/sheets/${suffix}${suffix.includes('?') ? '&' : '?'}qa=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.locator('#save-sheet').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
const field = (page, key) => page.locator(`[data-field="${key}"]`);

async function geometry(page, label) {
  const info = await page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width && r.height && s.visibility !== 'hidden' && s.display !== 'none'; };
    const scope = document.querySelector('dialog[open]') || document;
    const targets = [...scope.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(visible).map(el => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return { label: el.id || el.getAttribute('data-field') || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 50), tag: el.tagName, x: r.x, y: r.y, width: r.width, height: r.height, font: parseFloat(s.fontSize) };
    });
    const narrowGaps = [];
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i], b = targets[j];
      if (Math.abs(a.y + a.height / 2 - b.y - b.height / 2) > 2) continue;
      const gap = a.x < b.x ? b.x - a.x - a.width : a.x - b.x - b.width;
      if (gap >= -.5 && gap < 7.5) narrowGaps.push({ first: a.label, second: b.label, gap });
    }
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, targets, narrowGaps, smallTargets: targets.filter(r => r.width < 43.5 || r.height < 43.5), horizontalClipping: targets.filter(r => r.x < -.5 || r.x + r.width > innerWidth + .5), smallInputs: targets.filter(r => ['INPUT', 'TEXTAREA', 'SELECT'].includes(r.tag) && r.font < 16) };
  });
  results.geometry.push({ label, ...info });
  await page.screenshot({ path: path.join(OUT, `${label}-viewport.png`), fullPage: false });
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true });
  check(`${label} no page horizontal overflow`, info.scrollWidth <= info.width + 1, { width: info.width, scrollWidth: info.scrollWidth });
  check(`${label} no horizontally clipped controls`, info.horizontalClipping.length === 0, info.horizontalClipping);
  if (info.width <= 1024) check(`${label} 44px touch controls`, info.smallTargets.length === 0, info.smallTargets);
  if (info.width <= 1024) check(`${label} 8px adjacent target gaps`, info.narrowGaps.length === 0, info.narrowGaps);
  if (info.width <= 390) check(`${label} readable mobile form text`, info.smallInputs.length === 0, info.smallInputs);
}

async function matrix(browser) {
  for (const role of ['member', 'leader', 'admin']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const { context, page } = await fixture(browser, { role, viewport, connected: true });
    try {
      await openPage(page);
      await geometry(page, `${role}-${viewport.width}-empty`);
      check(`${role} no privileged controls`, await page.locator('[data-admin-only],#admin-picker,[data-delete-user]').count() === 0);
      await page.locator('#open-archive').click();
      await page.locator('#archive-dialog').waitFor({ state: 'visible' });
      await geometry(page, `${role}-${viewport.width}-archive`);
      await page.keyboard.press('Escape');
      check(`${role}-${viewport.width} archive Escape closes`, !(await page.locator('#archive-dialog').isVisible()));
      if (await page.locator('[data-view="preview"]').isVisible()) await page.locator('[data-view="preview"]').click();
      await page.locator('#paper-preview').waitFor({ state: 'visible' });
      await geometry(page, `${role}-${viewport.width}-preview`);
    } finally { await context.close(); }
  }
}

async function rendererChecks(browser) {
  const { context, page } = await fixture(browser);
  try {
    await page.goto(`${BASE}/callback/sheets/sheet-model.js`, { waitUntil: 'networkidle' });
    const data = await page.evaluate(async () => {
      const font = new FontFace('Callback Hand', 'url(/callback/sheets/fonts/NanumPenScript-Regular.ttf)');
      document.fonts.add(await font.load());
      const model = await import('/callback/sheets/sheet-model.js?v=20261008-paper2');
      const renderer = await import('/callback/sheets/sheet-renderer.js?v=20261008-paper2');
      const sheet = model.createSheet(new Date('2026-10-08T12:00:00Z'));
      sheet.meta = { name: '획순과 숫자 확인', location: 'QA 전용', team: '테스트 팀', weather: '맑음', theme: '한 획씩 또렷하게' };
      sheet.rows.forEach((row, i) => { row.time = `${String(i + 9).padStart(2, '0')}:00`; row.contact = i; row.stop = i; row.presentation = i; row.close = i; });
      sheet.objections = '숫자 0부터 9까지 정자 획 확인\n0은 짧은 선, 빈칸은 기록 전 상태\n5는 正 한 글자, 6은 正과 한 획';
      sheet.review.loa.good = '실제 종이처럼 읽히는 정확한 정자 획';
      const canvas = document.createElement('canvas');
      const normal = await renderer.renderSheet(canvas, sheet, { scale: 2.5 });
      const png = canvas.toDataURL('image/png');
      const strokes = Array.from({ length: 6 }, (_, i) => renderer.tallyStrokes(i));
      const groups = Array.from({ length: 10 }, (_, i) => renderer.tallyGroups(i));
      const drawn = [], original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { drawn.push(text); return original.call(this, text, ...args); };
      const long = '긴 한글 기록도 끝까지 빠짐없이 읽을 수 있어야 합니다. 정확한 숫자와 회고가 다음 필드를 준비하는 데 도움이 됩니다.\n'.repeat(24);
      sheet.objections = `${long}OBJECTION-END`;
      for (const category of ['loa', 'pitch', 'attitude']) for (const polarity of ['good', 'bad']) sheet.review[category][polarity] = `${long}${category.toUpperCase()}-${polarity.toUpperCase()}-END`;
      const large = await renderer.renderSheet(canvas, sheet, { scale: 2.5 });
      const longPng = canvas.toDataURL('image/png');
      CanvasRenderingContext2D.prototype.fillText = original;
      return { png, longPng, normal, large, strokes, groups, drawn: drawn.join('') };
    });
    check('0..5 正 strokes match requested count', data.strokes.every((strokes, count) => strokes.length === count));
    check('0..9 tally group counts are exact', data.groups.every((groups, count) => groups.reduce((sum, value) => sum + value, 0) === count));
    check('six groups as 正 plus one stroke', JSON.stringify(data.groups[6]) === '[5,1]');
    check('renderer standard image is high resolution', data.normal.width >= 2000 && data.normal.height >= 3000, data.normal);
    check('long text grows image without truncation', data.large.logicalHeight > data.normal.logicalHeight * 2, { normal: data.normal, large: data.large });
    for (const marker of ['OBJECTION-END', 'LOA-GOOD-END', 'LOA-BAD-END', 'PITCH-GOOD-END', 'PITCH-BAD-END', 'ATTITUDE-GOOD-END', 'ATTITUDE-BAD-END']) check(`long export includes final ${marker}`, data.drawn.includes(marker));
    await fs.writeFile(path.join(OUT, 'tally-0-to-9.png'), Buffer.from(data.png.split(',')[1], 'base64'));
    await fs.writeFile(path.join(OUT, 'renderer-long-korean.png'), Buffer.from(data.longPng.split(',')[1], 'base64'));
    results.renderer = { normal: data.normal, long: data.large };
  } finally { await context.close(); }
}

async function integration(browser) {
  const { context, page } = await fixture(browser);
  try {
    await context.addInitScript(() => {
      localStorage.setItem('presence_hub_admin', '1');
      localStorage.setItem('presence_hub_lastauth', String(Date.now()));
      localStorage.setItem('fcos_personal_launch', 'https://hub.presence.co.kr/callback/index.html?u=qa-old&k=qa-only');
    });
    await page.goto(`${BASE}/index.html?qa=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#moreBtn').click();
    const entry = page.locator('a[data-paper-callback]');
    await entry.waitFor({ state: 'visible' });
    check('legacy personal callback URL does not override paper entry', (await entry.getAttribute('href')).endsWith('callback/sheets/index.html'));
    await entry.click();
    await page.waitForURL('**/callback/sheets/index.html');
    await page.locator('#save-sheet').waitFor();
    check('hub main-menu callback entry opens writer', page.url().endsWith('/callback/sheets/index.html'));
  } finally { await context.close(); }
}

async function workflow(browser) {
  const { context, page } = await fixture(browser);
  try {
    await openPage(page);
    await page.locator('#sheet-date').fill('2026-10-08');
    for (const [key, value] of Object.entries({ name: '콜백싯 QA', location: '인천 QA 필드', team: '테스트 팀', weather: '맑음', theme: '끝까지 집중' })) await field(page, `meta.${key}`).fill(value);
    for (let i = 0; i < 10; i++) {
      await field(page, `rows.${i}.time`).fill(`${String(i + 9).padStart(2, '0')}:00`);
      await field(page, `rows.${i}.contact`).fill(String(i));
      await field(page, `rows.${i}.stop`).fill(String(i % 3));
      await field(page, `rows.${i}.presentation`).fill(String(i % 2));
      await field(page, `rows.${i}.close`).fill(String(i === 9 ? 1 : 0));
    }
    if (!(await field(page, 'rows.9.rehash').isVisible())) await field(page, 'rows.9.rehash').locator('xpath=ancestor::details').locator('summary').click();
    await field(page, 'rows.9.rehash').fill('2');
    for (const [key, total] of Object.entries({ contact: 45, stop: 9, presentation: 5, close: 1, rehash: 2 })) check(`visible ${key} auto total is exact`, await page.locator(`#total-${key}`).textContent() === String(total));
    for (const value of ['-1', '1.5']) {
      await field(page, 'rows.0.contact').fill(value);
      await page.locator('#save-sheet').click();
      check(`UI rejects ${value} count`, await field(page, 'rows.0.contact').getAttribute('aria-invalid') === 'true' && await page.locator('#error-banner').isVisible());
      check(`invalid ${value} not added to archive`, await page.locator('#archive-count').textContent() === '0');
    }
    await field(page, 'rows.0.contact').fill('0');
    await field(page, 'goals.contact').fill('50');
    await page.locator('.process-details summary').click();
    await field(page, 'processGoals.contact').fill('시간당 5–7');
    const longText = Array.from({ length: 32 }, (_, i) => `${i + 1}. 고객의 이야기를 끝까지 듣고 필요한 내용을 정리했습니다. 다음 대화에서는 질문과 경청에 더 집중하겠습니다.`).join('\n');
    await field(page, 'objections').fill(longText + '\n마지막 줄 확인: 오브젝션 끝.');
    for (const category of ['loa', 'pitch', 'attitude']) for (const polarity of ['good', 'bad']) await field(page, `review.${category}.${polarity}`).fill(longText + `\n마지막 줄 확인: ${category} ${polarity} 끝.`);
    await page.locator('#save-sheet').click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'workflow-saved.png'), fullPage: true });
    await page.locator('#open-archive').click();
    await page.locator('[data-open-sheet]').first().waitFor();
    check('explicit save creates one record', await page.locator('[data-open-sheet]').count() === 1);
    const firstId = await page.locator('[data-open-sheet]').first().getAttribute('data-open-sheet');
    await page.locator(`[data-open-sheet="${firstId}"]`).click();
    check('saved fields reopen exactly', await field(page, 'meta.name').inputValue() === '콜백싯 QA' && await field(page, 'rows.9.contact').inputValue() === '9');
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.locator('#export-image').click();
    await page.locator('#image-dialog').waitFor({ state: 'visible', timeout: 60000 });
    const download = await downloadPromise;
    await download.saveAs(path.join(OUT, 'long-korean-sheet.png'));
    const png = await fs.readFile(path.join(OUT, 'long-korean-sheet.png'));
    check('export is PNG', png.subarray(1, 4).toString() === 'PNG');
    const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length };
    check('long export retains usable resolution within canvas safety limits', dimensions.width >= 800 && dimensions.height > 2500, dimensions);
    await page.keyboard.press('Escape');
    await field(page, 'meta.theme').fill('수정된 목표');
    await page.locator('#save-sheet').click();
    await page.waitForTimeout(300);
    await page.locator('#open-archive').click();
    check('editing saved record does not duplicate it', await page.locator('[data-open-sheet]').count() === 1 && await page.locator('[data-open-sheet]').first().getAttribute('data-open-sheet') === firstId);
    await page.keyboard.press('Escape');
    await field(page, 'meta.location').fill('새로고침 후 남는 초안');
    await page.waitForTimeout(900);
    await page.reload({ waitUntil: 'networkidle' });
    check('draft restored after reload', await field(page, 'meta.location').inputValue() === '새로고침 후 남는 초안');
    await page.locator('#new-sheet').click();
    await page.locator('#confirm-accept').click();
    await field(page, 'meta.name').fill('같은 날짜의 두 번째 기록');
    await page.locator('#sheet-date').fill('2026-10-08');
    await page.locator('#save-sheet').click();
    await page.waitForFunction(() => document.querySelector('#archive-count').textContent === '2');
    await page.locator('#new-sheet').click();
    await field(page, 'meta.name').fill('이전 날짜 기록');
    await page.locator('#sheet-date').fill('2026-10-06');
    await page.locator('#save-sheet').click();
    await page.waitForFunction(() => document.querySelector('#archive-count').textContent === '3');
    await page.locator('#open-archive').click();
    const ids = await page.locator('[data-open-sheet]').evaluateAll(nodes => nodes.map(node => node.dataset.openSheet));
    const dates = await page.locator('.record-date').allTextContents();
    check('same date records have distinct IDs without overwrite', ids.length === 3 && new Set(ids).size === 3 && ids.includes(firstId));
    check('archive newest date comes first', JSON.stringify(dates) === JSON.stringify(['2026. 10. 08', '2026. 10. 08', '2026. 10. 06']), dates);
    await page.locator('#archive-search').fill('이전 날짜');
    check('archive search filters records', await page.locator('[data-open-sheet]').count() === 1);
    await page.locator('#archive-search').fill('');
    await page.locator('#archive-month').fill('2026-09');
    check('archive month filter shows empty state', await page.locator('[data-open-sheet]').count() === 0 && await page.locator('.archive-empty').isVisible());
    await page.locator('#archive-month').fill('');
    const backupPromise = page.waitForEvent('download');
    await page.locator('#backup-export').click();
    const backup = await backupPromise;
    await backup.saveAs(path.join(OUT, 'records-backup.json'));
    const backupData = JSON.parse(await fs.readFile(path.join(OUT, 'records-backup.json'), 'utf8'));
    check('JSON backup contains every saved record', backupData.format === 'presence-callback-backup' && backupData.sheets.length === 3);
    return { firstId, dimensions };
  } finally { await context.close(); }
}

function calendarModelChecks(model) {
  const sheet = model.createSheet();
  const summary = () => model.getDonorSummary(sheet);
  check('calendar blank record donor count is unknown', summary().count === null && summary().basis === 'unknown');
  sheet.rows[0].rehash = 0;
  check('calendar explicit zero Rehash is known zero', summary().count === 0 && summary().basis === 'rehash');
  sheet.rows[0].rehash = 9;
  sheet.rows[0].donorCases = [model.createDonorCase(sheet.rows[0]), model.createDonorCase(sheet.rows[0]), model.createDonorCase(sheet.rows[0])];
  sheet.rows[0].donorCases[0].donor = true; sheet.rows[0].donorCases[2].donor = true;
  check('calendar checked case count takes precedence over legacy Rehash', summary().count === 2 && summary().basis === 'cases');
  sheet.rows[0].donorCases.forEach(item => { item.donor = false; });
  check('calendar unchecked cases mean known zero without Rehash fallback', summary().count === 0 && summary().basis === 'cases');
  sheet.rows[0].donorCases = [];
  check('calendar empty optional case array retains legacy Rehash fallback', summary().count === 9 && summary().basis === 'rehash');
  sheet.rows[0].rehash = null;
  sheet.source = { type: 'photo', imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', filename: 'synthetic.png', notes: '', duplicateCount: 0, dateBasis: 'written' };
  check('calendar existing photo without donorCount remains valid and unknown', model.validateSheet(sheet).valid && summary().count === null && !('donorCount' in model.normalizeSheet(sheet).source));
  for (const value of [null, 0, 3, 99999]) { sheet.source.donorCount = value; check(`calendar photo donorCount ${value} survives roundtrip`, model.validateSheet(sheet).valid && model.normalizeSheet(sheet).source.donorCount === value && summary().count === value); }
  for (const value of [-1, 0.5, 100000, '3']) { sheet.source.donorCount = value; check(`calendar invalid photo donorCount ${value} rejected`, !model.validateSheet(sheet).valid); }
}

async function calendarMatrix(browser) {
  for (const role of ['member', 'leader', 'admin']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    if (process.argv.includes('--calendar-smoke') && !(role === 'member' && viewport.width === 390)) continue;
    const { context, page } = await fixture(browser, { role, viewport, connected: true });
    const label = `calendar-${role}-${viewport.width}`;
    try {
      await openPage(page);
      await page.evaluate(async () => {
        const query = new URL(document.querySelector('script[type="module"][src]').src).search;
        const model = await import('./sheet-model.js' + query), storage = await import('./storage.js' + query);
        const saved = [];
        const typed = (id, date, count) => { const item = model.createSheet(); item.id = id; item.date = date; item.meta.name = id; if (count !== null) item.rows[0].rehash = count; saved.push(item); return item; };
        typed('legacy-two', '2026-10-03', 2);
        const cases = typed('cases-two', '2026-10-04', 9);
        cases.rows[0].donorCases = [true, false, true].map(donor => ({ ...model.createDonorCase(cases.rows[0]), donor }));
        typed('same-date-one', '2026-10-05', 1); typed('same-date-three', '2026-10-05', 3);
        const photo = (id, date, color, count) => { const item = typed(id, date, null), canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 130; const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 100, 130); item.source = { type: 'photo', imageDataUrl: canvas.toDataURL('image/png'), filename: id + '.png', notes: 'Synthetic test image only', duplicateCount: 0, dateBasis: 'written', ...(count === undefined ? {} : { donorCount: count }) }; return item; };
        photo('photo-unknown', '2026-10-06', '#735c40'); photo('photo-three', '2026-10-07', '#426333', 3);
        typed('september-four', '2026-09-30', 4);
        typed('partial-two', '2026-10-09', 2); photo('partial-unknown', '2026-10-09', '#385866');
        photo('august-unknown', '2026-08-01', '#61495c', null);
        const duplicate = structuredClone(saved.find(item => item.id === 'photo-three')); duplicate.id = 'photo-three-duplicate'; duplicate.updatedAt = '2024-01-01T00:00:00.000Z'; saved.push(duplicate);
        for (const item of saved) await storage.saveSheet(item, { deferSync: true });
      });
      await page.locator('#open-archive').click();
      await page.waitForFunction(() => !document.querySelector('#archive-dialog').hasAttribute('aria-busy'));
      const day = date => page.locator(`[data-calendar-date="${date}"]`);
      check(`${label} calendar is the default archive`, await page.locator('#archive-calendar').isVisible() && !(await page.locator('#archive-list').isVisible()));
      check(`${label} current month and exact donor counts`, await page.locator('#archive-month').inputValue() === '2026-10' && /후원자 2명/.test(await day('2026-10-03').getAttribute('aria-label')) && /후원자 2명/.test(await day('2026-10-04').getAttribute('aria-label')));
      check(`${label} same-date records summed and preserved`, /후원자 4명.*콜백싯 2개/.test(await day('2026-10-05').getAttribute('aria-label')));
      check(`${label} unknown photo is never displayed as zero`, /후원자 미확인/.test(await day('2026-10-06').getAttribute('aria-label')) && await day('2026-10-06').locator('.calendar-donors').textContent() === '미확인');
      check(`${label} verified photo count and exact-photo deduplication`, /후원자 3명.*콜백싯 1개/.test(await day('2026-10-07').getAttribute('aria-label')));
      check(`${label} partial day clearly retains unknown count`, /후원자 2명 및 미확인 기록 있음/.test(await day('2026-10-09').getAttribute('aria-label')));
      check(`${label} monthly known count and unknown records explicit`, /후원자 13명 \+ 미확인 기록 2개 · 콜백싯 8개/.test(await page.locator('#calendar-summary').textContent()));
      await geometry(page, label);
      await day('2026-10-05').click();
      check(`${label} multiple same-date records show picker without loss`, await page.locator('#calendar-selection').isVisible() && await page.locator('#archive-list [data-open-sheet]').count() === 2 && await page.locator('[data-open-sheet="same-date-one"]').isVisible() && await page.locator('[data-open-sheet="same-date-three"]').isVisible());
      check(`${label} date picker transfers keyboard focus to its first record`, await page.evaluate(() => Boolean(document.activeElement?.matches('#archive-list [data-open-sheet]'))));
      await page.locator('#calendar-clear-date').click();
      await day('2026-10-03').focus(); await page.keyboard.press('ArrowRight');
      check(`${label} arrow keys navigate recorded dates`, await page.evaluate(() => document.activeElement?.dataset.calendarDate) === '2026-10-04');
      await day('2026-10-03').click();
      await page.locator('#archive-dialog').waitFor({ state: 'hidden' });
      check(`${label} single typed date opens its saved record directly`, !(await page.locator('#archive-dialog').isVisible()) && await field(page, 'meta.name').inputValue() === 'legacy-two');
      await field(page, 'meta.name').fill('unsaved-calendar-draft');
      await page.locator('#open-archive').click(); await day('2026-10-06').click();
      await page.locator('#source-dialog').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('#source-image').complete);
      const sourceState = { visible: await page.locator('#source-image').isVisible(), name: await field(page, 'meta.name').inputValue(), confirm: await page.locator('#confirm-dialog').isVisible(), error: await page.locator('#source-image-error').textContent() };
      check(`${label} single photo date opens original without altering dirty writer`, sourceState.visible && sourceState.name === 'unsaved-calendar-draft' && !sourceState.confirm, sourceState);
      await page.locator('[data-close-dialog="source-dialog"]').click();
      await page.locator('#calendar-prev').click();
      check(`${label} previous month works`, await page.locator('#archive-month').inputValue() === '2026-09' && /후원자 4명/.test(await day('2026-09-30').getAttribute('aria-label')));
      await page.locator('#calendar-next').click();
      check(`${label} next month works`, await page.locator('#archive-month').inputValue() === '2026-10');
      await page.locator('#archive-month').fill('2026-08');
      check(`${label} all-unknown month never claims zero`, (await page.locator('#calendar-summary').textContent()).startsWith('후원자 미확인'));
      await page.locator('#archive-search').fill('september-four');
      check(`${label} search works across months`, !(await page.locator('#archive-calendar').isVisible()) && await page.locator('#archive-list [data-open-sheet]').count() === 1 && await page.locator('[data-open-sheet="september-four"]').isVisible());
      await page.locator('#archive-search').fill(''); await page.locator('#archive-month').fill('2026-10');
      await page.locator('#archive-view-toggle').click();
      check(`${label} list mode remains available`, !(await page.locator('#archive-calendar').isVisible()) && await page.locator('#archive-list').isVisible() && await page.locator('#archive-list [data-open-sheet]').count() === 8);
      if (role === 'member' && viewport.width === 390) {
        const pending = page.waitForEvent('download'); await page.locator('#backup-export').click(); const download = await pending;
        await download.saveAs(path.join(OUT, 'calendar-backup.json'));
        const backup = JSON.parse(await fs.readFile(path.join(OUT, 'calendar-backup.json'), 'utf8'));
        check('calendar backup retains verified photo count and all original saved IDs', backup.sheets.find(item => item.id === 'photo-three').source.donorCount === 3 && backup.sheets.some(item => item.id === 'same-date-one') && backup.sheets.some(item => item.id === 'same-date-three'));
        check('calendar backup preserves missing versus explicit unknown photo count', !('donorCount' in backup.sheets.find(item => item.id === 'photo-unknown').source) && backup.sheets.find(item => item.id === 'august-unknown').source.donorCount === null);
      }
      await page.keyboard.press('Escape');
      check(`${label} calendar closes by keyboard with writer preserved`, !(await page.locator('#archive-dialog').isVisible()) && await field(page, 'meta.name').inputValue() === 'unsaved-calendar-draft');
    } finally { await context.close(); }
  }
}

async function analysisMatrix(browser) {
  for (const role of ['member', 'leader', 'admin']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const { context, page } = await fixture(browser, { role, viewport, connected: true });
    try {
      await page.goto(`${BASE}/callback/overview/index.html?qa=${Date.now()}`, { waitUntil: 'networkidle' });
      await geometry(page, `overview-${role}-${viewport.width}`);
      check(`overview ${role}-${viewport.width} three required routes`, (await page.locator('#open-calendar').getAttribute('href')).includes('view=archive') && (await page.locator('#open-analysis').getAttribute('href')).includes('analysis'));
      await page.locator('#open-record-options').click(); await page.locator('#record-mode-dialog').waitFor({ state: 'visible' });
      await geometry(page, `overview-dialog-${role}-${viewport.width}`);
      check(`overview ${role}-${viewport.width} auto and manual routes distinct`, (await page.locator('#record-auto').getAttribute('href')) !== (await page.locator('#record-manual').getAttribute('href')));
      await page.keyboard.press('Escape'); check(`overview ${role}-${viewport.width} Escape closes chooser`, !(await page.locator('#record-mode-dialog').isVisible()));
      await page.evaluate(async role => {
        const model = await import('/callback/sheets/sheet-model.js?v=20261008-calendar1');
        const records = [];
        const a = model.createSheet(); a.id = 'analysis-a'; a.date = '2024-05-01'; a.meta.name = '내 기록'; a.rows[0].contact = 6; a.rows[0].stop = 3; a.rows[0].presentation = 2; a.rows[0].close = 1; a.rows[0].rehash = 1; a.review.pitch.good = '상대의 말을 경청했다'; a.review.pitch.bad = '질문 후 기다리기'; a.review.attitude.good = '끝까지 밝게 인사했다'; a.review.attitude.bad = '피곤할 때 호흡을 고르기'; records.push(a);
        const b = model.createSheet(); b.id = 'analysis-b'; b.date = '2024-04-30'; b.meta.name = '내 기록'; b.rows[0].contact = 0; b.rows[0].rehash = 0; records.push(b);
        const c = model.createSheet(); c.id = 'analysis-c'; c.date = '2024-04-05'; c.meta.name = '다른 작성자'; const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20; c.source = { type: 'photo', imageDataUrl: canvas.toDataURL(), filename: 'synthetic.png', notes: '', duplicateCount: 0, dateBasis: 'written', donorCount: 3 }; records.push(c);
        await new Promise((resolve, reject) => { const open = indexedDB.open('presence-paper-sheets-v1', 1); open.onupgradeneeded = () => { const db = open.result; const store = db.createObjectStore('records', { keyPath: 'key' }); store.createIndex('namespace', 'namespace'); db.createObjectStore('drafts', { keyPath: 'namespace' }); }; open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction('records', 'readwrite'), namespace = `user:paper-qa-${role}`; for (const sheet of records) tx.objectStore('records').put({ key: namespace + '\0' + sheet.id, namespace, id: sheet.id, document: { version: 1, revision: 'analysis-fixture', deleted: false, updatedAt: sheet.updatedAt, sheet } }); tx.oncomplete = () => { db.close(); resolve(); }; }; });
      }, role);
      const remoteBefore = results.blockedRemoteRequests.length;
      await page.goto(`${BASE}/callback/analysis/index.html?qa=${Date.now()}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('#load-status').textContent.includes('브라우저에 저장'));
      check(`analysis ${role}-${viewport.width} no cloud reads or writes`, results.blockedRemoteRequests.length === remoteBefore);
      check(`analysis ${role}-${viewport.width} transparent historical default`, await page.locator('#anchor-date').inputValue() === '2024-05-01' && await page.locator('#historical-notice').isVisible());
      check(`analysis ${role}-${viewport.width} confirmed photo counts without invented hourly data`, /4/.test(await page.locator('.metric-card').last().locator('.metric-number').textContent()) && (await page.locator('.metric-card').first().textContent()).includes('1개 미확인'));
      check(`analysis ${role}-${viewport.width} grounded skill and attitude evidence`, (await page.locator('#pitch-review').textContent()).includes('질문 후 기다리기') && (await page.locator('#attitude-review').textContent()).includes('피곤할 때 호흡을 고르기'));
      await geometry(page, `analysis-${role}-${viewport.width}`);
      await page.locator('#author-filter').selectOption('내 기록');
      check(`analysis ${role}-${viewport.width} author filter avoids attributing others`, (await page.locator('#coverage-title').textContent()).includes('2개의 콜백싯') && /^1/.test(await page.locator('.metric-card').last().locator('.metric-number').textContent()));
      for (const choice of ['week', 'quarter', 'half', 'year', 'month']) { await page.locator(`[data-period="${choice}"]`).click(); check(`analysis ${role}-${viewport.width} ${choice} period selectable`, await page.locator(`[data-period="${choice}"]`).getAttribute('aria-pressed') === 'true'); }
      await page.locator('#chart-metric').selectOption('donors'); check(`analysis ${role}-${viewport.width} accessible donor trend`, (await page.locator('#chart svg').getAttribute('aria-label')).includes('후원자'));
      await page.locator('#anchor-today').click(); check(`analysis ${role}-${viewport.width} empty current period`, await page.locator('#empty').isVisible());
      await page.locator('#jump-latest').click(); check(`analysis ${role}-${viewport.width} latest-record jump`, !(await page.locator('#empty').isVisible()));
      check(`analysis ${role}-${viewport.width} no privileged controls`, await page.locator('[data-admin-only],#admin-picker').count() === 0);
    } finally { await context.close(); }
  }
}

async function objectionSmoke(browser) {
  const { context, page } = await fixture(browser, { viewport: { width: 390, height: 844 }, connected: true });
  try {
    await openPage(page); await page.locator('#objections').fill('1. 일반 대화\n2. 후원자 안내');
    await page.locator('[data-objection-donor="1"]').check();
    check('numbered special note can be marked donor', await page.locator('[data-objection-donor="1"]').isChecked() && !(await page.locator('[data-objection-donor="0"]').isChecked()));
    await page.locator('#save-sheet').click(); await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('보관함에 저장됨'));
    await page.reload({ waitUntil: 'networkidle' });
    check('special note donor flag survives save and reload', await page.locator('[data-objection-donor="1"]').isChecked());
    const ink = await page.evaluate(async () => { const q = new URL(document.querySelector('script[type="module"][src]').src).search, storage = await import('./storage.js' + q), renderer = await import('./sheet-renderer.js' + q), model = await import('./sheet-model.js' + q); const sheet = (await storage.loadSheets())[0], calls = [], old = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function(text, ...args) { calls.push({ text, ink: this.fillStyle }); return old.call(this, text, ...args); }; try { await renderer.renderSheet(document.createElement('canvas'), sheet); } finally { CanvasRenderingContext2D.prototype.fillText = old; } return { calls, count: model.getDonorSummary(sheet).count }; });
    check('only checked special note renders red and donor count is one', ink.count === 1 && ink.calls.some(item => item.text.includes('후원자 안내') && isRed(item.ink)) && ink.calls.some(item => item.text.includes('일반 대화') && !isRed(item.ink)));
    await page.goto(`${BASE}/callback/analysis/index.html?qa=${Date.now()}`, { waitUntil: 'networkidle' });
    check('analysis includes checked special note donor count', /^1/.test(await page.locator('.metric-card').last().locator('.metric-number').textContent()));
  } finally { await context.close(); }
}

let browser;
try {
  const model = await modelChecks();
  if (process.argv.includes('--calendar')) calendarModelChecks(model);
  const donorSpecimens = process.argv.includes('--donor') ? donorModelChecks(model) : null;
  await serviceWorkerChecks();
  if (!process.argv.includes('--model')) {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    if (process.argv.includes('--objection')) {
      await objectionSmoke(browser);
    } else if (process.argv.includes('--analysis')) {
      await analysisMatrix(browser);
    } else if (process.argv.includes('--calendar')) {
      await calendarMatrix(browser);
    } else if (donorSpecimens) {
      await donorRendererChecks(browser, donorSpecimens.mixed);
      if (!process.argv.includes('--renderer')) await donorMatrix(browser, donorSpecimens);
    } else {
      await rendererChecks(browser);
    }
    if (!process.argv.includes('--objection') && !process.argv.includes('--analysis') && !process.argv.includes('--calendar') && !donorSpecimens && !process.argv.includes('--renderer')) {
      if (!process.argv.includes('--workflow')) await matrix(browser);
      if (!process.argv.includes('--matrix')) results.workflow = await workflow(browser);
      await integration(browser);
    }
    check('no browser errors', results.browserErrors.length === 0, results.browserErrors);
  }
  results.pass = true;
} catch (error) {
  results.pass = false; results.failure = error.stack;
  console.error(error.stack); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  results.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ pass: results.pass, checks: results.checks.length, passed: results.checks.filter(x => x.pass).length, artifacts: OUT, failure: results.failure?.split('\n')[0] }, null, 2));
}
