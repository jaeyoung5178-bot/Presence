import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const runtime = process.env.CODEX_NODE_RUNTIME || '/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.NETWORKING_QA_URL || 'http://127.0.0.1:8768';
const out = '/tmp/presence-networking-qa';
await mkdir(out, { recursive: true });
const checks = [], failures = [];
function check(name, value, detail = '') { (value ? checks : failures).push({ name, detail }); }
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });

async function geometry(page, tag) {
  const result = await page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width && r.height && s.visibility !== 'hidden' && s.display !== 'none'; };
    const controls = [...document.querySelectorAll('button,a,input,select,textarea,[role="button"]')].filter(visible);
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      clipped: controls.filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => el.id || el.textContent.trim().slice(0, 40)),
      small: innerWidth <= 1024 ? controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(el => ({ id: el.id, text: el.textContent.trim().slice(0, 30), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })) : [],
      broken: [...document.images].filter(visible).filter(el => !el.complete || !el.naturalWidth).map(el => el.getAttribute('src')),
    };
  });
  check(`${tag}: no horizontal overflow`, !result.overflow);
  check(`${tag}: controls within width`, !result.clipped.length, JSON.stringify(result.clipped));
  check(`${tag}: 44px controls`, !result.small.length, JSON.stringify(result.small));
  check(`${tag}: images load`, !result.broken.length, JSON.stringify(result.broken));
}

try {
  for (const role of ['member', 'leader', 'admin']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const tag = `${role}-${viewport.width}`;
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(({ role }) => {
      localStorage.setItem('fcos_hub_identity', JSON.stringify({ uid: `networking-qa-${role}`, name: `QA ${role}`, role }));
    }, { role });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}/networking/`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    await geometry(page, `${tag} empty`);
    check(`${tag}: closed detail hidden`, !(await page.locator('#detail').isVisible()));
    check(`${tag}: no privileged UI`, role === 'admin' || await page.locator('[data-admin-only],#admin-panel').count() === 0);
    await page.screenshot({ path: `${out}/${tag}-empty.png`, fullPage: true });
    await page.locator('#newRecord').click();
    await geometry(page, `${tag} form`);
    check(`${tag}: dialog traps focus`, await page.evaluate(() => document.querySelector('#editor').contains(document.activeElement)));
    const title = 'QA <img src=x onerror=alert(1)> ' + '긴 제목과 대화 '.repeat(8);
    await page.locator('[name="title"]').fill(title);
    await page.locator('[name="place"]').fill('서울 성수 카페');
    await page.locator('[name="duration"]').fill('90');
    await page.locator('[name="conversation"]').fill('성장에 대한 대화\n'.repeat(100));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    for (const id of ['photos','captures']) await page.locator(`#${id}`).setInputFiles({ name: `${id}-qa.png`, mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => !document.querySelector('#saveRecord').disabled);
    await page.locator('#saveRecord').click();
    await page.locator('#detail[open]').waitFor();
    await page.waitForFunction(() => document.querySelector('#detailTitle').textContent.includes('QA <img'));
    check(`${tag}: XSS is text`, await page.locator('#detailTitle').textContent() === title.trim() && await page.locator('#detailTitle img').count() === 0, await page.locator('#detailTitle').textContent());
    check(`${tag}: photo and capture saved`, await page.locator('#detailBody img').count() === 2);
    await geometry(page, `${tag} long detail`);
    await page.screenshot({ path: `${out}/${tag}-detail.png`, fullPage: true });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#detail[open]').waitFor();
    check(`${tag}: reload retains attachments`, await page.locator('#detailBody img').count() === 2);
    await page.locator('#editRecord').click();
    await page.locator('#photosPreview .remove').click();
    await page.locator('[name="response"]').fill('좋았다는 카톡을 받았어요.');
    await page.locator('#saveRecord').click();
    await page.locator('#editor').waitFor({ state: 'hidden' });
    check(`${tag}: remove photo preserves capture`, await page.locator('#detailBody img').count() === 1);
    await page.locator('[data-close="detail"]').click();
    await page.locator('#newRecord').click();
    await page.locator('[name="title"]').fill('같은 날 두 번째 만남');
    await page.locator('#saveRecord').click();
    await page.locator('#detail[open]').waitFor();
    await page.locator('[data-close="detail"]').click();
    check(`${tag}: same date independent records`, await page.locator('.record-card').count() === 2);
    await page.locator('#search').fill('두 번째');
    check(`${tag}: search filters`, await page.locator('.record-card').count() === 1);
    await page.locator('#teamTab').click();
    check(`${tag}: team changes screen`, await page.locator('#scopeTitle').textContent() === '함께 넓어지는 팀의 연결' && await page.locator('.record-card').count() === 0);
    await page.locator('#newRecord').click();
    await page.locator('[name="owner"]').fill('QA 팀원');
    await page.locator('[name="title"]').fill('팀원의 네트워킹');
    await page.locator('#saveRecord').click();
    await page.locator('#detail[open]').waitFor();
    await page.locator('[data-close="detail"]').click();
    await geometry(page, `${tag} team`);
    await page.screenshot({ path: `${out}/${tag}-team.png`, fullPage: true });
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadPromise;
    await download.saveAs(`${out}/${tag}-backup.json`);
    page.on('dialog', dialog => dialog.accept());
    await page.locator('.record-card').click();
    await page.locator('#deleteRecord').click();
    await page.waitForFunction(() => !document.querySelector('#detail').open);
    check(`${tag}: record deleted`, await page.locator('.record-card').count() === 0);
    await page.locator('#import').setInputFiles(`${out}/${tag}-backup.json`);
    await page.locator('.record-card').waitFor();
    check(`${tag}: backup restores deleted record`, await page.locator('.record-card').count() === 1);
    await page.locator('#import').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"bad","records":[]}') });
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('バック') || document.querySelector('#toast').textContent.includes('지원하는'));
    check(`${tag}: invalid backup retains records`, await page.locator('.record-card').count() === 1);
    check(`${tag}: no runtime errors`, !errors.length, JSON.stringify(errors));
    await context.close();
  }
  const errorContext = await browser.newContext();
  await errorContext.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await errorContext.addInitScript(() => { indexedDB.open = () => { throw new Error('Synthetic unavailable storage'); }; });
  const errorPage = await errorContext.newPage();
  await errorPage.goto(`${base}/networking/`, { waitUntil: 'networkidle' });
  check('DB failure shows error and prevents false save', await errorPage.locator('#newRecord').isDisabled() && (await errorPage.locator('#records').textContent()).includes('저장 공간을 열지 못'));
  await errorContext.close();
} finally {
  await browser.close();
  await writeFile(`${out}/report.json`, JSON.stringify({ checks, failures }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, failed: failures.length, failures }, null, 2));
}
assert.equal(failures.length, 0, 'Networking QA failed; inspect /tmp/presence-networking-qa/report.json');
