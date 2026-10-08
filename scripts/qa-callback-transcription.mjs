import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createSheet, validateSheet, normalizeSheet, getMetricReading, getReviewReading, getDonorSummary } from '../callback/sheets/sheet-model.js';
import { analyze, metricValue } from '../callback/analysis/analysis-model.js';

const require = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768', OUT = process.env.QA_OUTPUT || '/tmp/presence-transcription-qa';
const checks = [], errors = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lU8AAAAASUVORK5CYII=';
function sample() {
  const sheet = createSheet(new Date('2024-05-01T12:00:00Z')); sheet.id = 'transcription-main'; sheet.meta.name = '사진 전사 확인용';
  sheet.source = { type: 'photo', imageDataUrl: pixel, filename: 'synthetic.png', notes: '', duplicateCount: 0, dateBasis: 'written', donorCount: 9, transcription: { version: 1, status: 'partial', totals: { contact: 40, stop: 20, presentation: 10, close: 8, rehash: 2 }, goals: { contact: 50, stop: 25, presentation: 15, close: 10, rehash: 3 }, review: { loa: { good: '목표에 집중했다', bad: '' }, pitch: { good: '상대의 말을 경청했다', bad: '질문 후 말을 짧게 하자 <img src=x onerror=alert(1)>' }, attitude: { good: '끝까지 밝은 마음을 유지했다', bad: '피곤할 때 호흡을 고르기. '.repeat(40) + '마지막 회고 문장' } }, notes: '확인된 결과만 전사. 판독 불가 칸은 비움.' } };
  return sheet;
}
const photo = sample();
check('transcription validates', validateSheet(photo).valid);
const normalized = normalizeSheet(photo);
check('transcription exact roundtrip', JSON.stringify(normalized.source.transcription) === JSON.stringify(photo.source.transcription));
normalized.source.transcription.totals.contact = 7;
check('transcription deeply cloned', photo.source.transcription.totals.contact === 40);
const injected = structuredClone(photo); injected.source.transcription.hidden = 'unsafe'; injected.source.transcription.totals.unknown = 7; injected.source.transcription.review.pitch.extra = 'unsafe';
const clean = normalizeSheet(injected).source.transcription;
check('transcription whitelist strips unknown fields', !('hidden' in clean) && !('unknown' in clean.totals) && !('extra' in clean.review.pitch));
for (const mutate of [s => s.source.transcription.version = 2, s => s.source.transcription.status = 'guess', s => s.source.transcription.totals.contact = -1, s => s.source.transcription.totals.stop = 1.5, s => delete s.source.transcription.totals.close, s => s.source.transcription.goals.contact = 100000, s => s.source.transcription.review.loa.good = null, s => s.source.transcription.notes = 'a'.repeat(12001)]) {
  const invalid = sample(); mutate(invalid); check('invalid transcription rejected', !validateSheet(invalid).valid);
}
check('photo total fallback', getMetricReading(photo, 'contact').value === 40 && metricValue(photo, 'contact') === 40);
check('corrected transcription rehash overrides legacy donor count', getDonorSummary(photo).count === 2);
const unconfirmedDonor = sample(); unconfirmedDonor.source.transcription.totals.rehash = null;
check('transcription unknown rehash suppresses unreliable legacy count', getDonorSummary(unconfirmedDonor).count === null);
const manual = sample(); manual.rows[0].contact = 0; manual.rows[0].stop = 0; manual.rows[0].rehash = 0; manual.review.pitch.good = '직접 입력한 회고';
check('manual zero overrides transcribed positive total', metricValue(manual, 'contact') === 0 && getDonorSummary(manual).count === 0);
check('manual review priority is per field', getReviewReading(manual, 'pitch', 'good').text === '직접 입력한 회고' && getReviewReading(manual, 'pitch', 'bad').basis === 'transcription');
check('unknown review stays blank', getReviewReading(photo, 'loa', 'bad').text === '');
const result = analyze([photo], '2024-05-01', 'month');
check('photo aggregate coverage and rates use real daily totals', result.current.metrics.contact.total === 40 && result.current.metrics.contact.transcriptionRecords === 1 && result.current.rates[0].percent === 50 && result.current.rates[0].rows === 0 && result.current.rates[0].photoRecords === 1);
check('photo review is quoted with provenance and grounded suggestions', result.reviews.pitch.transcriptionCoverage === 1 && result.reviews.pitch.bad[0].basis === 'transcription' && result.reviews.pitch.suggestions.length > 0);
const mixed = sample(); mixed.rows[0].contact = 3;
check('partial manual metric does not combine with photo aggregate in rate', analyze([mixed], '2024-05-01', 'month').current.rates[0].photoRecords === 0);
check('hourly cells remain blank after analysis', photo.rows.every(row => row.contact === null && row.rehash === null));
const unknown = sample(); unknown.source.transcription.totals.contact = null;
check('unknown total is never an invented zero', metricValue(unknown, 'contact') === null);

await fs.mkdir(OUT, { recursive: true });
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const role of ['member', 'leader', 'admin']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const tag = `${role}-${viewport.width}`, context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (/firebasedatabase\.app$|firebaseio\.com$|googleapis\.com$|gstatic\.com$/.test(url.hostname)) {
        let body = 'null', contentType = 'application/json';
        if (url.pathname.endsWith('firebase-app.js')) { body = 'const apps={};export function initializeApp(c,n="default"){return apps[n]={name:n};}export function getApp(n="default"){if(!apps[n])throw Error("missing");return apps[n];}'; contentType = 'text/javascript'; }
        if (url.pathname.endsWith('firebase-auth.js')) { body = 'export const browserLocalPersistence={};const user={uid:"qa-anon",getIdToken:async()=>"test"};const auth={currentUser:user,authStateReady:async()=>{}};export const getAuth=()=>auth;export const setPersistence=async()=>{};export const signInAnonymously=async()=>({user});export const signOut=async()=>{};'; contentType = 'text/javascript'; }
        return route.fulfill({ status: 200, contentType, body, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag', ETag: '"fixture"' } });
      }
      return route.continue();
    });
    await context.addInitScript(role => { localStorage.setItem('fcos_hub_identity', JSON.stringify({ uid: `transcription-qa-${role}`, name: `QA ${role}`, role })); localStorage.setItem('fcos_callback_access_key', 'synthetic-only'); }, role);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${tag} ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${tag} ${message.text()}`); });
    await page.goto(`${BASE}/callback/overview/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(async ({ photo, role }) => {
      const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 820; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f5f1e5'; ctx.fillRect(0,0,600,820); ctx.fillStyle = '#243d2b'; ctx.font='30px sans-serif'; ctx.fillText('사진 전사 확인용 · 합성 이미지',35,60); ctx.fillText('Contact 40 / Stop 20',35,120); photo.source.imageDataUrl = canvas.toDataURL();
      const hidden = structuredClone(photo); hidden.id = 'private-other-account'; hidden.meta.name = 'OTHER ACCOUNT PRIVATE';
      await new Promise((resolve,reject) => { const open = indexedDB.open('presence-paper-sheets-v1',1); open.onupgradeneeded=()=>{ const db=open.result, store=db.createObjectStore('records',{keyPath:'key'});store.createIndex('namespace','namespace');db.createObjectStore('drafts',{keyPath:'namespace'}); }; open.onerror=()=>reject(open.error);open.onsuccess=()=>{ const db=open.result,tx=db.transaction('records','readwrite');for(const [namespace,sheet] of [[`user:transcription-qa-${role}`,photo],['user:other-account',hidden]])tx.objectStore('records').put({key:namespace+'\0'+sheet.id,namespace,id:sheet.id,pending:false,baseRevision:'qa',document:{version:1,revision:'qa',deleted:false,updatedAt:sheet.updatedAt,sheet}});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error); }; });
    }, { photo, role });
    await page.goto(`${BASE}/callback/sheets/index.html?view=archive`, { waitUntil:'networkidle' });
    await page.locator('[data-calendar-date="2024-05-01"]').click();
    await page.locator('#source-transcription').waitFor();
    await page.locator('#source-image').waitFor({ state: 'visible' });
    check(`${tag} original photo remains primary`, await page.locator('#source-image').isVisible());
    check(`${tag} transcript totals/goals visible`, await page.locator('[data-transcription-total="contact"]').textContent() === '40' && (await page.locator('.transcription-totals').textContent()).includes('목표 50'));
    check(`${tag} six review fields and unknown explicit`, await page.locator('[data-transcription-review]').count() === 6 && (await page.locator('[data-transcription-review="loa.bad"]').textContent()).includes('판독 불가'));
    check(`${tag} original OCR markup escaped`, await page.locator('#source-transcription img').count() === 0 && (await page.locator('#source-transcription').textContent()).includes('<img src=x'));
    await page.locator('#source-transcription').scrollIntoViewIfNeeded();
    const geo = await page.evaluate(() => { const dialog=document.querySelector('#source-dialog'),shell=dialog.querySelector('.dialog-shell'),rect=dialog.getBoundingClientRect();return {width:innerWidth,page:document.documentElement.scrollWidth,shellWidth:shell.clientWidth,shellScroll:shell.scrollWidth,dialogLeft:rect.left,dialogRight:rect.right,focus:dialog.contains(document.activeElement),controls:[...dialog.querySelectorAll('button,a[href]')].map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};})}; });
    check(`${tag} viewer no horizontal overflow`, geo.page<=geo.width+1 && geo.shellScroll<=geo.shellWidth+1 && geo.dialogLeft>=0 && geo.dialogRight<=geo.width+1);
    check(`${tag} viewer controls retain44px targets`, geo.controls.every(r=>r.width>=43.5&&r.height>=43.5&&r.left>=0&&r.right<=geo.width+1));
    check(`${tag} dialog owns focus`,geo.focus);
    await page.screenshot({path:`${OUT}/viewer-totals-${tag}.png`});
    await page.locator('[data-transcription-review="attitude.bad"]').scrollIntoViewIfNeeded();
    check(`${tag} long review retains last line`, (await page.locator('[data-transcription-review="attitude.bad"]').textContent()).endsWith('마지막 회고 문장'));
    const closeBounds = await page.locator('[data-close-dialog="source-dialog"]').boundingBox();
    check(`${tag} close action stays visible while reading long transcript`, closeBounds.y >= 0 && closeBounds.y + closeBounds.height <= viewport.height);
    await page.screenshot({path:`${OUT}/viewer-${tag}.png`});
    await page.keyboard.press('Escape');check(`${tag} Escape closes original dialog`,!(await page.locator('#source-dialog').isVisible()));
    await page.goto(`${BASE}/callback/analysis/index.html`,{waitUntil:'networkidle'});
    check(`${tag} real totals available without time allocation`,(await page.locator('.metric-card').first().locator('.metric-number').textContent()).trim()==='40회');
    check(`${tag} corrected donor total beats legacy9`,(await page.locator('.metric-card').last().locator('.metric-number').textContent()).trim()==='2명');
    check(`${tag} coverage explains photo transcription`,(await page.locator('#coverage-detail').textContent()).includes('읽어낸 기록 1개'));
    check(`${tag} rates explain photo source`,(await page.locator('#rates').textContent()).includes('사진 합계 1개'));
    check(`${tag} six-field evidence reaches skill attitude`,(await page.locator('#pitch-review').textContent()).includes('상대의 말을 경청했다')&&(await page.locator('#attitude-review').textContent()).includes('끝까지 밝은 마음'));
    check(`${tag} review quote provenance shown`,(await page.locator('#pitch-review').textContent()).includes('원본 사진에서 읽음'));
    check(`${tag} other account excluded`,!(await page.locator('body').textContent()).includes('OTHER ACCOUNT PRIVATE')&&(await page.locator('#coverage-title').textContent()).includes('1개의 콜백싯'));
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('button,input,select,summary,a[href]')].filter(el=>el.getBoundingClientRect().height>0).map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};})}));
    check(`${tag} analysis no overflow and44px controls`,layout.scroll<=layout.width+1&&layout.targets.every(r=>r.width>=43.5&&r.height>=43.5&&r.left>=0&&r.right<=layout.width+1));
    for(const period of ['week','quarter','half','year','month']){await page.locator(`[data-period="${period}"]`).click();check(`${tag} period ${period} supported`,await page.locator(`[data-period="${period}"]`).getAttribute('aria-pressed')==='true');}
    await page.screenshot({path:`${OUT}/analysis-${tag}.png`,fullPage:true});
    await page.locator('#anchor-today').click();check(`${tag} empty period explicit`,await page.locator('#empty').isVisible());
    await context.close();
  }
  check('zero browser or console errors', errors.length===0);
} finally { await browser.close(); await fs.writeFile(`${OUT}/report.json`,JSON.stringify({base:BASE,passed:checks.length,checks,errors},null,2)); }
console.log(JSON.stringify({passed:checks.length,errors,output:OUT}));
