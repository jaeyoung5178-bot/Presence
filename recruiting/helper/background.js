importScripts('resume-sources.js');
const api=chrome,jobStore=chrome.storage.session||chrome.storage.local,hubURL='https://hub.presence.co.kr/recruiting/index.html';
const normalize=globalThis.PresenceResumeSources.normalizeResumeURL;
const isHub=url=>{try{const u=new URL(url);return (u.origin==='https://hub.presence.co.kr'||u.origin==='http://127.0.0.1:4189')&&u.pathname.startsWith('/recruiting/');}catch{return false;}};
const isSource=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['albamon.com','www.albamon.com','alba.co.kr','www.alba.co.kr'].includes(u.hostname);}catch{return false;}};
const isSourceLogin=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['albamon.com','www.albamon.com','alba.co.kr','www.alba.co.kr','sign.alba.co.kr'].includes(u.hostname)&&/\/(?:auth|login)(?:\/|$)|sign-in|signin/i.test(u.pathname);}catch{return false;}};
const jobKey=id=>'crewJob_'+id;
async function jobs(){return jobStore.get(null);}
async function findJob(tabId){const all=await jobs();return Object.values(all).find(j=>(j?.sourceTab??j?.albamonTab)===tabId&&Date.now()-j.at<300000);}
function sanitize(p,source){
 const out={version:2,url:source.url,sourceService:source.sourceService};
 for(const [k,n]of Object.entries({name:80,age:20,phone:30,mobile:30,education:4000,career:4000,wish:2000,note:4000,relate:1000}))out[k]=String(p[k]||'').slice(0,n);
 out.gender=['남','여'].includes(p.gender)?p.gender:'';
 out.nameMasked=!!p.nameMasked||!out.name||/[*＊○●◯〇Ｏ×•·]|비공개|미공개|로그인/.test(out.name)||/^(?:성명|이름)$/.test(out.name)||/[xXoO]{2,}|[가-힣][xXoO]+$/.test(out.name);
 const validPhone=value=>/^(?:010|01[16789]|050\d)[-\s]?\d{3,4}[-\s]?\d{4}$/.test(value.trim());
 out.phone=validPhone(out.phone)?out.phone:'';out.mobile=validPhone(out.mobile)?out.mobile:'';
 out.loginRequired=!!p.loginRequired;out.contactOpened=!!p.contactOpened&&!!(out.phone||out.mobile)&&!out.loginRequired;
 out.capturedAt=Date.now();return out;
}
async function notify(job,payload){try{await api.tabs.sendMessage(job.hubTab,{type:'CREW_RESULT',requestId:job.id,payload});}catch{await api.tabs.update(job.hubTab,{url:job.hubURL+'#capture='+encodeURIComponent(JSON.stringify(payload))});}}
api.runtime.onMessage.addListener((message,sender,reply)=>{(async()=>{
 if(message?.type==='CREW_PING'&&isHub(sender.tab?.url))return {ok:true,version:4,extensionVersion:'4.0.0',sources:['albamon','albacheonguk']};
 if(message?.type==='CREW_IMPORT'&&isHub(sender.tab?.url)){
  const source=normalize(message.url);if(!source)return {ok:false,error:'알바몬 또는 알바천국의 개별 이력서 링크를 넣어 주세요.'};
  const id=String(message.requestId||'').slice(0,100);if(!/^[a-zA-Z0-9-]{10,100}$/.test(id))return {ok:false,error:'요청을 다시 시작해 주세요.'};
  const tab=await api.tabs.create({url:source.url,active:false}),job={id,url:source.url,sourceService:source.sourceService,key:source.key,hubTab:sender.tab.id,hubURL:sender.tab.url.split('#')[0],sourceTab:tab.id,at:Date.now()};
  await jobStore.set({[jobKey(id)]:job});try{await api.tabs.sendMessage(tab.id,{type:'CREW_READ_NOW'});}catch{}return {ok:true,requestId:id};
 }
 if(message?.type==='CREW_JOB'&&normalize(sender.tab?.url)){
  const job=await findJob(sender.tab.id),source=normalize(sender.tab.url);return job&&source.url===job.url?{ok:true,job:{id:job.id,url:job.url,sourceService:source.sourceService}}:{ok:false};
 }
 if(['CREW_FOCUS_ALBAMON','CREW_FOCUS_SOURCE'].includes(message?.type)&&isHub(sender.tab?.url)){
  const all=await jobs(),job=all[jobKey(message.requestId)];if(!job||job.hubTab!==sender.tab.id||Date.now()-job.at>300000)return {ok:false};await api.tabs.update(job.sourceTab??job.albamonTab,{active:true});return {ok:true};
 }
 if(message?.type==='CREW_RESULT'&&normalize(sender.tab?.url)){
  const job=await findJob(sender.tab.id),source=normalize(sender.tab.url);if(!job||source.url!==job.url)return {ok:false};
  const payload=sanitize(message.payload||{},source);await notify(job,payload);
  if(payload.contactOpened&&!payload.nameMasked){await api.tabs.update(job.hubTab,{active:true});await jobStore.set({[jobKey(job.id)]:{...job,completed:true}});}return {ok:true};
 }
 if(message?.type==='PRESENCE_CAPTURE'&&normalize(sender.tab?.url)){
  const source=normalize(sender.tab.url),payload=sanitize(message.payload||{},source),tabs=await api.tabs.query({url:'https://hub.presence.co.kr/recruiting/*'}),url=hubURL+'#capture='+encodeURIComponent(JSON.stringify(payload));
  const hub=tabs[0]||await api.tabs.create({url,active:true});if(tabs.length)await api.tabs.update(hub.id,{url,active:true});
  const id='monster-'+Date.now()+'-'+sender.tab.id,job={id,url:source.url,sourceService:source.sourceService,key:source.key,hubTab:hub.id,hubURL,sourceTab:sender.tab.id,at:Date.now()};
  for(const [key,prior]of Object.entries(await jobs()))if((prior?.sourceTab??prior?.albamonTab)===sender.tab.id)await jobStore.remove(key);
  await jobStore.set({[jobKey(id)]:job});return {ok:true,job:{id,url:source.url,sourceService:source.sourceService}};
 }
 if(message?.type==='CREW_OPEN_HUB'&&isSource(sender.tab?.url)){const tabs=await api.tabs.query({url:'https://hub.presence.co.kr/recruiting/*'});if(tabs.length)await api.tabs.update(tabs[0].id,{active:true});else await api.tabs.create({url:hubURL,active:true});return {ok:true};}
 return {ok:false,error:'지원하지 않는 요청입니다.'};
})().then(reply).catch(e=>reply({ok:false,error:e.message||'브라우저 연결 실패'}));return true;});
api.tabs.onRemoved.addListener(async id=>{for(const [key,job]of Object.entries(await jobs()))if((job?.sourceTab??job?.albamonTab)===id||job?.hubTab===id||Date.now()-job?.at>300000)await jobStore.remove(key);});
api.tabs.onUpdated.addListener(async(id,change)=>{
 if(!change.url)return;const job=await findJob(id);if(!job)return;
 if(isSourceLogin(change.url))await notify(job,{version:2,url:job.url,sourceService:job.sourceService,loginRequired:true,name:'',nameMasked:true,contactOpened:false});
 // A result from a redirect or another resume can never complete the original request.
});
