const agendaDefaults=[['우리가 하는 일','What we do'],['COD 1','COD 1'],['현장 진행','How to Field'],['자기소개','Introduce'],['옥스팜 이해','About OXFAM'],['후원 신청 안내','Sign up Guide'],['목소리와 몸짓','Tone of voice · Body Language'],['피드백','Feedback']].map(([title,sub])=>({title,sub}));
let lessonSettings={agenda:agendaDefaults,hidden:[],updatedAt:0},draft=null,admin=false,settingsReady=false;
const settingsUrl=HUB_CONFIG.databaseURL+'/edu_lib/lessonSettings/charityTraining.json';
function visibleIndices(){return slides.map((s,i)=>i).filter(i=>!lessonSettings.hidden.includes(i+1))}
function applySettings(){
 const visible=visibleIndices();for(const o of $('select').options){o.hidden=lessonSettings.hidden.includes(+o.value+1);o.disabled=o.hidden}
 if(lessonSettings.hidden.includes(cur+1)&&visible.length)show(visible.find(i=>i>cur)??visible[0]);
 drawAgenda();updateNavigation();
}
function drawAgenda(){
 const frame=document.querySelector('.frame');let view=$('agendaView');if(!view){view=document.createElement('section');view.id='agendaView';view.className='agendaView';view.setAttribute('aria-label','오늘의 교육 순서');frame.append(view)}
 view.hidden=cur!==0;if(cur!==0)return;view.replaceChildren();
 const kicker=document.createElement('p');kicker.className='agendaKicker';kicker.textContent='PEACEMAKER / NEW CHARITY TRAINING';
 const heading=document.createElement('h1');heading.textContent='오늘의 교육 순서';
 const grid=document.createElement('div');grid.className='agendaGrid';grid.style.setProperty('--rows',Math.ceil(lessonSettings.agenda.length/4));grid.classList.toggle('dense',lessonSettings.agenda.length>8);
 lessonSettings.agenda.forEach((a,i)=>{const cell=document.createElement('div');cell.className='agendaCell';for(const [tag,cl,tx] of [['span','num',String(i+1).padStart(2,'0')],['h2','topic',a.title],['p','sub',a.sub]]){const el=document.createElement(tag);el.className=cl;el.textContent=tx;cell.append(el)}grid.append(cell)});
 const footer=document.createElement('small');footer.textContent='PEACEMAKER';view.append(kicker,heading,grid,footer);
}
function updateNavigation(){const v=visibleIndices(),pos=v.indexOf(cur);$('prev').disabled=pos<=0;$('next').disabled=pos===v.length-1&&!slides[cur].video;$('counter').textContent=`${String(pos+1).padStart(2,'0')} / ${v.length}`}
function targetPage(step){const v=visibleIndices(),p=v.indexOf(cur);return v[p+step]}
async function loadSettings(){if(!settingsReady)$('status').textContent='저장된 교육 구성을 불러오는 중…';try{const r=await fetch(settingsUrl,{cache:'no-store'});if(!r.ok)throw Error('설정 연결 실패');const d=await r.json();if(d&&Array.isArray(d.agenda)&&d.agenda.length){lessonSettings={agenda:d.agenda.slice(0,12),hidden:Array.isArray(d.hidden)?d.hidden.filter(n=>n>=1&&n<=slides.length):[],updatedAt:d.updatedAt||0}}settingsReady=true;applySettings();document.body.classList.remove('settings-loading');$('status').textContent=''}catch(e){$('status').textContent='교육 설정을 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.'}}
let firebasePromise;
function firebaseRuntime(){if(firebasePromise)return firebasePromise;firebasePromise=Promise.all([import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js')]).then(([appApi,authApi,dbApi])=>{const app=appApi.getApps().length?appApi.getApp():appApi.initializeApp(HUB_CONFIG);return{authApi,dbApi,auth:authApi.getAuth(app),db:dbApi.getDatabase(app)}});return firebasePromise}
async function saveSettings(){
 if(!admin||!draft)return;if(!draft.agenda.length||draft.agenda.some(a=>!a.title.trim())){$('manageStatus').textContent='아젠다 제목을 입력해 주세요. 항목은 최소 1개가 필요합니다.';return}
 if(draft.hidden.length>=slides.length){$('manageStatus').textContent='교육 페이지는 최소 1장을 표시해야 합니다.';return}
 $('saveManage').disabled=true;$('manageStatus').textContent='전체 기기에 저장 중…';
 try{const fb=await firebaseRuntime();await fb.auth.authStateReady();const user=fb.auth.currentUser||(await fb.authApi.signInAnonymously(fb.auth)).user;await fb.dbApi.set(fb.dbApi.ref(fb.db,'eduAdminProofs/'+user.uid),HUB_ADMIN_PROOF);
  const value={agenda:draft.agenda.map(a=>({title:a.title.trim(),sub:a.sub.trim()})),hidden:draft.hidden,updatedAt:Date.now()};
  const result=await fb.dbApi.runTransaction(fb.dbApi.ref(fb.db,'edu_lib/lessonSettings/charityTraining'),current=>{if(current&&(current.updatedAt||0)!==draft.updatedAt)return;return value;},{applyLocally:false});
  if(!result.committed)throw Error('다른 기기에서 먼저 변경했습니다. 관리를 닫고 다시 열어 최신 내용을 불러와 주세요.');
  lessonSettings=value;draft=structuredClone(value);applySettings();$('manageStatus').textContent='전체 기기에 저장되었습니다.';
 }catch(e){$('manageStatus').textContent=e.message||'저장하지 못했습니다. 연결을 확인해 주세요.'}finally{$('saveManage').disabled=false}
}
function managementForm(){
 $('manageLogin').hidden=admin;$('manageEditor').hidden=!admin;$('manageSaveBar').hidden=!admin;if(!admin)return;draft=structuredClone(lessonSettings);renderAgendaEditor();renderPageEditor();$('manageStatus').textContent='변경 후 저장하면 모든 기기에 반영됩니다.';
}
function renderAgendaEditor(){
 const list=$('agendaEditor');list.replaceChildren();draft.agenda.forEach((a,i)=>{const row=document.createElement('div');row.className='agendaEditRow';const fields=document.createElement('div');fields.className='agendaEditFields';
  for(const key of ['title','sub']){const input=document.createElement('input');input.value=a[key];input.maxLength=key==='title'?30:72;input.setAttribute('aria-label',`${i+1}번 ${key==='title'?'주제':'보조 설명'}`);input.placeholder=key==='title'?'주제':'보조 설명';input.oninput=()=>a[key]=input.value;fields.append(input)}
  const actions=document.createElement('div');actions.className='rowActions';for(const [label,fn,disabled] of [['위로',()=>moveAgenda(i,-1),i===0],['아래로',()=>moveAgenda(i,1),i===draft.agenda.length-1],['삭제',()=>{draft.agenda.splice(i,1);renderAgendaEditor()},draft.agenda.length===1]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',`${i+1}번 ${label}`);b.disabled=disabled;b.onclick=fn;actions.append(b)}row.append(fields,actions);list.append(row)});$('addAgenda').disabled=draft.agenda.length>=12;
}
function moveAgenda(i,delta){const [a]=draft.agenda.splice(i,1);draft.agenda.splice(i+delta,0,a);renderAgendaEditor()}
function renderPageEditor(){
 const list=$('pageEditor');list.replaceChildren();for(const s of slides){const row=document.createElement('label');row.className='pageEditRow';const check=document.createElement('input');check.type='checkbox';check.checked=!draft.hidden.includes(s.n);check.setAttribute('aria-label',`${s.n}페이지 표시`);check.onchange=()=>{draft.hidden=draft.hidden.filter(n=>n!==s.n);if(!check.checked)draft.hidden.push(s.n)};const im=document.createElement('img');im.src=`slides/slide-${String(s.n).padStart(2,'0')}.png`;im.alt='';im.loading='lazy';const title=document.createElement('span');title.textContent=`${String(s.n).padStart(2,'0')} · ${s.title}`;row.append(check,im,title);list.append(row)}
}
$('manage').onclick=async()=>{closeVideo(false);$('manageDialog').showModal();$('manageStatus').textContent='설정을 불러오는 중…';await loadSettings();managementForm()};
$('closeManage').onclick=()=>{$('manageDialog').close();draft=null};$('saveManage').onclick=saveSettings;
$('loginManage').onsubmit=async e=>{e.preventDefault();const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode($('managePassword').value));const hash=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==HUB_PASSWORD_HASH){$('loginError').textContent='비밀번호를 확인해 주세요.';return}admin=true;$('managePassword').value='';$('loginError').textContent='';managementForm()};
$('addAgenda').onclick=()=>{if(draft.agenda.length<12){draft.agenda.push({title:'새 주제',sub:''});renderAgendaEditor()}};
$('showAllPages').onclick=()=>{draft.hidden=[];renderPageEditor()};
$('resetAgenda').onclick=()=>{draft.agenda=structuredClone(agendaDefaults);renderAgendaEditor()};
show(cur);loadSettings();
