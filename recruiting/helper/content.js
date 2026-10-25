(()=>{
 'use strict';if(document.getElementById('presence-camp-helper'))return;
 const ui=globalThis.PresenceMonster(),{host,$}=ui;
 let enabled=false,job=null,last='',timer,pendingUntil=0,busy=false;
 const isResume=()=>/^\/human-resources\/detail\/\d+\/?$/.test(location.pathname);
 let contextPath=location.pathname;
 function syncContext(){if(contextPath!==location.pathname){contextPath=location.pathname;job=null;last='';enabled=false;pendingUntil=0;ui.toggle(false);ui.state(isResume()?'이름 · 나이 · 연락처 · 학력 · 경력을 가져와요.':'지금은 목록·일반 화면이에요. 한 사람의 이름을 눌러 이력서를 열어 주세요.');}$('manual').disabled=busy||!isResume();$('toggle').disabled=!isResume();if(!isResume())ui.state('지금은 목록·일반 화면이에요. 한 사람의 이름을 눌러 이력서를 열어 주세요.');}
 syncContext();
 const read=()=>globalThis.PresenceAlbamonExtract.extract(document,location.origin+location.pathname);
 function runtime(message){return new Promise((resolve,reject)=>{try{chrome.runtime.sendMessage(message,result=>{if(chrome.runtime.lastError)reject(Error('도우미와 이력서 페이지를 새로고침해 주세요.'));else if(!result?.ok)reject(Error(result?.error||'캠프 연결을 확인하고 다시 눌러 주세요.'));else resolve(result);});}catch{reject(Error('웨일 확장앱과 이력서 페이지를 새로고침해 주세요.'));}});}
 async function send(manual=false){
  if(busy)return;if(!isResume()){syncContext();ui.setOpen(true);return;}
  const payload=read(),fingerprint=JSON.stringify([location.pathname,payload.name,payload.phone,payload.mobile,payload.education,payload.career]);
  if(!manual&&fingerprint===last)return;
  if(!payload.name&&!payload.education&&!payload.career){ui.state('알바몬에 로그인한 뒤 이력서 상세 화면에서 눌러 주세요.');ui.setOpen(true);return;}
  busy=true;$('manual').disabled=true;ui.mood('');ui.state('이 친구의 정보를 챙겨서 캠프를 열고 있어요…');
  try{const result=await runtime({type:manual?'PRESENCE_CAPTURE':job?'CREW_RESULT':'PRESENCE_CAPTURE',payload});if(result.job)job=result.job;last=fingerprint;enabled=true;ui.toggle(enabled);ui.mood('success');ui.state(payload.contactOpened&&!payload.nameMasked?'캠프에 정보를 채웠어요! 통화 메모와 결과를 이어서 남겨 주세요.':'공개된 정보부터 캠프에 담았어요. 알바몬에서 이름·번호를 열람하면 나머지도 이어서 채워져요.');}
  catch(error){last='';ui.mood('error');ui.state(error.message);ui.setOpen(true);}
  finally{busy=false;syncContext();}
 }
 async function find(){if(!isResume())return;try{const r=await runtime({type:'CREW_JOB'});if(r.job){job=r.job;enabled=true;ui.toggle(enabled);send();}}catch{}}
 $('manual').onclick=()=>send(true);$('toggle').onclick=()=>{enabled=!enabled;ui.toggle(enabled);ui.state(enabled?'알바몬에서 직접 번호를 공개하면 새 정보를 이어서 가져올게요.':'자동 채우기를 껐어요. 정보 가져오기는 직접 누를 수 있어요.');};
 $('open-camp').onclick=async()=>{try{await runtime({type:'CREW_OPEN_HUB'});}catch(error){ui.state(error.message);}};
 document.addEventListener('click',e=>{if(!enabled||!e.isTrusted||e.composedPath().includes(host))return;const b=e.target.closest('button,a,[role="button"]');if(!b||!/(전화번호|연락처|휴대폰|번호)\s*(보기|확인|열람)|^열람하기$|^확인하기$|연락처\s*공개/.test(b.innerText?.trim()||''))return;pendingUntil=Date.now()+15000;clearTimeout(timer);timer=setTimeout(()=>send(),1500);},true);
 const observer=new MutationObserver(mutations=>{syncContext();if(!enabled||mutations.every(m=>host.contains(m.target)))return;clearTimeout(timer);timer=setTimeout(()=>{if(Date.now()<pendingUntil||job)send();},600);});observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 chrome.runtime.onMessage.addListener(message=>{if(message?.type==='CREW_READ_NOW')find();});find();setTimeout(find,1000);
})();
