import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {CARE,emptyRecord,validateRecord,aggregate,recordProgress,isDate,nonnegative} from '../team-building/model.mjs';
const require=createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:8772';
const VERSION=process.env.QA_VERSION||'20261112-team2';
const OUT=process.env.QA_OUTPUT||'/Users/jaeyoung5178/Documents/ChatGPT/토픽제작/output/team-building-20261112/local';
const OWNER='umqn5es9t',TODAY='2026-11-12',checks=[],failures=[],errors=[],assets=[];
const check=(name,value,details)=>{assert.ok(value,`${name}${details?' '+JSON.stringify(details):''}`);checks.push(name);};
const clone=x=>structuredClone(x),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function capture(page,file){await page.locator('#toast.visible').waitFor({state:'hidden',timeout:6500});await page.screenshot({path:file,fullPage:true});}
function encode(r){const row=clone(r);row.review.care=Object.fromEntries(row.review.care.map(({key,...v})=>[key,v]));row.sales.team=Object.fromEntries(row.sales.team.map(({memberId,...v})=>[memberId,v]));const clean=x=>Array.isArray(x)?x.map(clean):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,clean(v)])):x;return clean(row);}
function documentFor(record,revision=1){return {version:1,ownerUid:OWNER,revision,updatedAt:1794452400000,updatedBy:OWNER,record:encode(record)};}
function history(){const a=emptyRecord('2026-11-10'),b=emptyRecord('2026-11-11');Object.assign(a.plan,{salesGoal:4,closeGoal:9,actions:'지난 기록의 액션',barriers:'기존 장애물',solutions:'기존 해결방법'});Object.assign(a.sales.self,{donors:3,closes:8,note:'날짜별 원문 보존'});a.sales.team=[{memberId:'qa-a',memberName:'김테스트',donors:2,closes:5,note:'기존 팀원 기록'}];a.review.care[0].rating='good';a.review.care[1].rating='na';b.plan.salesGoal=10;b.review.care[0].rating='na';b.review.care[1].rating='improve';return [a,b];}
{
  check('invalid Gregorian dates return false',!isDate('2026-99-99')&&!isDate('2026-02-29')&&isDate('2024-02-29'));
  check('null and explicit zero remain distinct',nonnegative('')===null&&nonnegative(null)===null&&nonnegative(0)===0);
  for(const n of [-1,1.5,10000])assert.throws(()=>nonnegative(n));check('negative fractional and excessive counts are rejected',true);
  const zero=emptyRecord(TODAY);zero.plan.closeGoal=0;zero.sales.self.note='메모만 기록';check('zero-only plan and note-only sales count as entered',recordProgress(zero).plan&&recordProgress(zero).sales);
  const duplicate=emptyRecord(TODAY);duplicate.sales.team=[{memberId:'qa-a',memberName:'김테스트',donors:0,closes:null,note:''},{memberId:'qa-a',memberName:'김테스트',donors:null,closes:0,note:''}];assert.throws(()=>validateRecord(duplicate));check('duplicate team members cannot normalize',true);
  const [a,b]=history(),c=emptyRecord(TODAY);c.plan.salesGoal=4;c.sales.self.donors=2;c.sales.self.closes=5;c.review.care[0].rating='good';c.review.care[1].rating='improve';const sum=aggregate([a,b,c]);
  check('donor goals use only matched donor actual days',sum.ownDonors===5&&sum.ownCloses===13&&sum.goalTotal===8&&sum.actualAgainstGoal===5&&sum.goalDays===2&&sum.countedDays===2,sum);
  check('not applicable and unanswered care ratings are excluded',sum.care[0].total===2&&sum.care[0].good===2&&sum.care[1].total===2&&sum.care[1].improve===2&&sum.care[2].total===0);
  check('Close goals use their own matched Close denominator',sum.closeGoalDays===1&&sum.closeGoalTotal===9&&sum.actualClosesAgainstGoal===8);
  check('all-unknown counts expose zero entered days',aggregate([emptyRecord(TODAY)]).countedDays===0&&aggregate([emptyRecord(TODAY)]).ownCloseDays===0&&aggregate([emptyRecord(TODAY)]).teamCountedDays===0);
}
const mockStore=`
const account=window.__teamAccount, watchers=new Map();
const request=async(op,path,value,extra={})=>{const response=await fetch('/__team_qa__',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op,path,value,...extra})});const body=await response.json();if(!response.ok)throw Error(body.error||'synthetic request failed');return body;};
const snapshot=value=>({val:()=>structuredClone(value)});
const authObject={currentUser:{uid:'qa-auth'}};
const sdk={auth:authObject,db:{},d:{ref:(_db,path)=>({path}),query:(ref,...filters)=>({...ref,filters}),orderByKey:()=>({type:'order'}),startAt:value=>({type:'start',value}),endAt:value=>({type:'end',value}),get:async ref=>snapshot(await request('get',ref.path,null,{filters:ref.filters})),set:async(ref,value)=>{await request('set',ref.path,value);},update:async(ref,value)=>{await request('update',ref.path,value);},runTransaction:async(ref,update)=>{const current=await request('get',ref.path);const next=update(structuredClone(current));if(next===undefined)return {committed:false,snapshot:snapshot(current)};const result=await request('transaction',ref.path,next,{expected:current?.revision||0});return {committed:result.committed,snapshot:snapshot(result.value)};},onValue:(ref,success,error)=>{const list=watchers.get(ref.path)||new Set();list.add(success);watchers.set(ref.path,list);request('get',ref.path).then(value=>success(snapshot(value))).catch(error);return ()=>list.delete(success);}}};
window.__teamFirebaseMock={emit(path,value){for(const callback of watchers.get(path)||[])callback(snapshot(value));},authObject};
export const firebase=async()=>sdk;
export const auth={restore:async()=>account,login:async()=>account,logout:async()=>{authObject.currentUser=null;for(const callback of watchers.get('authSessions/qa-auth')||[])callback(snapshot(null));}};
`;
function controller(role){const account=role==='owner'?{uid:OWNER,name:'박인선',role:'LR'}:role==='admin'?{uid:'admin',name:'QA 관리자',role:'AOP'}:{uid:'qa-'+role,name:'QA '+role,role:role==='leader'?'LR':'IC',isAdmin:true};const records=Object.fromEntries(history().map(r=>[r.date,documentFor(r)]));return {account,requests:[],writes:[],writeDelay:0,writeFail:false,readFailDate:'',holdDate:'',holdRelease:null,tree:{authSessions:{'qa-auth':{userUid:account.uid}},users:{[OWNER]:{name:'박인선',role:'LR',status:'active'},[account.uid]:{name:account.name,role:account.role,status:'active'}},teamBuildingSupport:{config:{version:1,ownerUid:OWNER,ownerName:'박인선',ownerRole:'LR',enabled:true},directory:{[OWNER]:{version:1,memberIndexVersion:1,nameIndex:{'김테스트':'qa-a','이테스트':'qa-b','박인선':OWNER},members:{'qa-a':{name:'김테스트',role:'IC',active:true},'qa-b':{name:'이테스트',role:'LR',active:true},[OWNER]:{name:'박인선',role:'LR',active:true}}}},records:{[OWNER]:records},analytics:{}}}};}
const getPath=(tree,path)=>path.split('/').reduce((value,key)=>value?.[key],tree)??null;
function setPath(tree,path,value){const parts=path.split('/'),key=parts.pop();let target=tree;for(const part of parts)target=target[part]??={};target[key]=clone(value);}
async function install(context,state){
  await context.addInitScript(account=>{window.__teamAccount=account;},state.account);
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.endsWith('/recruiting/store.js'))return route.fulfill({status:200,contentType:'text/javascript',body:mockStore});
    if(url.pathname==='/__team_qa__'){
      const input=req.postDataJSON();state.requests.push(input);
      if(!['owner','admin'].includes(state.role||''))assert.ok(!input.path.startsWith('teamBuildingSupport/'),'non-owner cannot request private nodes');
      if(input.op==='get'){
        if(state.readFailDate&&input.path===`teamBuildingSupport/records/${OWNER}/${state.readFailDate}`)return route.fulfill({status:503,json:{error:'합성 서버 읽기 오류'}});
        if(state.holdDate&&input.path===`teamBuildingSupport/records/${OWNER}/${state.holdDate}`)await new Promise(resolve=>{state.holdRelease=resolve;});
        let value=getPath(state.tree,input.path);if(input.filters&&value){const start=input.filters.find(x=>x.type==='start')?.value||'',end=input.filters.find(x=>x.type==='end')?.value||'z';value=Object.fromEntries(Object.entries(value).filter(([key])=>key>=start&&key<=end));}
        return route.fulfill({status:200,json:value});
      }
      if(state.writeDelay)await delay(state.writeDelay);
      if(state.writeFail)return route.fulfill({status:503,json:{error:'합성 서버 저장 오류 · 입력은 유지됩니다.'}});
      if(input.op==='transaction'){
        const current=getPath(state.tree,input.path),committed=(current?.revision||0)===input.expected;
        if(committed){setPath(state.tree,input.path,input.value);state.writes.push(input);}
        return route.fulfill({status:200,json:{committed,value:getPath(state.tree,input.path)}});
      }
      if(input.op==='update'){
        assert.equal(input.path,`teamBuildingSupport/directory/${OWNER}`,'registration writes only the private directory');
        for(const [key,value]of Object.entries(input.value)){const current=getPath(state.tree,input.path+'/'+key);if(current!==null&&JSON.stringify(current)!==JSON.stringify(value))return route.fulfill({status:403,json:{error:'permission_denied'}});}
        for(const [key,value]of Object.entries(input.value))setPath(state.tree,input.path+'/'+key,value);
        state.writes.push(input);return route.fulfill({status:200,json:true});
      }
      if(input.op==='set'){setPath(state.tree,input.path,input.value);state.writes.push(input);return route.fulfill({status:200,json:true});}
      throw Error('unexpected synthetic operation '+input.op);
    }
    if(/firebasedatabase\.app$|firebaseio\.com$|identitytoolkit\.googleapis\.com$|securetoken\.googleapis\.com$|gstatic\.com$/.test(url.hostname))throw Error('Real Firebase request forbidden: '+url.hostname+url.pathname);
    return route.continue();
  });
}
async function geometry(page,tag,state){
  const result=await page.evaluate(()=>{
    const visible=el=>!el.closest('[hidden]')&&getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().width>0;
    const rect=el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('button,a,input,select,textarea')].filter(visible).map(el=>({...rect(el),id:el.id,label:el.getAttribute('aria-label')||el.textContent.slice(0,50)})),images:[...document.images].map(image=>({src:image.getAttribute('src'),okay:image.complete&&image.naturalWidth>0})),calendar:[...document.querySelectorAll('#calendar button')].filter(visible).map(rect)};
  });
  check(`${tag} ${state} has no page horizontal overflow`,result.scroll<=result.width+1,result);
  check(`${tag} ${state} controls stay inside the page`,result.targets.every(t=>t.left>=-1&&t.right<=result.width+1),result.targets.filter(t=>t.left< -1||t.right>result.width+1));
  if(result.width<1200)check(`${tag} ${state} touch controls meet 44px`,result.targets.every(t=>t.width>=43.5&&t.height>=43.5),result.targets.filter(t=>t.width<43.5||t.height<43.5));
  check(`${tag} ${state} all images resolve`,result.images.every(image=>image.okay),result.images);
  if(result.width<1200)for(let i=1;i<result.calendar.length;i++){const a=result.calendar[i-1],b=result.calendar[i];if(Math.abs(a.top-b.top)<1)check(`${tag} calendar horizontal spacing ${i}`,b.left-a.right>=7.5,{a,b});}
}
async function openTeam(page){await page.locator('#tab-sales').click();await page.locator('[data-sales-mode="team"]').click();}
async function freshPage(state,viewport){const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block',reducedMotion:'reduce'});await install(context,state);const page=await context.newPage();await page.goto(`${BASE}/team-building/index.html?v=${VERSION}&qa=registration`,{waitUntil:'networkidle'});await page.locator('[data-field="plan.salesGoal"]').waitFor({state:'visible'});return {context,page};}
async function registerDialog(page,name){await page.locator('#register-member').click();await page.locator('#member-dialog').waitFor({state:'visible'});if(name!==undefined)await page.locator('#member-name').fill(name);}
async function submitMember(page){await page.locator('#member-submit').click();await page.locator('#member-dialog').waitFor({state:'hidden'});return page.locator('#team-member').inputValue();}
async function registration(page,state,tag,viewport){
 const recordsBefore=JSON.stringify(state.tree.teamBuildingSupport.records),usersBefore=JSON.stringify(state.tree.users),dirPath=`teamBuildingSupport/directory/${OWNER}`;
 await openTeam(page);await registerDialog(page);
 check(`${tag} registration dialog owns initial focus`,await page.locator('#member-name').evaluate(el=>document.activeElement===el));
 check(`${tag} registration modal fits viewport and touch targets`,await page.locator('#member-dialog').evaluate(dialog=>{const r=dialog.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&[...dialog.querySelectorAll('button,input')].every(el=>{const b=el.getBoundingClientRect();return b.width>=43.5&&b.height>=43.5&&b.left>=r.left&&b.right<=r.right+1;});}));
 await page.screenshot({path:`${OUT}/${tag}-registration-dialog.png`});
 await page.keyboard.press('Escape');await page.locator('#member-dialog').waitFor({state:'hidden'});check(`${tag} Escape restores focus to name registration`,await page.locator('#register-member').evaluate(el=>document.activeElement===el));
 await registerDialog(page);const emptyBefore=state.writes.length;if(await page.locator('#member-submit').isEnabled())await page.locator('#member-submit').click();check(`${tag} empty name cannot create a private label`,await page.locator('#member-dialog').isVisible()&&state.writes.length===emptyBefore);
 await page.locator('#member-name').fill('가'.repeat(41));await page.locator('#member-submit').click();check(`${tag} overlong name shows the 40-character error and preserves input`,(await page.locator('#member-error').textContent()).includes('40')&&await page.locator('#member-name').inputValue()==='가'.repeat(41)&&state.writes.length===emptyBefore);
 await page.locator('#member-name').fill('　김테스트　');const canonicalId=await submitMember(page);check(`${tag} canonical name duplicate selects existing member`,canonicalId==='qa-a'&&Object.keys(getPath(state.tree,dirPath+'/members')).length===3);
 await registerDialog(page,'임시실패');state.writeFail=true;await page.locator('#member-submit').click();await page.waitForFunction(()=>document.querySelector('#member-error').textContent.trim().length>0&&!document.querySelector('#member-submit').disabled);check(`${tag} registration error preserves input for retry`,await page.locator('#member-name').inputValue()==='임시실패');state.writeFail=false;
 await page.locator('#member-name').fill('Ａｌｅｘ　홍');await page.screenshot({path:`${OUT}/${tag}-registration-error.png`});const customId=await submitMember(page),custom=getPath(state.tree,dirPath+'/members/'+customId);
 check(`${tag} successful registration creates only a private normalized label`,/^custom_[a-f0-9]{32}$/.test(customId)&&custom.name==='Alex 홍'&&custom.role==='IC'&&custom.active===true&&custom.createdBy===state.account.uid&&getPath(state.tree,'users/'+customId)===null,custom);
 check(`${tag} name registration creates no account grant or daily record`,JSON.stringify(state.tree.users)===usersBefore&&JSON.stringify(state.tree.teamBuildingSupport.records)===recordsBefore&&!(await page.locator('#save-state').textContent()).includes('변경'));
 const count=Object.keys(getPath(state.tree,dirPath+'/members')).length;await registerDialog(page,' alex   홍 ');const duplicateId=await submitMember(page);check(`${tag} custom canonical duplicate reuses its exact label`,duplicateId===customId&&Object.keys(getPath(state.tree,dirPath+'/members')).length===count);
 const beforeInvalid=state.writes.length;
 const invalid=await page.evaluate(async()=>{const {createTeamBuildingCloud}=await import('./cloud.mjs?v=20261112-team2');const cloud=await createTeamBuildingCloud(window.__teamAccount,()=>{});try{await cloud.boot();let rejected=0;for(const name of ['', '가'.repeat(41),'<script>']){try{await cloud.addMember(name);}catch{rejected++;}}return rejected;}finally{cloud.close();}});
 check(`${tag} actual registration adapter rejects empty long and unsafe names`,invalid===3&&state.writes.length===beforeInvalid);
 const other=await freshPage(state,viewport);await openTeam(other.page);check(`${tag} fresh device sees registered name in the picker`,await other.page.locator(`#team-member option[value="${customId}"]`).textContent().then(text=>text.includes('Alex 홍')));await other.context.close();
 if(tag==='owner-1440'){
  const first=await freshPage(state,viewport),second=await freshPage(state,viewport);await openTeam(first.page);await openTeam(second.page);await registerDialog(first.page,'동시등록');await registerDialog(second.page,' 동시등록 ');state.writeDelay=120;
  const ids=await Promise.all([submitMember(first.page),submitMember(second.page)]);state.writeDelay=0;const labels=Object.values(getPath(state.tree,dirPath+'/members')).filter(member=>member.name==='동시등록');check('concurrent registration reuses one deterministic private label',ids[0]===ids[1]&&labels.length===1&&JSON.stringify(state.tree.teamBuildingSupport.records)===recordsBefore);await first.context.close();await second.context.close();
 }
 await page.reload({waitUntil:'networkidle'});await page.locator('[data-field="plan.salesGoal"]').waitFor({state:'visible'});await openTeam(page);await page.locator('#team-member').selectOption(customId);check(`${tag} reload retains private label and allows selection`,(await page.locator('#team-member option:checked').textContent()).includes('Alex 홍'));await capture(page,`${OUT}/${tag}-registered-picker.png`);await page.locator('[data-sales-mode="self"]').click();await page.locator('#tab-plan').click();
 return customId;
}
async function pendingRegistrationAuthSwitch(state,tag,viewport){
 const test=await freshPage(state,viewport);await openTeam(test.page);await registerDialog(test.page,'지연등록');state.writeDelay=650;const requestsBefore=state.requests.filter(request=>request.op==='update').length;await test.page.locator('#member-submit').click();await test.page.waitForFunction(()=>document.querySelector('#member-submit').disabled);for(let i=0;i<100&&state.requests.filter(request=>request.op==='update').length===requestsBefore;i++)await delay(10);check(`${tag} registration request is pending on the server before auth switch`,state.requests.filter(request=>request.op==='update').length>requestsBefore);
 await test.page.evaluate(()=>window.__teamFirebaseMock.emit('authSessions/qa-auth',{userUid:'qa-revoked'}));await test.page.locator('#login-panel').waitFor({state:'visible'});await delay(800);state.writeDelay=0;
 check(`${tag} account switch clears pending registration and ignores stale result`,await test.page.locator('#workspace').isHidden()&&await test.page.locator('#member-dialog').isHidden()&&await test.page.locator('#member-name').inputValue()===''&&await test.page.locator('#register-member').count()===0);
 await test.context.close();
}
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 for(const role of (process.env.QA_ROLES?.split(',')||['owner','member','leader','admin']))for(const viewport of [{width:390,height:844},{width:1024,height:768},{width:1440,height:900}]){
  const tag=`${role}-${viewport.width}`,state=controller(role);state.role=role;
  const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block',reducedMotion:'reduce'});await install(context,state);const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('__team_qa__'))pageErrors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().includes('__team_qa__'))assets.push({tag,url:r.url(),status:r.status()});});
  try{
   await page.goto(`${BASE}/team-building/index.html?v=${VERSION}&qa=matrix`,{waitUntil:'networkidle'});
   check(`${tag} served entry points at the current release module`,(await page.locator('script[type="module"]').getAttribute('src')).includes('v='+VERSION));
   if(role==='member'||role==='leader'){
    await page.locator('#denied-panel').waitFor({state:'visible'});check(`${tag} direct route denies non-owner even with spoofed isAdmin`,await page.locator('#workspace').isHidden()&&await page.locator('#day-panels').innerHTML()===''&&await page.locator('#analytics-nav').count()===0&&await page.locator('#analytics-view').innerHTML()==='');
    check(`${tag} non-owner never reads private records or analysis`,!state.requests.some(x=>x.path.startsWith('teamBuildingSupport/')));check(`${tag} denied role receives no name registration controls or data`,await page.locator('#register-member').count()===0&&await page.locator('#member-dialog').isHidden()&&await page.locator('#member-name').inputValue()==='');await geometry(page,tag,'denied');await page.screenshot({path:`${OUT}/${tag}-denied.png`,fullPage:true});continue;
   }
   await page.locator('[data-field="plan.salesGoal"]').waitFor({state:'visible'});
   check(`${tag} distinct donor and Close goals start unknown`,await page.locator('[data-field="plan.salesGoal"]').inputValue()===''&&await page.locator('[data-field="plan.closeGoal"]').inputValue()==='');
   check(`${tag} analysis controls obey server-verified role`,await page.locator('#analytics-nav').count()===(role==='admin'?1:0));
   await geometry(page,tag,'plan empty');await capture(page,`${OUT}/${tag}-plan.png`);const customId=await registration(page,state,tag,viewport);
   await page.locator('[data-step="plan.closeGoal"][data-delta="-1"]').click();await page.locator('[data-step="plan.closeGoal"][data-delta="1"]').click();await page.locator('[data-step="plan.closeGoal"][data-delta="-1"]').click();await page.locator('[data-step="plan.closeGoal"][data-delta="-1"]').click();check(`${tag} goal stepper reaches zero without becoming negative`,await page.locator('[data-field="plan.closeGoal"]').inputValue()==='0');
   await page.locator('[data-field="plan.salesGoal"]').fill('-1');await page.locator('#save-button').click();check(`${tag} invalid count cannot reach server`,!state.writes.some(write=>write.path.includes('/records/'))&&(await page.locator('#save-detail').textContent()).includes('0~'));
   await page.locator('[data-field="plan.salesGoal"]').fill('4');await page.locator('[data-field="plan.closeGoal"]').fill('6');
   const actions='필드 전 첫 멘트를 함께 연습하고 구체적으로 피드백합니다. '.repeat(25);
   await page.locator('[data-field="plan.actions"]').fill(actions);await page.locator('[data-field="plan.barriers"]').fill('길게 기록한 장애물과 현장 변수 '.repeat(20));await page.locator('[data-field="plan.solutions"]').fill('B사이트와 프리엠티브 준비 '.repeat(20));
   await page.locator('[data-date="2026-11-10"]').click();await page.locator('#leave-dialog').waitFor({state:'visible'});check(`${tag} dirty-date guard takes keyboard focus`,await page.locator('#leave-dialog').evaluate(el=>el.contains(document.activeElement)));
   check(`${tag} dirty dialog fits viewport with reachable actions`,await page.locator('#leave-dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&[...el.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44);}));await page.keyboard.press('Escape');check(`${tag} Escape keeps the unsaved day and text`,await page.locator('[data-field="plan.actions"]').inputValue()===actions&&await page.locator('[data-date="2026-11-12"]').getAttribute('aria-pressed')==='true');
   await page.locator('#tab-plan').focus();await page.keyboard.press('ArrowRight');check(`${tag} keyboard arrows select the sales tab`,await page.locator('#tab-sales').getAttribute('aria-selected')==='true');
   await page.locator('[data-field="sales.self.donors"]').fill('2');await page.locator('[data-field="sales.self.closes"]').fill('5');await page.locator('[data-field="sales.self.note"]').fill('나의 세일즈 원문');
   await page.locator('[data-sales-mode="team"]').click();await page.locator('#team-member').selectOption('qa-a');await page.locator('#add-team').click();await page.locator('[data-field="sales.team.0.donors"]').fill('0');await page.locator('[data-field="sales.team.0.closes"]').fill('3');await page.locator('[data-field="sales.team.0.note"]').fill('0명도 직접 확인한 기록');
   check(`${tag} existing member cannot be duplicated by picker`,await page.locator('#team-member option[value="qa-a"]').count()===0||await page.locator('#team-member option[value="qa-a"]').isDisabled());
   await page.locator('#team-member').selectOption('qa-b');await page.locator('#add-team').click();await page.locator('[data-field="sales.team.1.closes"]').fill('0');
   await page.locator('#team-member').selectOption(customId);await page.locator('#add-team').click();await page.locator('[data-field="sales.team.2.donors"]').fill('0');await page.locator('[data-field="sales.team.2.closes"]').fill('0');await page.locator('[data-field="sales.team.2.note"]').fill('직접 등록한 이름의 세일즈 기록');
   await geometry(page,tag,'team long content');await capture(page,`${OUT}/${tag}-team.png`);
   await page.locator('#tab-review').click();for(const [i,rating]of ['good','improve','not_done','na',''].entries()){if(rating)await page.locator(`[data-rating="${CARE[i].key}"][data-value="${rating}"]`).click();await page.locator(`[data-field="review.care.${i}.note"]`).fill(`케어 ${i+1}의 구체적인 장면과 다음 행동 `.repeat(10));}await page.locator('[data-field="review.fieldSummary"]').fill('오늘 필드 회고 원문');await page.locator('[data-field="review.followUp"]').fill('다음 전화와 카톡 케어 계획');await page.locator('[data-field="review.nextDate"]').fill('2026-11-13');
   await geometry(page,tag,'review long content');await capture(page,`${OUT}/${tag}-review.png`);
   if(viewport.width<800){await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));check(`${tag} last review field can be reached above fixed save controls`,await page.evaluate(()=>{const fields=[...document.querySelectorAll('#panel-review input,#panel-review textarea')],last=fields.at(-1).getBoundingClientRect(),bar=document.querySelector('.save-area'),style=getComputedStyle(bar),r=bar.getBoundingClientRect();return style.position!=='fixed'||last.bottom<=r.top-7;}));}
   state.writeDelay=500;const save=page.locator('#save-button');await save.click();await page.waitForFunction(()=>document.querySelector('#save-button').disabled);check(`${tag} saving state locks edits`,await page.locator('[data-field="review.fieldSummary"]').isDisabled());await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='계정에 저장된 기록');state.writeDelay=0;
   const doc=getPath(state.tree,`teamBuildingSupport/records/${OWNER}/${TODAY}`);check(`${tag} one server transaction saves donor and Close separately`,doc.revision===1&&doc.record.plan.salesGoal===4&&doc.record.plan.closeGoal===6&&doc.record.sales.self.donors===2&&doc.record.sales.self.closes===5);
   check(`${tag} unknown team donors remain absent while explicit zero survives`,doc.record.sales.team['qa-a'].donors===0&&!('donors'in doc.record.sales.team['qa-b'])&&doc.record.sales.team['qa-b'].closes===0);
   check(`${tag} daily save uses the registered private label without creating an account`,doc.record.sales.team[customId].memberName==='Alex 홍'&&doc.record.sales.team[customId].note==='직접 등록한 이름의 세일즈 기록'&&getPath(state.tree,'users/'+customId)===null);
   await page.locator('[data-date="2026-11-10"]').click();await page.locator('#tab-plan').click();await page.waitForFunction(()=>document.querySelector('[data-field="plan.actions"]')?.value==='지난 기록의 액션');check(`${tag} calendar preserves independent older history`,await page.locator('[data-field="plan.salesGoal"]').inputValue()==='4');
   await page.locator('[data-date="2026-11-12"]').click();await page.waitForFunction(()=>document.querySelector('[data-field="plan.actions"]')?.value.startsWith('필드 전 첫 멘트'));check(`${tag} saved content returns on date selection`,await page.locator('[data-field="plan.closeGoal"]').inputValue()==='6');
   await page.reload({waitUntil:'networkidle'});await page.locator('[data-field="plan.actions"]').waitFor({state:'visible'});check(`${tag} reload reads exact long text from server`,await page.locator('[data-field="plan.actions"]').inputValue()===actions);
   const device=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block'});await install(device,state);const other=await device.newPage();await other.goto(`${BASE}/team-building/index.html?v=${VERSION}&qa=second-device`,{waitUntil:'networkidle'});await other.locator('[data-field="plan.actions"]').waitFor({state:'visible'});check(`${tag} fresh second device gets saved text without local storage`,await other.locator('[data-field="plan.actions"]').inputValue()===actions);await device.close();
   await page.locator('[data-field="plan.actions"]').fill('저장 실패에도 유지할 작성 내용');state.writeFail=true;await save.click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='저장하지 못했어요.');check(`${tag} server error retains dirty input and enables retry`,await page.locator('[data-field="plan.actions"]').inputValue()==='저장 실패에도 유지할 작성 내용'&&await save.isEnabled());state.writeFail=false;await save.click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='계정에 저장된 기록');
   const latest=getPath(state.tree,`teamBuildingSupport/records/${OWNER}/${TODAY}`);latest.revision++;latest.record.plan.actions='다른 기기에서 수정한 기록';await page.locator('[data-field="plan.actions"]').fill('충돌해도 유지할 내 초안');await save.click();await page.locator('#conflict').waitFor({state:'visible'});check(`${tag} revision conflict preserves draft and blocks silent overwrite`,await page.locator('[data-field="plan.actions"]').inputValue()==='충돌해도 유지할 내 초안'&&await save.isDisabled()&&latest.record.plan.actions==='다른 기기에서 수정한 기록');
   await page.locator('#reload-record').click();await page.locator('#leave-dialog button[value="discard"]').click();await page.waitForFunction(()=>document.querySelector('[data-field="plan.actions"]')?.value==='다른 기기에서 수정한 기록');
   state.readFailDate='2026-11-11';await page.locator('[data-date="2026-11-11"]').click();await page.locator('#retry-day').waitFor({state:'visible'});check(`${tag} failed day read protects prior data and save`,await save.isDisabled()&&await page.locator('[data-field]').count()===0);state.readFailDate='';await page.locator('#retry-day').click();await page.locator('[data-field="plan.actions"]').waitFor({state:'visible'});
   if(role==='admin'){
    await page.locator('#analytics-nav').click();await page.locator('#analysis-results .metric').first().waitFor();check(`${tag} admin analytics shows matched donor-goal percentage`,(await page.locator('#analysis-results .metric').nth(3).textContent()).includes('63%'));
    check(`${tag} admin donor and Close totals stay distinct`,(await page.locator('#analysis-results .metric').nth(1).textContent()).includes('5명')&&(await page.locator('#analysis-results .metric').nth(1).textContent()).includes('Close 13회'));
    check(`${tag} admin care excludes NA from denominator`,(await page.locator('.care-stat').first().textContent()).includes('100%')&&(await page.locator('.care-stat').first().textContent()).includes('응답 2일'));
    check(`${tag} admin Close goal comparison uses Close values`,(await page.locator('#analysis-results').textContent()).includes('13회 / 15회'));
    check(`${tag} unknown-only historical day displays a dash in both metric trends`,await page.locator('.trend-row').filter({hasText:'11/11'}).count()===2&&await page.locator('.trend-row').filter({hasText:'11/11'}).evaluateAll(rows=>rows.every(row=>row.lastElementChild.textContent==='—')));
    check(`${tag} only admin writes analytics snapshots`,state.writes.some(x=>x.path.startsWith(`teamBuildingSupport/analytics/${OWNER}/`)));
    await geometry(page,tag,'admin analytics');check(`${tag} analytics has no visible journal save bar`,await page.locator('.save-area').isHidden());await capture(page,`${OUT}/${tag}-analysis.png`);
    await page.locator('#analysis-from').fill('2025-01-01');await page.locator('#analysis-to').fill('2025-01-31');await page.locator('#analysis-form button').click();await page.waitForFunction(()=>document.querySelector('#analysis-state').textContent.includes('저장된 기록 0일'));check(`${tag} empty analysis shows no fabricated care percentages`,(await page.locator('#analysis-results').textContent()).includes('선택한 기간에 저장된 기록이 없어요.')&&await page.locator('.care-stat-top span').first().textContent()==='—');await page.locator('#journal-nav').click();
   }else check(`${tag} owner never requests parent records or analytics nodes`,!state.requests.some(x=>x.path==='teamBuildingSupport/records'||x.path.startsWith('teamBuildingSupport/analytics')));
   await pendingRegistrationAuthSwitch(state,tag,viewport);state.holdDate='2026-11-10';await page.locator('[data-date="2026-11-10"]').click();await page.waitForFunction(()=>document.querySelector('#record-state').textContent.includes('연결 중'));check(`${tag} loading state removes old private fields`,await page.locator('[data-field]').count()===0&&await save.isDisabled());
   await page.evaluate(()=>window.__teamFirebaseMock.emit('authSessions/qa-auth',{userUid:'qa-revoked'}));await page.locator('#login-panel').waitFor({state:'visible'});state.holdRelease?.();state.holdDate='';await delay(100);check(`${tag} account switch aborts delayed stale day and clears private DOM`,await page.locator('#workspace').isHidden()&&await page.locator('#day-panels').innerHTML()===''&&await page.locator('#analytics-nav').count()===0);
   check(`${tag} no browser exceptions`,pageErrors.length===0,pageErrors);
  }catch(error){failures.push({tag,message:error.message,stack:error.stack});console.log(JSON.stringify({tag,failure:error.message}));await page.screenshot({path:`${OUT}/${tag}-FAIL.png`,fullPage:true}).catch(()=>{});}
  finally{errors.push(...pageErrors.map(message=>({tag,message})));await context.close();}
 }
}finally{await browser.close();await fs.writeFile(`${OUT}/report.json`,JSON.stringify({base:BASE,passed:checks.length,checks,failures,errors,assets},null,2));}
console.log(JSON.stringify({passed:checks.length,failures,errors,assets,output:OUT}));if(failures.length||errors.length||assets.length)process.exitCode=1;
