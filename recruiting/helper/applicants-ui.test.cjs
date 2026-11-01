const {chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const out=process.env.CREW_APPLICANTS_OUT||'/private/tmp/presence-applicants-helper-qa';
(async()=>{
 await fs.mkdir(out,{recursive:true});const html=await fs.readFile(__dirname+'/../../scripts/fixtures/alba-applicants-sms.html','utf8');
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{for(const role of ['member','leader','admin'])for(const [width,height]of [[390,844],[1024,768],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://www.alba.co.kr/**',route=>route.fulfill({body:html,contentType:'text/html'}));
  const url='https://www.alba.co.kr/biz/applicants/ApplicantsDetailView?adid=0&jobadid=12345678&application_idx=11111111';await page.goto(url);
  await page.evaluate(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){return original.call(this,{...options,mode:'open'});};window.sent=[];window.chrome={runtime:{lastError:null,onMessage:{addListener:()=>{}},sendMessage(message,callback){window.sent.push(message);queueMicrotask(()=>callback(message.type==='CREW_JOB'?{ok:false}:{ok:true,job:{id:'synthetic-applicant-job',url:location.href}}));}}};});
  for(const file of ['resume-sources.js','extractor.js','monster.js','content.js'])await page.addScriptTag({path:__dirname+'/'+file});
  const helper=page.locator('#presence-camp-helper'),manual=helper.locator('#manual'),state=helper.locator('#state');await helper.locator('#wake').click();assert(await manual.isEnabled());assert.match(await state.innerText(),/4\.1\.0.*문자지원/);
  const geometry=await helper.evaluate(element=>[...element.shadowRoot.querySelectorAll('button,.panel')].filter(node=>!node.hidden&&node.getBoundingClientRect().width).map(node=>{const r=node.getBoundingClientRect();return{id:node.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
  for(const rect of geometry){assert(rect.x>=0&&rect.y>=0&&rect.right<=width+1&&rect.bottom<=height+1,JSON.stringify(rect));if(rect.id!=='menu')assert(rect.width>=44&&rect.height>=44,JSON.stringify(rect));}
  await manual.click();await page.waitForFunction(()=>window.sent.some(message=>message.type==='PRESENCE_CAPTURE'));
  const captured=await page.evaluate(()=>window.sent.find(message=>message.type==='PRESENCE_CAPTURE').payload);assert.equal(captured.name,'홍테스트');assert.equal(captured.gender,'남');assert.equal(captured.age,'24세');assert.equal(captured.mobile,'010-1234-5678');assert.equal(captured.education,'');assert.equal(captured.career,'');assert.match(captured.note,/지원 메시지/);assert(!/운영자|010-8888|010-9999/.test(JSON.stringify(captured)));
  await page.screenshot({path:out+'/'+role+'-'+width+'-sms.png'});
  await page.evaluate(()=>{window.savedSMS=document.querySelector('.resume-sms');window.savedSMS.remove();});await page.waitForFunction(()=>document.querySelector('#presence-camp-helper').shadowRoot.querySelector('#manual').disabled);assert.match(await state.innerText(),/본문을 확인/);assert.doesNotMatch(await state.innerText(),/로그인/);
  await page.evaluate(()=>{document.title='로그인';document.body.append(document.createElement('i'));});await page.waitForFunction(()=>document.querySelector('#presence-camp-helper').shadowRoot.querySelector('#state').textContent.includes('로그인이 필요'));
  await page.evaluate(()=>{document.title='Synthetic application';document.querySelector('#ResumeView1').append(window.savedSMS);});await page.waitForFunction(()=>!document.querySelector('#presence-camp-helper').shadowRoot.querySelector('#manual').disabled);
  await page.evaluate(()=>{history.pushState({},'','/biz/applicants/UnsupportedDetail?adid=0');document.body.append(document.createElement('i'));});await page.waitForFunction(()=>document.querySelector('#presence-camp-helper').shadowRoot.querySelector('#manual').disabled);assert.match(await state.innerText(),/이 주소.*업데이트/);
  const unsupported=await page.evaluate(()=>PresenceResumeExtract.extract(document,location.href));assert.equal(unsupported.name,'');assert.equal(unsupported.mobile,'');assert.equal(unsupported.note,'');
  await page.evaluate(()=>{history.pushState({},'','/resume/list/Main.asp');document.body.append(document.createElement('i'));});await page.waitForFunction(()=>document.querySelector('#presence-camp-helper').shadowRoot.querySelector('#state').textContent.includes('인재 목록'));
  assert.deepEqual(errors,[]);await page.close();console.log(role+' '+width+' SMS capture, scoped fields, loading/login/unsupported/list states and geometry passed');
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
