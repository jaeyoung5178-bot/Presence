import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const runtime = process.env.CODEX_NODE_RUNTIME || '/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.NETWORKING_QA_URL || 'http://127.0.0.1:8768';
const out = process.env.NETWORKING_QA_OUT || '/tmp/presence-networking-qa';
await mkdir(out, { recursive: true });
const checks = [], failures = [];
function check(name, value, detail = '') { (value ? checks : failures).push({ name, detail }); }
const wire = new Map();
const mockStore = `
const uid = () => localStorage.getItem('networking_qa_uid');
export const auth = {async restore(){return uid()?{uid:uid(),name:'QA'}:null},async login(id){localStorage.setItem('networking_qa_uid',id);return {uid:id,name:id}},async logout(){localStorage.removeItem('networking_qa_uid')}};
export async function firebase(){return {db:{},auth:{currentUser:{uid:'qa-auth',getIdToken:async()=>uid()}},d:{ref:(_,p)=>p,get:async p=>({val:()=>p.startsWith('authSessions/')?{userUid:uid()}:null}),onValue(p,cb){let closed=false,last='';const tick=async()=>{const v=p==='.info/connected'?true:p.startsWith('authSessions/')?{userUid:uid()}:await fetch('/__qa/read?path='+encodeURIComponent(p)).then(r=>r.json());const json=JSON.stringify(v);if(!closed&&json!==last){last=json;cb({val:()=>v})}};tick();const timer=setInterval(tick,700);return()=>{closed=true;clearInterval(timer)}}}}}
`;
async function installMock(context, uid) {
  await context.addInitScript(uid => { if (!sessionStorage.getItem('networking_qa_initialized')) { localStorage.setItem('networking_qa_uid', uid); sessionStorage.setItem('networking_qa_initialized','1'); } }, uid);
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.endsWith('/recruiting/store.js')) return route.fulfill({contentType:'text/javascript',body:mockStore});
    if (url.pathname === '/__qa/read') { const path = url.searchParams.get('path'); const value = Object.fromEntries([...wire].filter(([k])=>k.startsWith(path+'/')).map(([k,v])=>[k.slice(path.length+1),v])); return route.fulfill({json:value}); }
    if (url.hostname.endsWith('firebasedatabase.app')) {
      const headers = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,PUT,OPTIONS','Access-Control-Allow-Headers':'*','Access-Control-Expose-Headers':'ETag' };
      if (req.method() === 'OPTIONS') return route.fulfill({status:204,headers});
      const path = url.pathname.slice(1,-5), owner = url.searchParams.get('auth');
      if (!path.startsWith(`userPreferences/${owner}/networkingArchive/`)) return route.fulfill({status:403,json:{},headers});
      const old = wire.get(path) || null, etag = old ? `"${old.revision || old.createdAt}"` : 'null_etag';
      if (req.method() === 'PUT') { if (req.headers()['if-match'] && req.headers()['if-match'] !== etag) return route.fulfill({status:412,json:{}}); wire.set(path,JSON.parse(req.postData())); }
      return route.fulfill({json:wire.get(path)||null,headers:{...headers,ETag:etag}});
    }
    return url.origin === new URL(base).origin && ['GET','HEAD'].includes(req.method()) ? route.continue() : route.abort();
  });
}
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
    if (process.env.NETWORKING_QA_CORE_ONLY === '1') continue;
    const tag = `${role}-${viewport.width}`;
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    await installMock(context, `qa-${tag}`);
    await context.addInitScript(({ role }) => {
      localStorage.setItem('fcos_hub_identity', JSON.stringify({ uid: `networking-qa-${role}`, name: `QA ${role}`, role }));
    }, { role });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}/networking/?v=20261026-networking1`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => !document.querySelector('#newRecord').disabled);
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
    for (const id of ['photos','captures']) { await page.locator(`#${id}`).setInputFiles({ name: `${id}-qa.png`, mimeType: 'image/png', buffer: png }); await page.waitForFunction(() => !document.querySelector('#saveRecord').disabled); }
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
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('기록'));
    check(`${tag}: backup respects deletion tombstone`, await page.locator('.record-card').count() === 0);
    await page.locator('#import').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"bad","records":[]}') });
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('バック') || document.querySelector('#toast').textContent.includes('지원하는'));
    check(`${tag}: invalid backup retains records`, await page.locator('.record-card').count() === 0);
    check(`${tag}: no runtime errors`, !errors.length, JSON.stringify(errors));
    await context.close();
  }
  const devices = await Promise.all([browser.newContext(),browser.newContext()]);
  for (const device of devices) await installMock(device,'qa-shared-devices');
  const [one,two] = await Promise.all(devices.map(d=>d.newPage()));
  await Promise.all([one,two].map(p=>p.goto(`${base}/networking/`)));
  await Promise.all([one,two].map(p=>p.waitForFunction(()=>!document.querySelector('#newRecord').disabled)));
  await one.locator('#newRecord').click(); await one.locator('[name="title"]').fill('다른 기기에 보이는 만남'); await one.locator('#saveRecord').click();
  await two.waitForFunction(()=>document.querySelectorAll('.record-card').length===1);
  check('independent contexts share same uid server archive',await two.locator('.record-card').textContent().then(s=>s.includes('다른 기기에')));
  await two.reload(); await two.waitForFunction(()=>document.querySelectorAll('.record-card').length===1);
  check('new device reload reads server archive',await two.locator('.record-card').count()===1);
  await two.locator('#logout').click();
  check('logout wipes record DOM',await two.locator('.record-card').count()===0 && await two.locator('#accountPanel').isVisible());
  await two.locator('#loginForm [name="id"]').fill('qa-other-person'); await two.locator('#loginForm [name="password"]').fill('mock'); await two.locator('#loginButton').click();
  await two.waitForFunction(()=>!document.querySelector('#newRecord').disabled);
  check('different uid never sees prior account records',await two.locator('.record-card').count()===0);
  await Promise.all(devices.map(d=>d.close()));
  const errorContext = await browser.newContext();
  await installMock(errorContext, '');
  await errorContext.addInitScript(() => { indexedDB.open = () => { throw new Error('Synthetic unavailable storage'); }; });
  const errorPage = await errorContext.newPage();
  await errorPage.goto(`${base}/networking/?v=20261026-networking1`, { waitUntil: 'networkidle' });
  check('logged out DB failure cannot report saved success', await errorPage.locator('#newRecord').isDisabled() && await errorPage.locator('#accountPanel').isVisible());
  await errorContext.close();
  if (process.env.NETWORKING_QA_HUB === '1') for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', route => ['GET','HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
    await context.addInitScript(() => { localStorage.setItem('presence_hub_admin','1'); localStorage.setItem('presence_hub_lastauth',String(Date.now())); });
    const page = await context.newPage();
    await page.goto(`${base}/?v=networking-qa-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#moreBtn').click();
    const link = page.locator('[data-hub-category="NETWORK"]');
    await link.waitFor({ state: 'visible' });
    check(`hub-${viewport.width}: networking in learning category`, await link.evaluate(el => el.closest('[data-hub-section]')?.dataset.hubSection === 'learn' || el.parentElement.previousElementSibling?.textContent.includes('배움과 아카이브') || el.parentElement.parentElement.textContent.includes('배움과 아카이브')));
    check(`hub-${viewport.width}: icon loaded`, await link.locator('img').evaluate(img => img.complete && img.naturalWidth > 0));
    const box = await link.boundingBox();
    check(`hub-${viewport.width}: link inside viewport`, box.x >= 0 && box.x + box.width <= viewport.width + 1);
    await page.screenshot({ path: `${out}/hub-${viewport.width}-menu.png`, fullPage: true });
    await link.click();
    await page.waitForURL('**/networking/index.html');
    check(`hub-${viewport.width}: navigation works`, await page.locator('#newRecord').isVisible());
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${out}/report.json`, JSON.stringify({ checks, failures }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, failed: failures.length, failures }, null, 2));
}
assert.equal(failures.length, 0, 'Networking QA failed; inspect /tmp/presence-networking-qa/report.json');
