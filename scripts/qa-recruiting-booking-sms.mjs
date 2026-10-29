import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const base = process.env.RECRUITING_QA_URL || 'http://127.0.0.1:8771';
const out = process.env.RECRUITING_QA_OUT || '/tmp/presence-recruiting-booking-sms-qa';
await mkdir(out,{recursive:true});
const checks=[],failures=[];
const check=(name,value,detail='')=>(value?checks:failures).push({name,detail});
const mk=(id,name,day,time,mobile,status='booked')=>({id,name,interviewDate:day,interviewTime:time,mobile,phone:'',status,revision:1,note:'QA 합성 기록',events:{},age:'24세',gender:'',url:'',recruiter:'QA',nextDate:'',relate:''});
const fixture={candidates:Object.fromEntries([
  mk('qa-one','김하늘','2026-10-29','11:00','010-1234-5678'),
  mk('qa-two','이바다 <img src=x onerror=alert(1)>','2026-10-29','14:00','+82 10-2345-6789'),
  mk('qa-dateonly','날짜만 약속','2026-10-30','','010 3456 7890'),
  mk('qa-invalid','번호 없는 동료','2026-10-31','09:00','not-a-number'),
  mk('qa-nextmonth','다음달 만남','2026-11-02','13:00','01045678901'),
  mk('qa-unbooked','부킹하지 않은 후보','2026-10-29','15:00','01056789012','new'),
  mk('qa-unscheduled','일정 없는 후보','','',''),
].map(c=>[c.id,c])),settings:{name:'QA',sound:false,sheetEndpoint:''},reports:{}};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
async function geometry(page,tag){const v=await page.evaluate(()=>{const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};const controls=[...document.querySelectorAll('button,a,input,select,textarea')].filter(visible);return{overflow:document.documentElement.scrollWidth>innerWidth+1,small:controls.filter(e=>{const r=e.getBoundingClientRect();return innerWidth<=1024&&(r.height<43.5||r.width<43.5)}).map(e=>({id:e.id,text:e.textContent.slice(0,30),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),images:[...document.images].filter(visible).filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}});check(`${tag} no overflow`,!v.overflow);check(`${tag} touch targets`,!v.small.length,JSON.stringify(v.small));check(`${tag} images`,!v.images.length,JSON.stringify(v.images));}
try{
for(const role of ['member','leader','admin'])for(const viewport of [{width:390,height:844},{width:1024,height:768},{width:1440,height:900}]){
const tag=`${role}-${viewport.width}`,context=await browser.newContext({viewport,timezoneId:'Asia/Seoul'});
await context.addInitScript(({fixture,role})=>{window.__qaFixture=fixture;window.__qaRole=role;const NativeDate=Date;globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-10-29T03:00:00Z']))}static now(){return NativeDate.parse('2026-10-29T03:00:00Z')}}},{fixture,role});
await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});if(u.pathname.endsWith('/recruiting/store.js'))return route.fulfill({contentType:'text/javascript',body:`export const auth={restore:async()=>({uid:'qa-'+window.__qaRole,name:'QA',role:window.__qaRole}),logout:async()=>{}};export async function firebase(){throw Error('QA prohibits real Firebase')}export async function createCloud(user,onData,onState){onData(structuredClone(window.__qaFixture));onState('QA mocked cloud');return{close(){},async save(){throw Error('QA prohibits writes')},async settings(){throw Error('QA prohibits writes')},async report(){throw Error('QA prohibits writes')}}}`});return u.origin===new URL(base).origin&&['GET','HEAD'].includes(req.method())?route.continue():route.abort()});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(`${base}/recruiting/index.html?v=booking-sms-qa`,{waitUntil:'networkidle'});await page.locator('[data-tab="calendar"]').click();await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});await geometry(page,`${tag} calendar`);
await page.screenshot({path:`${out}/${tag}-calendar.png`,fullPage:true});
if(process.env.RECRUITING_QA_ROUTE_ONLY==='1'){
check(`${tag} defaults to weekday view`,await page.locator('.calendar-grid').getAttribute('data-view')==='week');
await page.evaluate(({role,record})=>sessionStorage.setItem(`presence.crewCamp.draft.qa-${role}`,JSON.stringify({value:record,baseRevision:1,dirty:true})),{role,record:fixture.candidates['qa-two']});
await page.goto(`${base}/recruiting/index.html#candidate/qa-one`,{waitUntil:'networkidle'});await page.locator('#editor[open]').waitFor();
check(`${tag} direct route precedes unrelated draft`,await page.locator('#candidate-form [name="name"]').inputValue()==='김하늘');
check(`${tag} other draft remains preserved`,await page.evaluate(role=>JSON.parse(sessionStorage.getItem(`presence.crewCamp.draft.qa-${role}`)).value.id==='qa-two',role));
check(`${tag} no console errors`,errors.length===0,JSON.stringify(errors));await context.close();continue;
}
const cell=page.locator('.calendar-day[data-date="2026-10-29"]');
check(`${tag} correct Thursday`,(await cell.locator('.calendar-date').textContent()).includes('목'));
check(`${tag} same day two distinct bookings`,await cell.locator('.calendar-booking').count()===2);
check(`${tag} unbooked excluded`,await page.locator('.calendar-booking[data-edit="qa-unbooked"]').count()===0);
check(`${tag} date only retains unknown time`,(await page.locator('.calendar-booking[data-edit="qa-dateonly"]').textContent()).includes('시간 미정'));
check(`${tag} date only list avoids invented time`,(await page.locator('.appointment').filter({has:page.locator('[data-edit="qa-dateonly"]')}).locator('.appointment-actions').textContent()).includes('시간 미정'));
await page.locator('.calendar-booking[data-edit="qa-two"]').click();await page.locator('#editor[open]').waitFor();
check(`${tag} calendar opens correct independent candidate`,await page.locator('#candidate-form [name="name"]').inputValue()===fixture.candidates['qa-two'].name&&new URL(page.url()).hash==='#candidate/qa-two');
check(`${tag} intl SMS normalized`,await page.locator('#direct-message a').getAttribute('href')==='sms:+821023456789');
check(`${tag} SVG message icon`,await page.locator('#direct-message a svg').count()===1);
await geometry(page,`${tag} detail`);
await page.screenshot({path:`${out}/${tag}-detail.png`,fullPage:true});
await page.locator('#candidate-form [name="mobile"]').fill('010 2222-3333');
check(`${tag} edited SMS recipient updates`,await page.locator('#direct-message a').getAttribute('href')==='sms:01022223333');
await page.locator('#candidate-form [name="mobile"]').fill('javascript:alert(1)');
check(`${tag} invalid SMS disabled`,await page.locator('#direct-message button').isDisabled()&&await page.locator('#direct-message a').count()===0);
await page.locator('#candidate-form [name="mobile"]').fill(fixture.candidates['qa-two'].mobile);
await page.locator('#editor-close').click();await page.locator('#keep-draft').click();
await page.locator('[data-calendar-view="week"]').click();
check(`${tag} weekday view seven days`,await page.locator('.calendar-day').count()===7);
await geometry(page,`${tag} week`);await page.screenshot({path:`${out}/${tag}-week.png`,fullPage:true});
await page.locator('[data-calendar-move="1"]').click();
check(`${tag} next week correct candidate`,await page.locator('.calendar-booking[data-edit="qa-nextmonth"]').count()===1);
await page.locator('#calendar-today').click();await page.locator('[data-calendar-view="month"]').click();await page.locator('[data-calendar-move="1"]').click();
check(`${tag} next month correct title`,(await page.locator('#calendar-title').textContent()).includes('11월'));
await page.locator('#calendar-today').click();
await page.locator('[data-calendar-day="2026-10-28"]').click();
check(`${tag} empty date creates correctly dated record`,await page.locator('#candidate-form [name="interviewDate"]').inputValue()==='2026-10-28');
await page.locator('#editor-close').click();
await page.locator('[data-tab="camp"]').click();
check(`${tag} upcoming SMS sibling exact recipient`,await page.locator('.next-card a[data-message="qa-one"]').getAttribute('href')==='sms:01012345678');
check(`${tag} no nested interactive controls`,await page.locator('button button,button a[href]').count()===0);
await page.locator('.next-card [data-edit="qa-one"]').click();await page.locator('#editor[open]').waitFor();
check(`${tag} upcoming opens right candidate`,await page.locator('#candidate-form [name="name"]').inputValue()==='김하늘');
check(`${tag} keyboard focus in dialog`,await page.evaluate(()=>document.querySelector('#editor').contains(document.activeElement)));
await page.keyboard.press('Escape');
check(`${tag} Escape closes candidate`,!await page.locator('#editor').evaluate(e=>e.open));
await page.goto(`${base}/recruiting/index.html#candidate/qa-one`,{waitUntil:'networkidle'});await page.locator('#editor[open]').waitFor();
check(`${tag} direct candidate route restores exact card`,await page.locator('#candidate-form [name="name"]').inputValue()==='김하늘');
check(`${tag} no injected DOM`,await page.locator('img[src="x"]').count()===0);
check(`${tag} no admin DOM`,role==='admin'||await page.locator('[data-admin-only],#admin-panel').count()===0);
check(`${tag} no console errors`,errors.length===0,JSON.stringify(errors));
await context.close();
}
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({checks,failures},null,2));console.log(JSON.stringify({passed:checks.length,failed:failures.length,failures},null,2));}
assert.equal(failures.length,0);
