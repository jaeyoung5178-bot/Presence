import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createSheet } from '../callback/sheets/sheet-model.js';
import { mergeAnalysisSources } from '../callback/analysis/analysis-sources.js';
import { createAnalysisIndex, projectCanonicalDocuments, ANALYSIS_INDEX_KEY } from '../callback/analysis/analysis-projection.js';

const require = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:8768', OUT = process.env.QA_OUTPUT || '/tmp/presence-analysis-cloud-qa';
const checks = [], errors = [], calls = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }
function sheet(id, contact = 10) { const s = createSheet(new Date('2024-05-01T12:00:00Z')); s.id=id;s.meta.name='재영';s.rows[0].contact=contact;s.rows[0].stop=5;s.rows[0].presentation=3;s.rows[0].close=2;s.rows[0].rehash=1;return s; }
const document = (s, deleted=false) => ({version:1,revision:`revision-${s.id}`,updatedAt:s.updatedAt,deleted,...(deleted?{}:{sheet:s})});
const local = (s,pending=false,deleted=false) => ({id:s.id,pending,document:document(s,deleted)});
const server = sheet('shared',20), pending=sheet('shared',3);
check('remote authoritative for a previously synced local record',mergeAnalysisSources([local(pending)],{shared:document(server)}).records[0].rows[0].contact===20);
check('local pending edit is retained without uploading',mergeAnalysisSources([local(pending,true)],{shared:document(server)}).records[0].rows[0].contact===3);
check('pending local deletion hides a remote record',mergeAnalysisSources([local(pending,true,true)],{shared:document(server)}).records.length===0);
check('server tombstone never resurrects pending local record',mergeAnalysisSources([local(pending,true)],{shared:document(server,true)}).records.length===0);
check('missing remote document preserves local-only saved record',mergeAnalysisSources([local(pending)],{}).records.length===1);
check('malformed and mismatched server entries are excluded explicitly',mergeAnalysisSources([],{bad:document(server),shared:{broken:true}}).invalid===2);
check('malformed remote collection rejected',assert.throws(()=>mergeAnalysisSources([],[]))===undefined);
const remote=Object.fromEntries(Array.from({length:96},(_,i)=>{const s=sheet(`server-${i}`);if(i%2)s.meta.name='임재영';return [s.id,document(s)];}));
check('fresh browser can use96 server records with no IDB',mergeAnalysisSources([],remote).records.length===96);
const immutable=JSON.stringify(remote);mergeAnalysisSources([],remote);check('display merge does not mutate server data',JSON.stringify(remote)===immutable);
const other=sheet('other-author',50);other.meta.name='김민수';const unknown=sheet('unknown-author',50);unknown.meta.name='';
const mixedRemote={...remote,[other.id]:document(other),[unknown.id]:document(unknown)};
// A real-shaped photo DTO travels through the browser's conditional304 path too.
// Existing manually entered numbers must still take priority over its transcription.
mixedRemote['server-0'].sheet.source={type:'photo',imageDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lU8AAAAASUVORK5CYII=',filename:'synthetic-photo.png',notes:'',duplicateCount:0,dateBasis:'capture',transcription:{version:1,status:'partial',totals:{contact:999,stop:null,presentation:3,close:2,rehash:99},review:{loa:{good:'과정 목표 달성',bad:'시간 배분 점검'},pitch:{good:'',bad:'핵심 설명을 짧게 전달하기'},attitude:{good:'끝까지 인사',bad:''}}}};
mixedRemote['server-0'].sheet.date='2024-04-29';
mixedRemote['server-1'].sheet.review.pitch.good='핵심 설명을 잘 전달했다';
mixedRemote['server-2'].sheet.review.pitch.good='설명과 스토리를 짧게 전달했다';

await fs.mkdir(OUT,{recursive:true});
const {chromium}=require('playwright');const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
for(const role of ['member','leader','admin'])for(const viewport of [{width:390,height:844},{width:1024,height:768},{width:1440,height:900}]){
  const tag=`${role}-${viewport.width}`,uid=`cloud-qa-${role}`,context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block',reducedMotion:'reduce'});
  const analysisIndex=createAnalysisIndex((await projectCanonicalDocuments(mixedRemote)).documents,{uid,sourceEtag:'"source-fixture"'});
  let mode='ok',delay=0;
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname==='hub.presence.co.kr'&&new URL(BASE).hostname==='127.0.0.1')return route.fulfill({response:await route.fetch({url:BASE+url.pathname+url.search})});
    if(/firebasedatabase\.app$|firebaseio\.com$|googleapis\.com$|gstatic\.com$/.test(url.hostname)){
      calls.push({tag,method:request.method(),path:url.pathname,conditional:request.headers()['if-none-match']||null});let body='null',contentType='application/json',status=200;
      if(url.pathname.endsWith('firebase-app.js')){body='const apps={};export function initializeApp(c,n="default"){return apps[n]={name:n};}export function getApp(n="default"){if(!apps[n])throw Error("missing");return apps[n];}';contentType='text/javascript';}
      else if(url.pathname.endsWith('firebase-auth.js')){body='export const browserLocalPersistence={};const user={uid:"analysis-test-session",getIdToken:async()=>"test-token"};const auth={currentUser:user,authStateReady:async()=>{}};export const getAuth=()=>auth;export const setPersistence=async()=>{};export const signInAnonymously=async()=>({user});export const signOut=async()=>{};';contentType='text/javascript';}
      else if(request.headers().accept?.includes('text/event-stream')){body='event: put\ndata: {"path":"/","data":null}\n\n';contentType='text/event-stream';}
      else if(url.pathname.includes('/_paperSheets')){
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
        if(mode==='denied'){status=401;body=JSON.stringify({error:'permission denied'});}
        else if(mode==='malformed')body='[]';
        else if(url.pathname.endsWith(`/${ANALYSIS_INDEX_KEY}.json`))body=JSON.stringify(analysisIndex);
        else if(url.pathname.includes(`/${uid}/`)&&request.headers()['if-none-match']==='"source-fixture"'){status=304;body='';}
        else if(url.pathname.includes(`/${uid}/`))body=JSON.stringify(Object.fromEntries(Object.entries(mixedRemote).map(([id,doc])=>{const {sheet,...rest}=doc;return [id,{...rest,sheetJson:JSON.stringify(sheet)}];})));
        else body='{}';
      }
      return route.fulfill({status,contentType,body,headers:{'access-control-allow-origin':'*','access-control-expose-headers':'ETag',ETag:'"test"'}});
    }
    return route.continue();
  });
  await context.addInitScript(({role,uid})=>{if(!sessionStorage.getItem('identity-initialized')){localStorage.setItem('fcos_hub_identity',JSON.stringify({uid,name:'임재영',role}));localStorage.setItem('fcos_callback_access_key','synthetic-only');sessionStorage.setItem('identity-initialized','yes');}},{role,uid});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push({tag,message:e.message}));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('401'))errors.push({tag,message:m.text()});});
  await page.goto(`${BASE}/callback/analysis/index.html?qa=cloud-${Date.now()}`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#account-status').dataset.state==='connected');
  check(`${tag} server-only first visit filters96 own records from98 server records`,(await page.locator('#load-status').textContent()).includes('서버 기록 98개')&&(await page.locator('#coverage-title').textContent()).includes('96개의 콜백싯'));
  check(`${tag} server-only totals computed`,(await page.locator('.metric-card').first().locator('.metric-number').textContent()).trim()==='960회');
  check(`${tag} fresh browser validates index with conditional original request`,calls.some(c=>c.tag===tag&&c.path.endsWith('/_paperSheets.json')&&c.conditional==='"source-fixture"'));
  check(`${tag} photo index renders transcription and date basis without image payload`,(await page.locator('#pitch-review').textContent()).includes('핵심 설명을 짧게 전달하기')&&(await page.locator('#coverage-detail').textContent()).includes('촬영일 기준 1건')&&!analysisIndex.documentsJson.includes('imageDataUrl'));
  check(`${tag} verified source has a finite DOM marker`,await page.locator('#account-status').getAttribute('data-source')==='index');
  const loa=page.locator('#loa-review');
  check(`${tag} LOA positive and improvement photo quotes keep their source`,(await loa.textContent()).includes('과정 목표 달성')&&(await loa.textContent()).includes('시간 배분 점검')&&(await loa.textContent()).includes('원본 사진에서 읽음')&&(await loa.textContent()).includes('촬영일 기준'));
  check(`${tag} LOA practice derives from improvement evidence only`,(await loa.locator('.practice').textContent()).includes('시간 배분과 공백')&&!(await loa.locator('.practice').textContent()).includes('과정 목표와 기회량'));
  const pitchPractice=page.locator('#pitch-review .practice').filter({has:page.locator('strong',{hasText:'설명과 핵심 전달'})});
  check(`${tag} improvement practice cites its older source despite newer positives`,(await pitchPractice.locator('small').textContent()).includes('2024-04-29 (촬영일 기준)')&&!(await pitchPractice.locator('small').textContent()).includes('위 개선 회고'));
  const panels=await page.locator('.review-grid > section').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,scroll:node.scrollWidth,client:node.clientWidth};}));
  check(`${tag} all three review panels fit their adaptive layout`,panels.length===3&&panels.every(r=>r.width>=300&&r.x>=0&&r.right<=viewport.width+1&&r.scroll<=r.client+1)&&(viewport.width>1100?Math.abs(panels[0].y-panels[2].y)<1:viewport.width>700?panels[0].width>panels[1].width*1.9&&Math.abs(panels[1].y-panels[2].y)<1:panels[0].y<panels[1].y&&panels[1].y<panels[2].y));
  await page.locator('.review-grid').screenshot({path:`${OUT}/reviews-${tag}.png`});
  check(`${tag} connected owner displayed withoutuid/key`,(await page.locator('#analysis-account').textContent())==='임재영 · 나의 콜백싯'&&!(await page.locator('#account-status').textContent()).includes(uid)&&!(await page.locator('body').textContent()).includes('synthetic-only'));
  check(`${tag} confirmed own aliases selected and grouped by default`,await page.locator('#author-filter').inputValue()==='name:임재영'&&(await page.locator('#author-filter option:checked').textContent()).includes('임재영 · 재영'));
  await page.locator('#author-filter').selectOption('*');check(`${tag} explicit all view includes other and unknown authors`,(await page.locator('.metric-number').first().textContent()).trim()==='1,060회');
  await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);check(`${tag} explicit all selection survives refresh`,await page.locator('#author-filter').inputValue()==='*');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);check(`${tag} explicit selection survives reload in this account`,await page.locator('#author-filter').inputValue()==='*');
  await page.locator('#author-filter').selectOption('name:김민수');check(`${tag} other author can still be inspected separately`,(await page.locator('.metric-number').first().textContent()).trim()==='50회');
  await page.locator('#author-filter').selectOption('name:임재영');
  check(`${tag} no archive prerequisite`,await page.locator('#connect-workbook').isHidden());
  check(`${tag} no writer storage imported`,!await page.evaluate(()=>performance.getEntriesByType('resource').some(item=>/\/sheets\/storage\.js/.test(item.name))));
  check(`${tag} analysis did not create an archive database`,await page.evaluate(async()=>!(await indexedDB.databases()).some(db=>db.name==='presence-paper-sheets-v1')));
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('button,input,select,a[href],summary')].filter(el=>el.getBoundingClientRect().height>0).map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};})}));
  check(`${tag} connected layout and44px targets`,geometry.scroll<=geometry.width+1&&geometry.targets.every(r=>r.width>=43.5&&r.height>=43.5&&r.left>=0&&r.right<=geometry.width+1));
  await page.screenshot({path:`${OUT}/connected-${tag}.png`,fullPage:false});
  // Add a locally saved record so a failed connection still gives truthful local context.
  await page.evaluate(async({uid,sheet})=>{await new Promise((resolve,reject)=>{const open=indexedDB.open('presence-paper-sheets-v1',1);open.onupgradeneeded=()=>{const db=open.result,store=db.createObjectStore('records',{keyPath:'key'});store.createIndex('namespace','namespace');db.createObjectStore('drafts',{keyPath:'namespace'});};open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('records','readwrite'),namespace=`user:${uid}`;tx.objectStore('records').put({key:namespace+'\0'+sheet.id,namespace,id:sheet.id,pending:true,document:{version:1,revision:'pending',updatedAt:sheet.updatedAt,deleted:false,sheet}});tx.oncomplete=()=>{db.close();resolve();};};});},{uid,sheet:sheet('local-only',7)});
  delay=700;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('.metric-number')?.textContent.trim()==='7회');check(`${tag} local saved data visible before slow server response`,await page.locator('#refresh').isDisabled());check(`${tag} loading clears the previous verified source`,await page.locator('#account-status').getAttribute('data-source')===null);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);delay=0;
  mode='denied';await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  check(`${tag} failed auth clearly reports local-only7`,(await page.locator('#load-status').textContent()).includes('서버 확인 미완료')&&(await page.locator('.metric-card').first().locator('.metric-number').textContent()).trim()==='7회');
  check(`${tag} failed server check labels only local evidence`,await page.locator('#account-status').getAttribute('data-source')==='local');
  check(`${tag} reconnection links to actual workbook`,await page.locator('#connect-workbook').isVisible()&&await page.locator('#connect-workbook').getAttribute('href')==='https://presence.co.kr/');
  check(`${tag} auth error remains after period interaction`,await page.locator('#error').isVisible());await page.locator('[data-period="week"]').click();check(`${tag} error not dismissed by chart redraw`,await page.locator('#error').isVisible());
  await page.screenshot({path:`${OUT}/reconnect-${tag}.png`});
  const reconnect=await page.locator('#connect-workbook').boundingBox();check(`${tag} reconnect touch target44px`,reconnect.width>=44&&reconnect.height>=44);
  mode='malformed';await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);check(`${tag} malformed server collection retains local context and warning`,(await page.locator('#error').textContent()).includes('기록 형식')&&(await page.locator('.metric-card').first().locator('.metric-number').textContent()).trim()==='7회');
  mode='ok';await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#account-status').dataset.state==='connected');check(`${tag} retry recovers and pending local7 is preserved`,(await page.locator('.metric-card').first().locator('.metric-number').textContent()).trim()==='967회'&&(await page.locator('#connection-message').textContent()).includes('동기화 대기 1개'));
  // A delayed old-account response must never repopulate a new-account screen.
  delay=500;await page.locator('#refresh').click();await page.evaluate(()=>{localStorage.setItem('fcos_hub_identity',JSON.stringify({uid:'different-account',name:'새 계정'}));window.dispatchEvent(new StorageEvent('storage',{key:'fcos_hub_identity'}));});await page.waitForFunction(()=>document.querySelector('#analysis-account').textContent.includes('새 계정')&&!document.querySelector('#refresh').disabled);check(`${tag} delayed old response cannot leak to new account`,await page.locator('#empty').isVisible()&&!(await page.locator('#load-status').textContent()).includes('96개'));
  await page.evaluate(()=>{localStorage.removeItem('fcos_callback_access_key');localStorage.removeItem('fcos_personal_launch_v2');window.dispatchEvent(new StorageEvent('storage',{key:'fcos_callback_access_key'}));});await page.waitForFunction(()=>document.querySelector('#account-status').dataset.state==='local');check(`${tag} guest status and guide explicit`,(await page.locator('#analysis-account').textContent()).includes('계정 연결 전')&&await page.locator('#connect-workbook').isVisible());
  check(`${tag} no original paper writes in any analysis state`,!calls.filter(c=>c.tag===tag).some(c=>/\/_paperSheets(?:\/|\.json$)/.test(c.path)&&c.method!=='GET'));
  check(`${tag} derived publication is limited to the fixed sibling index`,calls.filter(c=>c.tag===tag&&c.path.includes('/_paperSheets')&&c.method!=='GET').every(c=>c.method==='PUT'&&c.path.endsWith(`/${ANALYSIS_INDEX_KEY}.json`)));
  check(`${tag} no admin-only selector`,await page.locator('[data-admin-only],#admin-picker').count()===0);
  await page.goto(`${BASE}/callback/index.html?qa=legacy-menu`,{waitUntil:'networkidle'});
  const menu=page.locator('.callback-workspace-nav a');await menu.waitFor();const menuBounds=await menu.boundingBox();check(`${tag} automatic counter menu target fits44px`,menuBounds.width>=44&&menuBounds.height>=44&&menuBounds.x>=0&&menuBounds.x+menuBounds.width<=viewport.width+1);
  await page.screenshot({path:`${OUT}/legacy-${tag}.png`});
  await menu.click();await page.waitForURL('**/callback/overview/index.html');check(`${tag} automatic entry can reach cute workspace`,await page.locator('#open-record-options').isVisible());await page.locator('#open-record-options').click();check(`${tag} automatic counter remains distinct reachable route`,await page.locator('#record-auto').getAttribute('href')==='../index.html');await page.locator('#record-auto').click();await page.waitForURL('**/callback/index.html');check(`${tag} automatic page is not forced back to overview`,await page.locator('#view-dashboard').isVisible());
  await context.close();
}
check('zero unexpected console/page errors',errors.length===0);
}finally{await browser.close();await fs.writeFile(`${OUT}/report.json`,JSON.stringify({passed:checks.length,errors,calls,checks},null,2));}
console.log(JSON.stringify({passed:checks.length,errors,output:OUT}));
