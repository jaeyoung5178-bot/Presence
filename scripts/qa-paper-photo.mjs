import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768';
const OUT = process.env.QA_OUTPUT || '/tmp/presence-paper-photo-qa';
const require = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const report = { base: BASE, checks: [], errors: [], remoteRequests: [], startedAt: new Date().toISOString() };
const check = (name, pass, details) => { report.checks.push({ name, pass: !!pass, ...(details === undefined ? {} : { details }) }); assert.ok(pass, `${name}${details === undefined ? '' : ': ' + JSON.stringify(details)}`); };
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lU8AAAAASUVORK5CYII=';
await fs.mkdir(OUT, { recursive: true });

async function modelChecks() {
  const source = await fs.readFile(path.join(ROOT, 'callback/sheets/sheet-model.js'), 'utf8');
  const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const plain = model.createSheet(new Date('2026-10-08T12:00:00Z'));
  check('plain sheet remains valid without a source', model.validateSheet(plain).valid && !('source' in model.normalizeSheet(plain)));
  const photo = { ...plain, source: { type: 'photo', imageDataUrl: pixel, filename: 'synthetic-test.png', notes: '비공개 사진을 사용하지 않는 합성 QA 이미지', duplicateCount: 2, dateBasis: 'capture' } };
  check('synthetic PNG source is valid', model.validateSheet(photo).valid);
  const normalized = model.normalizeSheet(photo);
  check('normalization preserves all original photo fields exactly', JSON.stringify(normalized.source) === JSON.stringify(photo.source));
  normalized.source.notes = 'separate';
  check('normalization independently clones source metadata', photo.source.notes !== normalized.source.notes);
  const added = model.normalizeSheet({ ...photo, source: { ...photo.source, executable: '<script>bad</script>' } });
  check('unrecognized source fields are not imported', !('executable' in added.source));
  for (const dateBasis of ['written', 'capture', 'unknown']) check(`date basis ${dateBasis} allowed`, model.validateSheet({ ...photo, source: { ...photo.source, dateBasis } }).valid);
  for (const filename of ['../private.png', 'folder/image.png', '..\\private.jpg', '.', '..', 'bad\nname.png', 'bad\u0000name.png', '', 'x'.repeat(256)]) check(`non-basename filename rejected ${JSON.stringify(filename.slice(0, 30))}`, !model.validateSheet({ ...photo, source: { ...photo.source, filename } }).valid);
  for (const imageDataUrl of ['https://example.com/image.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=', pixel.replace('image/png', 'image/gif'), pixel + '!', 'data:image/png;base64,AAAA']) check('unsafe, malformed, or unsupported image rejected', !model.validateSheet({ ...photo, source: { ...photo.source, imageDataUrl } }).valid, imageDataUrl.slice(0, 55));
  const original = Buffer.from(pixel.split(',')[1], 'base64');
  const imageAtSize = bytes => 'data:image/png;base64,' + Buffer.concat([original, Buffer.alloc(bytes - original.length)]).toString('base64');
  check('exact 2MiB decoded source accepted', model.validateSheet({ ...photo, source: { ...photo.source, imageDataUrl: imageAtSize(2 * 1024 * 1024) } }).valid);
  check('2MiB plus one decoded byte rejected', !model.validateSheet({ ...photo, source: { ...photo.source, imageDataUrl: imageAtSize(2 * 1024 * 1024 + 1) } }).valid);
  const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(28)]).toString('base64');
  check('JPEG signature allowed', model.validateSheet({ ...photo, source: { ...photo.source, imageDataUrl: jpeg } }).valid);
  for (const change of [{ notes: 'x'.repeat(12001) }, { duplicateCount: -1 }, { duplicateCount: 1.5 }, { duplicateCount: 10000 }, { dateBasis: 'guessed' }, { type: 'url' }]) check('invalid source metadata rejected', !model.validateSheet({ ...photo, source: { ...photo.source, ...change } }).valid, Object.keys(change));
}

async function fixture(browser, viewport) {
  const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (/firebasedatabase\.app$|firebaseio\.com$|googleapis\.com$|gstatic\.com$/.test(url.hostname)) {
      report.remoteRequests.push({ method: route.request().method(), host: url.hostname, path: url.pathname });
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null', headers: { 'access-control-allow-origin': '*' } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(`${BASE}/callback/sheets/index.html?photo-qa=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.locator('#save-sheet').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const source = await page.evaluate(async () => {
    const model = await import('./sheet-model.js?v=20261008-paper2');
    const storage = await import('./storage.js?v=20261008-paper2');
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 900;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff8e4'; ctx.fillRect(0, 0, 600, 900);
    ctx.fillStyle = '#244d76'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('SYNTHETIC QA PHOTO', 44, 75);
    ctx.font = '25px sans-serif'; ctx.fillText('No private photographs', 44, 120);
    ctx.strokeStyle = '#244d76'; ctx.strokeRect(44, 160, 512, 620);
    ctx.fillStyle = '#75b09c'; ctx.fillRect(44, 160, 512, 100);
    ctx.fillStyle = '#244d76'; ctx.fillText('BOTTOM OF ORIGINAL', 44, 840);
    const sheet = model.createSheet(new Date('2024-04-16T12:00:00Z'));
    sheet.id = 'qa-source-photo-record'; sheet.meta.name = '합성 사진 QA'; sheet.meta.theme = '사진 원본 보관';
    sheet.source = { type: 'photo', imageDataUrl: canvas.toDataURL('image/png'), filename: 'synthetic-original.png', notes: '촬영 날짜 기준의 합성 이미지입니다.\n끝줄: 원본 메모 보존.', duplicateCount: 2, dateBasis: 'capture' };
    await storage.saveSheet(sheet, { importOriginal: true });
    return sheet.source;
  });
  return { context, page, source };
}

async function dialogGeometry(page, label) {
  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector('#source-dialog'), rect = dialog.getBoundingClientRect();
    const controls = [...dialog.querySelectorAll('button,a[href]')].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height; }).map(el => { const r = el.getBoundingClientRect(); return { label: el.id || el.getAttribute('aria-label'), x: r.x, y: r.y, width: r.width, height: r.height }; });
    return { windowWidth: innerWidth, pageWidth: document.documentElement.scrollWidth, dialog: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, controls, activeInside: dialog.contains(document.activeElement) };
  });
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: false });
  check(`${label} page has no horizontal overflow`, geometry.pageWidth <= geometry.windowWidth + 1, geometry);
  check(`${label} source dialog stays inside viewport`, geometry.dialog.x >= 0 && geometry.dialog.x + geometry.dialog.width <= geometry.windowWidth + 1);
  check(`${label} source dialog owns keyboard focus`, geometry.activeInside);
  check(`${label} all photo controls meet 44px target size`, geometry.controls.every(r => r.width >= 43.5 && r.height >= 43.5), geometry.controls);
  check(`${label} all photo controls avoid horizontal clipping`, geometry.controls.every(r => r.x >= -.5 && r.x + r.width <= geometry.windowWidth + .5), geometry.controls);
}

async function photoWorkflow(browser, viewport) {
  const { context, page, source } = await fixture(browser, viewport);
  const field = key => page.locator(`[data-field="${key}"]`);
  try {
    await field('meta.name').fill('버리면 안 되는 작성 중 초안');
    await field('rows.0.contact').fill('7');
    await page.waitForTimeout(650);
    const initialDraft = await page.evaluate(async () => (await import('./storage.js?v=20261008-paper2')).loadDraft());
    await page.locator('#open-archive').click();
    await page.locator('#archive-dialog').waitFor({ state: 'visible' });
    check(`${viewport.width} archive labels source record`, await page.locator('.source-badge').count() === 1 && await page.locator('[data-source-thumb]').count() === 1);
    await page.locator('[data-open-sheet="qa-source-photo-record"]').click();
    await page.locator('#source-dialog').waitFor({ state: 'visible' });
    check(`${viewport.width} original photo opens without discard confirmation`, !(await page.locator('#confirm-dialog').isVisible()));
    check(`${viewport.width} original source image is shown`, await page.locator('#source-image').getAttribute('src') === source.imageDataUrl);
    check(`${viewport.width} date basis and original notes are visible`, (await page.locator('#source-date-basis').textContent()).includes('촬영') && (await page.locator('#source-notes').textContent()).includes('원본 메모 보존'));
    await dialogGeometry(page, `source-${viewport.width}`);
    await page.locator('#source-zoom').click();
    await dialogGeometry(page, `source-${viewport.width}-zoom`);
    await page.locator('#source-zoom').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#source-download').click();
    const download = await downloadPromise;
    await download.saveAs(path.join(OUT, `original-${viewport.width}.png`));
    check(`${viewport.width} original download is byte-identical`, (await fs.readFile(path.join(OUT, `original-${viewport.width}.png`))).equals(Buffer.from(source.imageDataUrl.split(',')[1], 'base64')));
    await page.keyboard.press('Escape');
    check(`${viewport.width} Escape closes original dialog`, !(await page.locator('#source-dialog').isVisible()));
    if (await page.locator('#archive-dialog').isVisible()) await page.keyboard.press('Escape');
    const afterView = await page.evaluate(async () => (await import('./storage.js?v=20261008-paper2')).loadDraft());
    check(`${viewport.width} viewing original leaves writer and draft unchanged`, await field('meta.name').inputValue() === '버리면 안 되는 작성 중 초안' && JSON.stringify(initialDraft) === JSON.stringify(afterView));
    await page.locator('#open-archive').click();
    await page.locator('[data-open-sheet="qa-source-photo-record"]').click();
    await page.locator('#source-transcribe').click();
    await page.locator('#confirm-dialog').waitFor({ state: 'visible' });
    check(`${viewport.width} transcribing requires explicit dirty-draft confirmation`, await page.locator('#confirm-copy').textContent() !== '');
    await page.locator('#confirm-dialog button[value="cancel"]').click();
    check(`${viewport.width} cancelled transcription preserves draft`, await field('meta.name').inputValue() === '버리면 안 되는 작성 중 초안');
    await page.locator('#source-transcribe').click();
    await page.locator('#confirm-accept').click();
    await page.locator('#source-dialog').waitFor({ state: 'hidden' });
    check(`${viewport.width} accepted transcription loads source record`, await field('meta.name').inputValue() === '합성 사진 QA' && await page.locator('#open-source').isVisible());
    await field('rows.0.contact').fill('9');
    await field('review.loa.good').fill('원본을 보며 정리한 합성 기록');
    await page.locator('#save-sheet').click();
    await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('보관함에 저장됨'));
    const saved = await page.evaluate(async () => (await import('./storage.js?v=20261008-paper2')).loadSheets());
    check(`${viewport.width} editing and saving retains exact photo source`, saved.length === 1 && saved[0].rows[0].contact === 9 && JSON.stringify(saved[0].source) === JSON.stringify(source));
    await field('meta.theme').fill('사진과 함께 복원할 초안');
    await page.waitForTimeout(650);
    await page.reload({ waitUntil: 'networkidle' });
    const reloaded = await page.evaluate(async () => (await import('./storage.js?v=20261008-paper2')).loadDraft());
    check(`${viewport.width} photo source and edits survive draft reload`, reloaded.meta.theme === '사진과 함께 복원할 초안' && JSON.stringify(reloaded.source) === JSON.stringify(source));
    await page.locator('#open-source').click();
    check(`${viewport.width} editor original button still opens exact photo`, await page.locator('#source-image').getAttribute('src') === source.imageDataUrl);
    await page.keyboard.press('Escape');
    await page.locator('#open-archive').click();
    const backupPromise = page.waitForEvent('download');
    await page.locator('#backup-export').click();
    const backup = await backupPromise;
    await backup.saveAs(path.join(OUT, `photo-backup-${viewport.width}.json`));
    const backupData = JSON.parse(await fs.readFile(path.join(OUT, `photo-backup-${viewport.width}.json`), 'utf8'));
    check(`${viewport.width} JSON backup retains original photo bytes and metadata`, backupData.sheets.length === 1 && JSON.stringify(backupData.sheets[0].source) === JSON.stringify(source));
  } finally { await context.close(); }
}

async function backupBatching(browser, { large = false } = {}) {
  const { context, page } = await fixture(browser, { width: 1440, height: 900 });
  const label = large ? 'byte-limit' : 'photo-count';
  try {
    const expected = await page.evaluate(async large => {
      const model = await import('./sheet-model.js?v=20261008-paper2'), storage = await import('./storage.js?v=20261008-paper2');
      const original = (await storage.loadSheets())[0];
      let imageDataUrl = original.source.imageDataUrl;
      if (large) {
        const png = atob(imageDataUrl.split(',')[1]);
        imageDataUrl = 'data:image/png;base64,' + btoa(png + '\0'.repeat(2 * 1024 * 1024 - png.length));
      }
      const additional = large ? 8 : 25;
      for (let i = 0; i < additional; i++) {
        const sheet = model.createSheet(new Date('2024-04-16T12:00:00Z'));
        sheet.id = `batch-${large ? 'large' : 'small'}-${i}`;
        sheet.meta.name = `Synthetic batch ${i}`;
        sheet.source = { ...original.source, imageDataUrl, filename: `synthetic-batch-${i}.png` };
        await storage.saveSheet(sheet, { importOriginal: true, deferSync: true });
      }
      return additional + 1;
    }, large);
    await page.locator('#open-archive').click();
    await page.locator('#archive-dialog').waitFor({ state: 'visible' });
    const firstPromise = page.waitForEvent('download');
    await page.locator('#backup-export').click();
    await page.locator('#backup-downloads').waitFor({ state: 'visible' });
    const links = page.locator('#backup-downloads a[download]');
    check(`${label} oversized archive exposes two manual download parts`, await links.count() === 2);
    const records = [];
    for (let i = 0; i < 2; i++) {
      let download;
      if (i === 0) download = await firstPromise;
      else { const promise = page.waitForEvent('download'); await links.nth(i).click(); download = await promise; }
      const filename = path.join(OUT, `backup-${label}-${i + 1}.json`);
      await download.saveAs(filename);
      const contents = await fs.readFile(filename);
      const parsed = JSON.parse(contents.toString('utf8'));
      check(`${label} backup part ${i + 1} stays below importer 20MiB limit`, contents.byteLength < 20 * 1024 * 1024, contents.byteLength);
      check(`${label} backup part ${i + 1} stays within 25 photo records`, parsed.sheets.length <= 25, parsed.sheets.length);
      check(`${label} backup part ${i + 1} preserves photo sources`, parsed.sheets.every(record => record.source?.imageDataUrl.startsWith('data:image/png;base64,') && record.source.filename.endsWith('.png')));
      records.push(...parsed.sheets);
    }
    check(`${label} multipart backup keeps every record exactly once`, records.length === expected && new Set(records.map(record => record.id)).size === expected, records.length);
  } finally { await context.close(); }
}

let browser;
try {
  await modelChecks();
  if (!process.argv.includes('--model')) {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    if (!process.argv.includes('--backup')) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) await photoWorkflow(browser, viewport);
    await backupBatching(browser);
    await backupBatching(browser, { large: true });
    check('no real Firebase requests from guest photo workflows', report.remoteRequests.length === 0, report.remoteRequests);
    check('no browser or console errors', report.errors.length === 0, report.errors);
  }
  report.pass = true;
} catch (error) { report.pass = false; report.failure = error.stack; console.error(error.stack); process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, passed: report.checks.filter(x => x.pass).length, artifacts: OUT }, null, 2));
}
