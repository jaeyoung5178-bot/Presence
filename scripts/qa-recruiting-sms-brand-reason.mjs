import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

// All account, SDK, database and clipboard data in this test is synthetic.
// The production variant loads deployed application bytes, never real Firebase.
const { chromium } = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const base = (process.env.RECRUITING_QA_URL || 'http://127.0.0.1:8771').replace(/\/$/, '');
const out = process.env.RECRUITING_QA_OUT || '/tmp/presence-recruiting-sms-brand-qa';
const roles = (process.env.RECRUITING_QA_ROLES || 'member,leader,admin').split(',');
const widths = (process.env.RECRUITING_QA_WIDTHS || '390,1024,1440').split(',').map(Number);
await mkdir(out, {recursive:true});
const checks = [], failures = [];
const check = (name, ok, detail='') => (ok ? checks : failures).push({name, detail});
const clone = value => structuredClone(value);
const day = '2026-11-18';
const mk = (id, status='booked', extra={}) => ({id,name:`합성후보 ${id}`,age:'24세',gender:'',mobile:'010-1234-5678',phone:'0507-1234-5678',channel:'알바몬',url:`https://www.albamon.com/human-resources/detail/${id.replace(/\D/g,'')||'100'}`,status,revision:1,note:'기존 통화 메모 · 유지할 내용',relate:'서비스 경험',rejectionReason:'',events:{opened:{id:'opened',type:'opened',day,at:1}},interviewDate:'2026-11-19',interviewTime:'11:00',recruiter:'합성담당자',nextDate:'',...extra});
const initial = () => ({candidates:Object.fromEntries([
  mk('qa100'), mk('qa200','rejected',{channel:'동네알바',url:'',rejectionReason:'기존 거절 사유',interviewDate:'',interviewTime:''}),
  mk('qa300','new',{channel:'알바천국',url:'https://www.alba.co.kr/resume/Detail?adid=300',interviewDate:'',interviewTime:''}),
  mk('qa400','absent',{events:{opened:{type:'opened',day,at:1},absent:{type:'absent',day,at:2}}}),
  mk('qa500','absent',{channel:'동네알바',url:'',events:{opened:{type:'opened',day,at:1},absent:{type:'absent',day,at:2}}})
].map(c=>[c.id,c])),settings:{name:'합성담당자',sound:false,sheetEndpoint:'',address:'인천 테스트로 1 & 2층',directions:'정문 → 왼쪽\n문의: A&B / #1'},reports:{}});

const sdkDatabase = `
const listeners = new Map();
const snap = value => ({val:()=>structuredClone(value)});
const request = async (op,path,value,expected) => {
 const r=await fetch(window.__qaBase+'/__recruiting_qa__',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,path,value,expected})});
 const result=await r.json(); if(result.error)throw Error(result.error); return result;
};
export const getDatabase=()=>({synthetic:true});
export const ref=(db,path)=>({path});
export async function get(r){return snap((await request('get',r.path)).value)}
export function onValue(r,callback,error){let active=true;const f=v=>{if(active)callback(snap(v))};if(!listeners.has(r.path))listeners.set(r.path,new Set());listeners.get(r.path).add(f);get(r).then(s=>{if(active)callback(s)}).catch(e=>error?.(e));return()=>{active=false;listeners.get(r.path)?.delete(f)}}
function emit(result){for(const [path,fns]of listeners){if(result.changed===path||result.changed.startsWith(path+'/'))for(const f of fns)f(result.treeValue?.[path]??null)}}
export async function runTransaction(r,fn){const current=(await get(r)).val(),value=fn(current);if(value===undefined)return{committed:false,snapshot:snap(current)};const result=await request('transaction',r.path,value,current?.revision||0);if(result.committed)emit(result);return{committed:result.committed,snapshot:snap(result.value)}}
export async function set(r,value){const result=await request('set',r.path,value);emit(result)}
export async function remove(r){const result=await request('set',r.path,null);emit(result)}
`;

function fixture(role) {
 const uid=`qa-${role}`, root=`userPreferences/${uid}/recruitingCamp`;
 const state={uid,root,tree:{authSessions:{'qa-auth':{userUid:uid}},users:{[uid]:{name:'합성 리쿠르터',role,status:'active'},'qa-other':{name:'다른 합성 계정',role:'member',status:'active'}},userPreferences:{[uid]:{recruitingCamp:initial()},'qa-other':{recruitingCamp:{candidates:{},settings:{sound:false,sheetEndpoint:''},reports:{}}}}},writes:[],requests:[],external:[],delay:0,fail:'',transactionsStarted:0};
 state.get=path=>path==='.info/connected'?true:path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],state.tree)??null;
 state.put=(path,value)=>{const keys=path.split('/');let node=state.tree;for(const k of keys.slice(0,-1))node=node[k]??={};if(value===null)delete node[keys.at(-1)];else node[keys.at(-1)]=clone(value)};
 state.candidate=id=>state.get(`${root}/candidates/${id}`);
 return state;
}
async function setup(context,state) {
 await context.addInitScript(({base})=>{
  window.__qaBase=base; window.__qaCopied=[];window.__qaSmsBlocked=[];window.__qaOnline=true;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__qaCopied.push(text)}}});
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.__qaOnline});
  document.addEventListener('click',e=>{const a=e.target.closest('a[href^="sms:"]');if(a){e.preventDefault();window.__qaSmsBlocked.push(a.getAttribute('href'))}},true);
  const NativeDate=Date;globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-11-18T03:00:00Z']))}static now(){return NativeDate.parse('2026-11-18T03:00:00Z')}};
 },{base});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.pathname==='/__recruiting_qa__'){
   const body=req.postDataJSON();state.requests.push(body);
   let result;
   if(body.op==='get')result={value:clone(state.get(body.path))};
   else {
    if(body.op==='transaction'){state.transactionsStarted++;if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));}
    if(state.fail)result={error:state.fail};
    else if(body.op==='transaction'&&state.get('authSessions/qa-auth')?.userUid!==state.uid)result={error:'합성 서버: 계정이 바뀌었어요. 다시 로그인해 주세요.'};
    else if(body.op==='transaction'&&Number(state.get(body.path)?.revision||0)!==body.expected)result={committed:false,value:clone(state.get(body.path))};
    else {state.put(body.path,body.value);state.writes.push(clone(body));result={committed:true,value:clone(body.value),changed:body.path,treeValue:{[state.root]:clone(state.get(state.root))}};}
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  }
  if(u.hostname==='www.gstatic.com'&&/firebase-(app|database|auth)\.js$/.test(u.pathname)){
   const part=u.pathname.match(/firebase-(\w+)\.js$/)[1];
   const body=part==='database'?sdkDatabase:part==='app'?`export const getApps=()=>[];export const initializeApp=(c,name)=>({name});`:`const auth={currentUser:{uid:'qa-auth',getIdToken:async()=>'synthetic-token'},authStateReady:async()=>{}};export const getAuth=()=>auth;export const signInAnonymously=async()=>({user:auth.currentUser});export const signOut=async()=>{auth.currentUser=null};`;
   return route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body});
  }
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  if(u.origin===new URL(base).origin&&['GET','HEAD'].includes(req.method()))return route.continue();
  state.external.push(req.url());return route.abort();
 });
}
async function waitUntil(page,fn,label){for(let i=0;i<100;i++){if(fn())return;await page.waitForTimeout(50)}throw Error(`Timed out: ${label}`)}
const formField=(page,name)=>page.locator(`#candidate-form [name="${name}"]`);
let navigationSequence=0;
async function open(page,id){await page.goto(`${base}/recruiting/index.html?v=qa-sms-brand-reason&qa-open=${++navigationSequence}#candidate/${id}`,{waitUntil:'networkidle'});await page.locator('#editor[open]').waitFor();await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});}
function parseSMS(uri){const match=String(uri||'').match(/^sms:([^?&]+)(?:[?&]body=(.*))?$/);return match?{recipient:match[1],body:match[2]===undefined?'':decodeURIComponent(match[2])}:null;}
async function geometry(page,tag){const result=await page.evaluate(()=>{const dialog=document.querySelector('#editor[open]');const nodes=[...(dialog||document).querySelectorAll('button,a,input,select,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).visibility!=='hidden'});return{overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:nodes.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5}).map(e=>e.id||e.name||e.textContent.slice(0,20)),small:innerWidth<=1024?nodes.filter(e=>{const r=e.getBoundingClientRect();return r.width<43.5||r.height<43.5}).map(e=>({id:e.id||e.name,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})):[],broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),focus:!!dialog?.contains(document.activeElement)}});check(`${tag} no page overflow`,!result.overflow);check(`${tag} no horizontally clipped controls`,!result.clipped.length,JSON.stringify(result.clipped));check(`${tag} 44px targets`,!result.small.length,JSON.stringify(result.small));check(`${tag} required assets resolve`,!result.broken.length,JSON.stringify(result.broken));check(`${tag} modal owns focus`,result.focus);}

const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 // Independent input/expected-output tables exercise served model functions.
 const unitContext=await browser.newContext({serviceWorkers:'block'}),unitState=fixture('member');await setup(unitContext,unitState);const unitPage=await unitContext.newPage();await unitPage.goto(`${base}/recruiting/index.html?v=qa-unit`,{waitUntil:'networkidle'});
 const unit=await unitPage.evaluate(async()=>{
  const m=await import('./model.js?v=qa-sms-unit'),p=await import('./contact-calendar.js?v=qa-sms-unit');const rows=[];const test=(name,ok,detail='')=>rows.push({name,ok,detail});
  for(const channel of ['알바몬','알바천국','당근마켓','동네알바','갓피플','스트릿','지인','앰버서더','','unknown'])test('brand default '+channel,m.smsBrand({channel})===(channel==='알바몬'?'PeaceMaker':'Presence'));
  for(const url of ['https://www.albamon.com/human-resources/detail/123','https://www.alba.co.kr/resume/Detail?adid=123','https://www.alba.co.kr/biz/applicants/ApplicantsDetailView?adid=123&jobadid=456&application_idx=789'])test('legacy URL '+url,m.smsBrand({url})===(url.includes('albamon')?'PeaceMaker':'Presence'));
  test('explicit channel takes priority over legacy URL',m.smsBrand({channel:'동네알바',url:'https://www.albamon.com/human-resources/detail/1'})==='Presence');
  for(const smsBrand of ['Presence','PeaceMaker'])test('persisted explicit '+smsBrand,m.smsBrand({channel:smsBrand==='Presence'?'알바몬':'동네알바',smsBrand})===smsBrand);
  test('invalid override ignored',m.smsBrand({channel:'알바몬',smsBrand:'<script>'})==='PeaceMaker');
  const phones=[['010-1234-5678','01012345678'],['+82 (0)10 1234 5678','+821012345678'],['+1 202 555 0101','+12025550101'],['0507-1234-5678','050712345678'],['02-123-4567','021234567'],['010-****-5678',''],['01012345678;01098765432',''],['01012345678,01098765432',''],['01012345678?body=evil',''],['01012345678&cc=1',''],['javascript:1',''],['123',''],['+00012345678','']];
  for(const [mobile,expected]of phones)test('one recipient '+mobile,p.smsRecipient({mobile})===expected,p.smsRecipient({mobile}));
  test('valid phone fallback',p.smsRecipient({mobile:'010-****-5678',phone:'0507-1234-5678'})==='050712345678');
  const body='합성님 안녕하세요!\nPresence & PeaceMaker\n한글 #1? / + = % 😊 <script>';
  for(const platform of ['iPhone','iPad','iPod','Android','MacIntel','Win32','']){const uri=p.smsHref({mobile:'01012345678'},body,platform),sep=/iPhone|iPad|iPod/i.test(platform)?'&':'?';test('platform separator '+platform,uri===`sms:01012345678${sep}body=${encodeURIComponent(body)}`,uri);test('body round trip '+platform,decodeURIComponent(uri.split('body=')[1])===body)}
  test('no body stays bare',p.smsHref({mobile:'01012345678'})==='sms:01012345678');test('bad recipient cannot receive body',p.smsHref({mobile:'01012345678;2'},body)==='');
  for(const [date,time,ok]of [['2026-11-19','11:00',true],['2026-02-30','11:00',false],['2026-11-19','',false],['','11:00',false],['2026-11-19','24:00',false],['2026-11-19','11:99',false],['2026-11-19','9:00',false]])test('schedule '+date+' '+time,m.hasInterviewSchedule({interviewDate:date,interviewTime:time})===ok);
  test('rejection optional',m.validate({name:'합성',status:'rejected',rejectionReason:''})==='');test('reason 4000 accepted',m.validate({name:'합성',status:'rejected',rejectionReason:'가'.repeat(4000)})==='');test('reason 4001 rejected',!!m.validate({name:'합성',status:'rejected',rejectionReason:'가'.repeat(4001)}));
  test('existing sheet export does not leak reason',!m.sheetRows([{name:'합성',note:'메모유지',rejectionReason:'PRIVATE_REASON'}],'booked').includes('PRIVATE_REASON'));
  const absent=(extra={})=>({name:'합성 이름',age:'24세',phone:'050712345678',mobile:'01098765432',channel:'알바몬',url:'https://www.albamon.com/human-resources/detail/123?from=qa',recruiter:'다른담당자',status:'absent',events:{open:{type:'opened',day:'2026-11-18',at:1},call:{type:'absent',day:'2026-11-18',at:2}},...extra});
  const one=extra=>m.albamonAbsentSheetRows([absent(extra)],'2026-11-18');
  test('absent TSV exact headerless 10 cells',one()==='11/18\t합성 이름\t24세\t0507-1234-5678\t임재영\t11/18\t\t\t\thttps://www.albamon.com/human-resources/detail/123',one());
  const contacts=[['050712345678','0507-1234-5678'],['01012345678','010-1234-5678'],['021234567','02-123-4567'],['0212345678','02-1234-5678'],['07012345678','070-1234-5678'],['0311234567','031-123-4567'],['+821012345678','010-1234-5678']];
  for(const [phone,expected]of contacts)test('absent source phone preserved '+phone,one({phone,mobile:''}).split('\t')[3]===expected,one({phone,mobile:''}));
  test('absent invalid source phone falls back to mobile',one({phone:'0507-****-5678'}).split('\t')[3]==='010-9876-5432');
  test('absent valid source phone preferred over mobile',one({phone:'01012345678'}).split('\t')[3]==='010-1234-5678');
  test('absent legacy URL source included',!!one({channel:''}));test('absent explicit other channel excluded',one({channel:'동네알바'})==='');test('absent deleted excluded',one({deleted:true})==='');
  test('absent selected-day latest rejection excluded',one({events:{a:{type:'absent',day:'2026-11-18',at:1},b:{type:'rejected',day:'2026-11-18',at:2}}})==='');
  test('absent selected-day latest booked excluded',one({events:{a:{type:'absent',day:'2026-11-18',at:1},b:{type:'booked',day:'2026-11-18',at:2}}})==='');
  test('absent later-day rejection does not rewrite history',!!one({status:'rejected',events:{a:{type:'absent',day:'2026-11-18',at:1},b:{type:'rejected',day:'2026-11-19',at:2}}}));
  test('absent earlier-day outcome excluded',one({events:{a:{type:'absent',day:'2026-11-17',at:1}}})==='');test('absent invalid day empty',m.albamonAbsentSheetRows([absent()],'2026-02-30')==='');
  const safe=one({name:'=HYPERLINK("evil")\t주입\n새행',age:'+24'}).split('\t');test('absent cells prevent formula and row injection',safe.length===10&&safe[1].startsWith("'=")&&safe[2].startsWith("'+")&&!safe[1].includes('\n'));
  return rows;
 });for(const r of unit)check(`model ${r.name}`,r.ok,r.detail);await unitContext.close();

 for(const role of roles)for(const width of widths){
  const tag=`${role}-${width}`,context=await browser.newContext({viewport:{width,height:width===390?844:width===1024?768:900},timezoneId:'Asia/Seoul',serviceWorkers:'block'}),state=fixture(role);await setup(context,state);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  try{
   await open(page,'qa100');check(`${tag} Albamon default`,await formField(page,'smsBrand').inputValue()==='PeaceMaker');
   let preview=await page.locator('#sms-preview').textContent(),parsed=parseSMS(await page.locator('#direct-message a').getAttribute('href'));check(`${tag} initial exact SMS body`,parsed?.recipient==='01012345678'&&parsed.body===preview&&preview.includes('PeaceMaker'));check(`${tag} encoded Korean newlines ampersand`,preview.includes('A&B')&&preview.includes('\n')&&preview.includes('합성후보'));
   await page.locator('#copy-sms').click();check(`${tag} copy exactly matches native body`,await page.evaluate(()=>window.__qaCopied.at(-1))===preview);await page.locator('#direct-message a').click();check(`${tag} SMS launch prevented`,await page.evaluate(()=>window.__qaSmsBlocked.length)===1);
   await formField(page,'smsBrand').selectOption('Presence');preview=await page.locator('#sms-preview').textContent();check(`${tag} override preview href guide immediate`,preview.includes('Presence 면접')&&!preview.includes('PeaceMaker')&&parseSMS(await page.locator('#direct-message a').getAttribute('href'))?.body===preview&&(await page.locator('.call-guide').textContent()).includes('Presence'));
   await formField(page,'channel').selectOption('알바천국');check(`${tag} other channel default`,await formField(page,'smsBrand').inputValue()==='Presence');await formField(page,'channel').selectOption('알바몬');check(`${tag} channel reset default`,await formField(page,'smsBrand').inputValue()==='PeaceMaker');await formField(page,'smsBrand').selectOption('Presence');
   await page.locator('#candidate-form button[type="submit"]').click();await waitUntil(page,()=>state.candidate('qa100').revision===2,'brand save');check(`${tag} brand cloud persistence`,state.candidate('qa100').smsBrand==='Presence');await open(page,'qa100');check(`${tag} brand reload persistence`,await formField(page,'smsBrand').inputValue()==='Presence');
   await formField(page,'interviewTime').fill('');check(`${tag} incomplete time no fabricated body`,await page.locator('#copy-sms').isDisabled()&&parseSMS(await page.locator('#direct-message a').getAttribute('href'))?.body===''&&!(await page.locator('#sms-preview').textContent()).includes('면접일정 안내드립니다'));await formField(page,'interviewTime').fill('11:00');await formField(page,'mobile').fill('010-****-5678');check(`${tag} valid fallback recipient`,parseSMS(await page.locator('#direct-message a').getAttribute('href'))?.recipient==='050712345678');await formField(page,'phone').fill('0507-****-1234');check(`${tag} masked numbers disabled`,await page.locator('#direct-message a').count()===0&&await page.locator('#direct-message button').isDisabled());await formField(page,'mobile').fill('010-1234-5678');await formField(page,'phone').fill('0507-1234-5678');
   await geometry(page,`${tag} brand dialog`);await page.locator('.message-box').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${out}/${tag}-brand-dialog.png`});
   await open(page,'qa200');check(`${tag} existing rejected reason`,await formField(page,'rejectionReason').inputValue()==='기존 거절 사유');check(`${tag} existing note separate`,await formField(page,'note').inputValue()==='기존 통화 메모 · 유지할 내용');
   const autoReason='근무 요일이 맞지 않음\n다음 달 재문의 가능 & 확인';await formField(page,'rejectionReason').fill(autoReason);await waitUntil(page,()=>state.candidate('qa200').revision===2,'reason autosave');await page.locator('#draft-status').filter({hasText:'저장됨'}).waitFor();check(`${tag} reason autosaved separately`,state.candidate('qa200').rejectionReason===autoReason&&state.candidate('qa200').note==='기존 통화 메모 · 유지할 내용');check(`${tag} legacy default brand creates no false draft`,await page.evaluate(uid=>sessionStorage.getItem(`presence.crewCamp.draft.${uid}`),state.uid)===null);await page.locator('#editor-close').click();check(`${tag} autosaved legacy reason closes without dirty guard`,!await page.locator('#editor').evaluate(e=>e.open)&&!await page.locator('#utility').evaluate(e=>e.open));await open(page,'qa200');check(`${tag} reason reload persistence`,await formField(page,'rejectionReason').inputValue()===autoReason);
   await formField(page,'rejectionReason').fill('수동 저장한 별도 거절 사유');await page.locator('#candidate-form button[type="submit"]').click();await waitUntil(page,()=>state.candidate('qa200').revision===3,'manual reason save');check(`${tag} manual reason save`,state.candidate('qa200').rejectionReason==='수동 저장한 별도 거절 사유');
   await open(page,'qa300');await formField(page,'rejectionReason').fill('새 거절 · 고객응대 근무 일정 불일치');await page.locator('[data-outcome="rejected"]').click();await waitUntil(page,()=>state.candidate('qa300').status==='rejected','new rejection');check(`${tag} new reject stores optional reason`,state.candidate('qa300').rejectionReason==='새 거절 · 고객응대 근무 일정 불일치'&&state.candidate('qa300').note==='기존 통화 메모 · 유지할 내용');
   await open(page,'qa200');const long='긴 사유를 읽고 수정할 수 있습니다.\n'.repeat(100).slice(0,4000).trim();await formField(page,'rejectionReason').fill(long);await waitUntil(page,()=>state.candidate('qa200').rejectionReason===long,'long reason');await geometry(page,`${tag} long rejection dialog`);await page.locator('.rejection-reason').evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`${out}/${tag}-rejection-dialog.png`});check(`${tag} reason max length`,await formField(page,'rejectionReason').getAttribute('maxlength')==='4000');
   // A concurrent browser revision must not overwrite either copy.
   await open(page,'qa200');state.candidate('qa200').revision++;state.candidate('qa200').rejectionReason='다른 기기에서 변경한 사유';const externalRevision=state.candidate('qa200').revision;await formField(page,'rejectionReason').fill('충돌해도 유지할 입력 사유');await page.locator('#draft-status').filter({hasText:'다른 창'}).waitFor();check(`${tag} conflict preserves input and note`,await formField(page,'rejectionReason').inputValue()==='충돌해도 유지할 입력 사유'&&await formField(page,'note').inputValue()==='기존 통화 메모 · 유지할 내용');check(`${tag} conflict does not overwrite cloud`,state.candidate('qa200').revision===externalRevision&&state.candidate('qa200').rejectionReason==='다른 기기에서 변경한 사유');check(`${tag} conflict draft`,await page.evaluate(uid=>JSON.parse(sessionStorage.getItem(`presence.crewCamp.draft.${uid}`)).value.rejectionReason,state.uid)==='충돌해도 유지할 입력 사유');
   await page.goto(`${base}/recruiting/index.html?v=qa-draft`,{waitUntil:'networkidle'});await page.locator('#editor[open]').waitFor();check(`${tag} draft restores after reload`,await formField(page,'rejectionReason').inputValue()==='충돌해도 유지할 입력 사유');await page.evaluate(()=>sessionStorage.clear());await open(page,'qa200');
   await page.evaluate(()=>window.__qaOnline=false);await formField(page,'rejectionReason').fill('오프라인이어도 입력 유지');await page.locator('#draft-status').filter({hasText:'오프라인'}).waitFor();check(`${tag} offline preserves input`,await formField(page,'rejectionReason').inputValue()==='오프라인이어도 입력 유지');check(`${tag} offline draft preserved`,await page.evaluate(uid=>JSON.parse(sessionStorage.getItem(`presence.crewCamp.draft.${uid}`)).value.rejectionReason,state.uid)==='오프라인이어도 입력 유지');await page.evaluate(()=>{window.__qaOnline=true;sessionStorage.clear()});await open(page,'qa200');
   state.fail='합성 저장 서버 오류 · 다시 시도해 주세요.';const failedRevision=state.candidate('qa200').revision;await formField(page,'rejectionReason').fill('서버 오류에도 유지할 사유');await page.locator('#draft-status').filter({hasText:'합성 저장 서버 오류'}).waitFor();check(`${tag} server error keeps reason and cloud revision`,await formField(page,'rejectionReason').inputValue()==='서버 오류에도 유지할 사유'&&state.candidate('qa200').revision===failedRevision);check(`${tag} server error draft preserved`,await page.evaluate(uid=>JSON.parse(sessionStorage.getItem(`presence.crewCamp.draft.${uid}`)).value.rejectionReason,state.uid)==='서버 오류에도 유지할 사유');state.fail='';await page.evaluate(()=>sessionStorage.clear());await open(page,'qa200');
   state.delay=500;const before=state.transactionsStarted;await formField(page,'rejectionReason').fill('저장 대기 중인 입력');await waitUntil(page,()=>state.transactionsStarted>before,'pending transaction');await page.locator('#editor-close').click();check(`${tag} pending close blocked`,await page.locator('#editor').evaluate(e=>e.open));await page.evaluate(()=>{location.hash='candidate/qa100'});check(`${tag} pending superseding candidate blocked`,await formField(page,'name').inputValue()===state.candidate('qa200').name);await waitUntil(page,()=>state.candidate('qa200').rejectionReason==='저장 대기 중인 입력','pending save complete');state.delay=0;
   // Actual store.js checks the live synthetic auth session before transactions.
   state.tree.authSessions['qa-auth']={userUid:'qa-other'};const writes=state.writes.length;await formField(page,'rejectionReason').fill('계정 변경 시 보존하는 입력');await page.locator('#draft-status').filter({hasText:'계정이 바뀌'}).waitFor();check(`${tag} changed account cannot save`,state.writes.length===writes&&state.candidate('qa200').rejectionReason==='저장 대기 중인 입력');check(`${tag} changed account keeps correct old draft`,await page.evaluate(uid=>JSON.parse(sessionStorage.getItem(`presence.crewCamp.draft.${uid}`)).value.rejectionReason,state.uid)==='계정 변경 시 보존하는 입력');await page.goto(`${base}/recruiting/index.html?v=qa-other`,{waitUntil:'networkidle'});check(`${tag} other account sees no old reason`,await page.locator('#editor[open]').count()===0&&!(await page.locator('body').textContent()).includes('계정 변경 시 보존하는 입력'));state.tree.authSessions['qa-auth']={userUid:state.uid};await page.evaluate(()=>sessionStorage.clear());
   await page.goto(`${base}/recruiting/index.html?v=qa-tools`,{waitUntil:'networkidle'});await page.locator('[data-tab="tools"]').click();await page.locator('#sheet-absent').click();const tsv=await page.evaluate(()=>window.__qaCopied.at(-1));check(`${tag} absent clipboard headerless 10 cells`,typeof tsv==='string'&&tsv.split('\n').length===1&&tsv.split('\t').length===10,tsv);check(`${tag} absent clipboard exact source day recruiter`,tsv===`11/18\t합성후보 qa400\t24세\t0507-1234-5678\t임재영\t11/18\t\t\t\thttps://www.albamon.com/human-resources/detail/400`,tsv);check(`${tag} absent clipboard success status`,(await page.locator('#toast').textContent()).includes('복사'));
   const copies=await page.evaluate(()=>window.__qaCopied.length);await page.locator('#report-date').fill('2026-11-17');await page.locator('#sheet-absent').click();check(`${tag} empty eligible day does not copy`,await page.evaluate(()=>window.__qaCopied.length)===copies);check(`${tag} empty eligible status`,(await page.locator('#toast').textContent()).includes('없'));
   check(`${tag} role does not expose admin-only DOM`,role==='admin'||await page.locator('[data-admin-only],#admin-panel').count()===0);check(`${tag} no external writes or SMS requests`,state.external.length===0,JSON.stringify(state.external));check(`${tag} no console or page errors`,!errors.length,JSON.stringify(errors));check(`${tag} real store transaction exercised`,state.writes.some(w=>w.op==='transaction'));
  }catch(error){check(`${tag} scenario completes`,false,error.stack);await page.screenshot({path:`${out}/${tag}-FAIL.png`}).catch(()=>{});}
  finally{await context.close();await writeFile(`${out}/report.json`,JSON.stringify({base,checks,failures},null,2));}
 }
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({base,checks,failures},null,2));console.log(JSON.stringify({passed:checks.length,failed:failures.length,failures},null,2));}
assert.equal(failures.length,0);
