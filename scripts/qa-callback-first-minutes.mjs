import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createSheet, createRow, fillHourlyTimes, createNextHourlyRow, fieldMinutes, normalizeSheet, validateSheet, MAX_ROWS, incrementPaperMetric, getPaperNotes, getDonorSummary, replaceObjectionNote } from '../callback/sheets/sheet-model.js';
const require = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768';
const OUT = process.env.QA_OUTPUT || '/tmp/presence-first-minutes-qa';
const checks = [], errors = [];
const oldSource = execFileSync('git', ['show', 'd0949b6:callback/sheets/sheet-model.js'], { encoding: 'utf8' });
const oldModel = await import(`data:text/javascript;base64,${Buffer.from(oldSource).toString('base64')}`);
function check(name, value) { assert.ok(value, name); checks.push(name); }
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
    await page.goto(`${BASE}/callback/sheets/index.html?qa=first-minutes`, {waitUntil:'networkidle'});
    if(viewport.width<800)await page.locator('#preview-tab').click();
    const result=await page.evaluate(async()=>{
      const model=await import('./sheet-model.js?v=20261018-case1'),renderer=await import('./sheet-renderer.js?v=20261018-firstminutes1');
      const sheet=model.createSheet(); model.fillHourlyTimes(sheet.rows,'12:20'); sheet.rows[1].time='13:10'; sheet.rows[1].endTime='14:00';
      const before=JSON.stringify(sheet), canvas=document.querySelector('#paper-preview'), ctx=canvas.getContext('2d'), original=ctx.fillText,draws=[];
      ctx.fillText=function(text,x,y,...rest){if(x===144)draws.push(String(text));return original.call(this,text,x,y,...rest);};
      await renderer.renderSheet(canvas,sheet); const partial=[...draws]; draws.length=0; sheet.rows[0].time='12:00';sheet.rows[0].endTime='13:00';await renderer.renderSheet(canvas,sheet);const full=[...draws];
      draws.length=0;sheet.rows[0].time='23:50';sheet.rows[0].endTime='00:00';await renderer.renderSheet(canvas,sheet);const midnight=[...draws];
      draws.length=0;sheet.rows[0].time='12:20';sheet.rows[0].endTime='13:00'; const firstBefore=JSON.stringify(sheet);await renderer.renderSheet(canvas,sheet);const unchanged=JSON.stringify(sheet)===firstBefore;
      const global=CanvasRenderingContext2D.prototype.fillText,png=[];CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){if(x===144)png.push(String(text));return global.call(this,text,x,y,...rest);};let output;try{output=await renderer.exportSheetPNG(sheet);}finally{CanvasRenderingContext2D.prototype.fillText=global;}
      return {partial,full,midnight,unchanged,png,pngBytes:output.blob.size,firstMinutes:model.fieldMinutes(sheet.rows[0]),laterMinutes:model.fieldMinutes(sheet.rows[1])};
    });
    check(`${tag} only first partial interval is printed`,result.partial.join(',')==='40');
    check(`${tag} first full hour and later partial intervals are blank`,result.full.length===0);
    check(`${tag} first partial interval across midnight is retained`,result.midnight.join(',')==='10');
    check(`${tag} source times and computed minutes stay unchanged`,result.unchanged&&result.firstMinutes===40&&result.laterMinutes===50);
    check(`${tag} PNG uses identical first-only minute rule`,result.png.join(',')==='40'&&result.pngBytes>10000);
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));check(`${tag} page keeps existing responsive geometry`,geometry.scroll<=geometry.width+1);
    await page.locator('#preview-panel').scrollIntoViewIfNeeded();await page.mouse.move(1,1);await page.screenshot({path:`${OUT}/first-minutes-${tag}.png`});
    await context.close();
  }
  check('zero browser or console errors', errors.length === 0);
} finally { await browser.close(); await fs.writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, passed: checks.length, checks, errors }, null, 2)); }
console.log(JSON.stringify({ passed: checks.length, errors, output: OUT }));
