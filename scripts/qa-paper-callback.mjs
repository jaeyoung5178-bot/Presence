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
      const model = await import('/callback/sheets/sheet-model.js');
      const renderer = await import('/callback/sheets/sheet-renderer.js');
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

let browser;
try {
  await modelChecks();
  await serviceWorkerChecks();
  if (!process.argv.includes('--model')) {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    await rendererChecks(browser);
    if (!process.argv.includes('--renderer')) {
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
