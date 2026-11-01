(()=>{
 'use strict';if(document.getElementById('presence-camp-helper'))return;
 const version='4.1.0',ui=globalThis.PresenceMonster(),{host,$}=ui;
 const status=message=>ui.state('도우미 '+version+' · '+message);
 let enabled=false,job=null,last='',timer,pendingUntil=0,busy=false,contextURL='',contextState='';
 const source=()=>globalThis.PresenceResumeSources.normalizeResumeURL(location.href);
 const label=()=>source()?.label||'이력서 사이트';
 const inspect=()=>globalThis.PresenceResumeExtract.inspect(document,location.href);
 function syncContext(){
  const info=inspect(),current=source()?.url||location.href,changed=contextURL!==current;
  if(changed){contextURL=current;job=null;last='';enabled=false;pendingUntil=0;ui.toggle(false);}
  if(changed||contextState!==info.code){contextState=info.code;status(info.message);}
  $('manual').disabled=busy||info.code!=='ready';$('toggle').disabled=info.code!=='ready';
  return info;
 }
 syncContext();
 const read=()=>globalThis.PresenceResumeExtract.extract(document,source().url);
 function runtime(message){return new Promise((resolve,reject)=>{try{chrome.runtime.sendMessage(message,result=>{if(chrome.runtime.lastError)reject(Object.assign(Error('도우미 '+version+' 연결을 확인하고 이력서 화면을 새로고침해 주세요.'),{code:'extension-disconnected'}));else if(!result?.ok)reject(Error(result?.error||'캠프 연결을 확인하고 다시 눌러 주세요.'));else resolve(result);});}catch{reject(Object.assign(Error('확장앱 연결이 끊겼어요. 도우미 '+version+'가 켜져 있는지 확인하고 이력서 화면을 새로고침해 주세요.'),{code:'extension-disconnected'}));}});}
 async function send(manual=false){
  if(busy)return;
  if(syncContext().code!=='ready'){ui.setOpen(true);return;}
  const payload=read(),fingerprint=JSON.stringify([source().url,payload.name,payload.phone,payload.mobile,payload.education,payload.career,payload.wish]);
  if(!manual&&fingerprint===last)return;
  if(!payload.name&&!payload.education&&!payload.career){status('이력서 본문이 아직 준비되지 않았어요. 이름·학력·경력이 화면에 보이면 다시 눌러 주세요.');ui.setOpen(true);return;}
  busy=true;$('manual').disabled=true;ui.mood('');status('이 친구의 정보를 챙겨서 캠프를 열고 있어요…');
  try{
   const result=await runtime({type:manual?'PRESENCE_CAPTURE':job?'CREW_RESULT':'PRESENCE_CAPTURE',payload});
   if(result.job)job=result.job;last=fingerprint;enabled=true;ui.toggle(enabled);ui.mood('success');
   status(payload.contactOpened&&!payload.nameMasked?'캠프에 정보를 채웠어요! 통화 메모와 결과를 이어서 남겨 주세요.':'공개된 정보부터 캠프에 담았어요. '+label()+'에서 이름·번호를 열람하면 나머지도 이어서 채워져요.');
  }catch(error){last='';ui.mood('error');status(error.message);ui.setOpen(true);}
  finally{busy=false;syncContext();}
 }
 async function find(){
  if(!source())return;
  try{const result=await runtime({type:'CREW_JOB'});if(result.job){job=result.job;enabled=true;ui.toggle(enabled);send();}}catch(error){if(error.code==='extension-disconnected'){ui.mood('error');status(error.message);}}
 }
 $('manual').onclick=()=>send(true);
 $('toggle').onclick=()=>{enabled=!enabled;ui.toggle(enabled);status(enabled?label()+'에서 직접 번호를 공개하면 새 정보를 이어서 가져올게요.':'자동 채우기를 껐어요. 정보 가져오기는 직접 누를 수 있어요.');};
 $('open-camp').onclick=async()=>{try{await runtime({type:'CREW_OPEN_HUB'});}catch(error){status(error.message);}};
 document.addEventListener('click',event=>{
  if(!enabled||!event.isTrusted||event.composedPath().includes(host))return;
  const button=event.target.closest('button,a,[role="button"]');
  if(!button||!/(전화번호|연락처|휴대폰|번호)\s*(보기|확인|열람)|^열람하기$|^확인하기$|연락처\s*공개/.test(button.innerText?.trim()||''))return;
  pendingUntil=Date.now()+15000;clearTimeout(timer);timer=setTimeout(()=>send(),1500);
 },true);
 const observer=new MutationObserver(mutations=>{
  if(mutations.every(mutation=>host.contains(mutation.target)))return;
  syncContext();if(!enabled)return;clearTimeout(timer);timer=setTimeout(()=>{if(Date.now()<pendingUntil||job)send();},600);
 });
 observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});
 chrome.runtime.onMessage.addListener(message=>{if(message?.type==='CREW_READ_NOW')find();});
 find();setTimeout(find,1000);
})();
