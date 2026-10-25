const api=chrome,jobStore=chrome.storage.session||chrome.storage.local,hubURL='https://hub.presence.co.kr/recruiting/index.html';
const isHub=url=>{try{const u=new URL(url);return (u.origin==='https://hub.presence.co.kr'||u.origin==='http://127.0.0.1:4189')&&u.pathname.startsWith('/recruiting/');}catch{return false;}};
const normalize=url=>{try{const u=new URL(url);if(u.protocol!=='https:'||!['albamon.com','www.albamon.com'].includes(u.hostname)||!/^\/human-resources\/detail\/\d+\/?$/.test(u.pathname))return '';return u.origin+u.pathname;}catch{return '';}};
const jobKey=id=>'crewJob_'+id;
async function jobs(){return jobStore.get(null);}
async function findJob(tabId){const all=await jobs();return Object.values(all).find(j=>j?.albamonTab===tabId&&Date.now()-j.at<300000);}
function sanitize(p,url){const out={version:2,url};for(const [k,n]of Object.entries({name:80,age:20,phone:30,mobile:30,education:4000,career:4000,wish:2000,note:4000,relate:1000}))out[k]=String(p[k]||'').slice(0,n);out.gender=['남','여'].includes(p.gender)?p.gender:'';for(const k of ['contactOpened','nameMasked','loginRequired'])out[k]=!!p[k];out.capturedAt=Date.now();return out;}
async function notify(job,payload){try{await api.tabs.sendMessage(job.hubTab,{type:'CREW_RESULT',requestId:job.id,payload});}catch{await api.tabs.update(job.hubTab,{url:job.hubURL+'#capture='+encodeURIComponent(JSON.stringify(payload))});}}
api.runtime.onMessage.addListener((message,sender,reply)=>{(async()=>{
 if(message?.type==='CREW_PING'&&isHub(sender.tab?.url))return {ok:true,version:2};
 if(message?.type==='CREW_IMPORT'&&isHub(sender.tab?.url)){
  const url=normalize(message.url);if(!url)return {ok:false,error:'알바몬 이력서 상세 링크를 넣어 주세요.'};const id=String(message.requestId||'').slice(0,100);if(!/^[a-zA-Z0-9-]{10,100}$/.test(id))return {ok:false,error:'요청을 다시 시작해 주세요.'};
  const tab=await api.tabs.create({url,active:false}),job={id,url,hubTab:sender.tab.id,hubURL:sender.tab.url.split('#')[0],albamonTab:tab.id,at:Date.now()};await jobStore.set({[jobKey(id)]:job});try{await api.tabs.sendMessage(tab.id,{type:'CREW_READ_NOW'});}catch{}return {ok:true,requestId:id};
 }
 if(message?.type==='CREW_JOB'&&normalize(sender.tab?.url)){const job=await findJob(sender.tab.id);return job?{ok:true,job:{id:job.id,url:job.url}}:{ok:false};}
 if(message?.type==='CREW_FOCUS_ALBAMON'&&isHub(sender.tab?.url)){const all=await jobs(),job=all[jobKey(message.requestId)];if(!job||job.hubTab!==sender.tab.id)return {ok:false};await api.tabs.update(job.albamonTab,{active:true});return {ok:true};}
 if(message?.type==='CREW_RESULT'&&normalize(sender.tab?.url)){const job=await findJob(sender.tab.id);if(!job)return {ok:false};const url=normalize(sender.tab.url);if(url!==job.url)return {ok:false};const payload=sanitize(message.payload||{},url);await notify(job,payload);if(payload.contactOpened&&!payload.nameMasked){await api.tabs.update(job.hubTab,{active:true});await jobStore.set({[jobKey(job.id)]:{...job,completed:true}});}return {ok:true};}
 if(message?.type==='PRESENCE_CAPTURE'&&normalize(sender.tab?.url)){
  const source=normalize(sender.tab.url),payload=sanitize(message.payload||{},source),tabs=await api.tabs.query({url:'https://hub.presence.co.kr/recruiting/*'}),url=hubURL+'#capture='+encodeURIComponent(JSON.stringify(payload));
  const hub=tabs[0]||await api.tabs.create({url,active:true});if(tabs.length)await api.tabs.update(hub.id,{url,active:true});
  const id='monster-'+Date.now()+'-'+sender.tab.id,job={id,url:source,hubTab:hub.id,hubURL,albamonTab:sender.tab.id,at:Date.now()};
  for(const [key,prior]of Object.entries(await jobs()))if(prior?.albamonTab===sender.tab.id)await jobStore.remove(key);
  await jobStore.set({[jobKey(id)]:job});return {ok:true,job:{id,url:source}};
 }
 if(message?.type==='CREW_OPEN_HUB'&&normalize(sender.tab?.url)){const tabs=await api.tabs.query({url:'https://hub.presence.co.kr/recruiting/*'});if(tabs.length)await api.tabs.update(tabs[0].id,{active:true});else await api.tabs.create({url:hubURL,active:true});return {ok:true};}
 return {ok:false,error:'지원하지 않는 요청입니다.'};
})().then(reply).catch(e=>reply({ok:false,error:e.message||'브라우저 연결 실패'}));return true;});
api.tabs.onRemoved.addListener(async id=>{for(const [key,job]of Object.entries(await jobs()))if(job?.albamonTab===id||job?.hubTab===id||Date.now()-job?.at>300000)await jobStore.remove(key);});
api.tabs.onUpdated.addListener(async(id,change)=>{if(!change.url)return;const job=await findJob(id);if(!job)return;try{const u=new URL(change.url);if(['albamon.com','www.albamon.com'].includes(u.hostname)&&/login|sign-in|signin/i.test(u.pathname))await notify(job,{version:2,url:job.url,loginRequired:true,name:'',contactOpened:false});}catch{}});
