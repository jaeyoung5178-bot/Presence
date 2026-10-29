// Synthetic identifiers only. No source-site credentials, paid actions or real saves.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const values={},created=[],updates=[],sent=[];let handler;
const chrome={storage:{session:{get:async()=>({...values}),set:async value=>Object.assign(values,value),remove:async key=>delete values[key]}},runtime:{onMessage:{addListener:value=>handler=value}},tabs:{create:async options=>{const tab={id:101+created.length,...options};created.push(tab);return tab;},update:async(id,options)=>updates.push({id,...options}),query:async()=>[],sendMessage:async(id,message)=>sent.push({id,...message}),onRemoved:{addListener:()=>{}},onUpdated:{addListener:()=>{}}}};
const context=vm.createContext({chrome,URL,Date});
vm.runInContext(fs.readFileSync(__dirname+'/resume-sources.js','utf8')+fs.readFileSync(__dirname+'/background.js','utf8').replace("importScripts('resume-sources.js');",''),context);
const normalize=context.PresenceResumeSources.normalizeResumeURL;
const send=(message,url,id=10)=>new Promise(resolve=>handler(message,{tab:{id,url}},resolve));
(async()=>{
 const hub='https://hub.presence.co.kr/recruiting/index.html',popup='https://www.alba.co.kr/resume/popup/ResumeDetail?adid=11111111',detail='https://www.alba.co.kr/resume/Detail?adid=11111111',requestId='11111111-1111-4111-8111-111111111111';
 const source=normalize(popup+'&useai=N');assert.equal(source.url,popup);assert.equal(source.view,'popup');assert.equal(source.key,normalize(detail).key);
 assert.equal(normalize('https://alba.co.kr/RESUME/POPUP/RESUMEDETAIL/?ADID=11111111').url,popup);
 for(const invalid of [popup+'&adid=22222222',popup+'&gourl=https://example.test',popup.replace('www.alba.co.kr','www.alba.co.kr.evil.test'),popup.replace('/ResumeDetail','/ResumeDetail/other'),popup.replace('https:','http:')])assert.equal(normalize(invalid),null,invalid);
 const ping=await send({type:'CREW_PING'},hub);assert.equal(ping.extensionVersion,'4.0.1');assert(ping.features.includes('albacheonguk-popup'));
 assert((await send({type:'CREW_IMPORT',url:popup+'&useai=N',requestId},hub)).ok);assert.equal(created[0].url,popup);assert.equal(created[0].active,false);
 assert((await send({type:'CREW_JOB'},detail,101)).ok,'Same resume may redirect from popup to detail');
 assert(!(await send({type:'CREW_JOB'},popup.replace('11111111','22222222'),101)).ok,'Another ID cannot claim the request');
 const payload={name:'홍테스트',mobile:'010-0000-0000',contactOpened:true,education:'합성대학교',password:'not-forwarded'};
 assert(!(await send({type:'CREW_RESULT',payload},popup.replace('11111111','22222222'),101)).ok);
 assert((await send({type:'CREW_RESULT',payload},detail,101)).ok);
 const result=sent.find(message=>message.type==='CREW_RESULT');assert.equal(result.payload.url,detail);assert.equal(result.payload.sourceService,'albacheonguk');assert(!('password' in result.payload));assert(updates.some(tab=>tab.id===10&&tab.active));
 console.log('Popup route, capabilities, preserved navigation, shared identity and wrong-resume rejection passed');
})().catch(error=>{console.error(error);process.exit(1);});
