const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function createPrivateNotes({user,getFirebase,read,escape:esc}){
 const enabled=user?.uid==='admin'&&user?.status==='active',drafts=new Map(),history=new Map(),dates=new Map(),storageKey='presence.icManagerNotes.admin.drafts';let saving=false,epoch=0,refresh=()=>{};
 if(enabled)try{for(const [k,d] of JSON.parse(sessionStorage.getItem(storageKey)||'[]'))if(d&&typeof d.text==='string'&&typeof d.base==='string'&&Number.isInteger(d.revision))drafts.set(k,d);}catch{}
 const persist=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify([...drafts]));}catch{}};
 const path=id=>`icManagerNotes/admin/${id}`,key=(id,date)=>`${id}/${date}`;
 const dirty=()=>[...drafts.values()].some(d=>d.text!==d.base);
 const unload=event=>{if(dirty()||saving){event.preventDefault();event.returnValue='';}};
 if(enabled)addEventListener('beforeunload',unload);
 const getDraft=(id,date)=>{const k=key(id,date);if(!drafts.has(k)){const r=history.get(id)?.[date];drafts.set(k,{text:r?.text||'',base:r?.text||'',revision:r?.revision||0});}return drafts.get(k);};
 function html(id){return enabled?`<section class="card private-notes" id="private-notes" data-ic="${esc(id)}"><div class="card-head"><div><p class="eyebrow">PRIVATE DAILY NOTES</p><h3>관리자 전용 일일 기록</h3></div><span class="tag">관리자만 열람</span></div><div class="supplement-body"><label for="private-note-date">기록 날짜</label><input id="private-note-date" type="date" value="${esc(dates.get(id)||today())}"><label for="private-note-text">관찰과 코칭 메모</label><textarea id="private-note-text" maxlength="12000" rows="6" placeholder="해당 날짜의 관찰과 다음 코칭을 기록하세요." disabled></textarea><div class="actions"><button type="button" class="primary" id="private-note-save" disabled>일일 기록 저장</button><span id="private-note-status" role="status">기록 불러오는 중…</span></div><details><summary>날짜별 기록 이력</summary><div id="private-note-history"></div></details></div></section>`:'';}
 async function mount(id){if(!enabled)return;const root=document.querySelector('#private-notes');if(!root||root.dataset.ic!==id)return;const run=++epoch,dateInput=root.querySelector('#private-note-date'),text=root.querySelector('#private-note-text'),button=root.querySelector('#private-note-save'),status=root.querySelector('#private-note-status');let loaded=false;
  const alive=()=>run===epoch&&root.isConnected;
  const show=()=>{if(!alive())return;persist();const date=dates.get(id)||today();dateInput.value=date;const d=getDraft(id,date);text.value=d.text;text.disabled=!loaded||saving;button.disabled=!loaded||saving||d.text===d.base;status.textContent=saving?'온라인 저장 중…':d.text!==d.base?'저장하지 않은 일일 기록':d.revision?'온라인 기록 연결됨':'새 일일 기록';};
  refresh=()=>{list();show();};
  const list=()=>{if(!alive())return;const box=root.querySelector('#private-note-history');const entries=Object.entries(history.get(id)||{}).filter(([,r])=>r&&typeof r.text==='string').sort(([a],[b])=>b.localeCompare(a));box.innerHTML=entries.length?entries.map(([date,r])=>`<article><button type="button" class="quiet" data-note-date="${esc(date)}">${esc(date)}</button><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(r.text||'')}</p></article>`).join(''):'<p class="muted">저장된 일일 기록이 없습니다.</p>';box.querySelectorAll('[data-note-date]').forEach(b=>b.onclick=()=>changeDate(b.dataset.noteDate));};
  const changeDate=date=>{const current=dates.get(id)||today(),draft=getDraft(id,current);if(saving||!validDate(date)||(date!==current&&draft.text!==draft.base&&!confirm('저장하지 않은 메모가 있습니다. 날짜를 바꿀까요? 작성 내용은 임시 기록에 유지됩니다.'))){dateInput.value=current;return;}dates.set(id,date);show();};
  dateInput.onchange=()=>changeDate(dateInput.value);
  root.querySelector('.tag').textContent='관리자 전용 · 나만 보기';button.textContent='메모 저장';
  const todayButton=document.createElement('button');todayButton.type='button';todayButton.className='quiet';todayButton.textContent='오늘';dateInput.after(todayButton);todayButton.onclick=()=>changeDate(today());
  text.oninput=()=>{getDraft(id,dates.get(id)||today()).text=text.value;persist();showStatus();};
  function showStatus(){const d=getDraft(id,dates.get(id)||today());button.disabled=saving||!loaded||d.text===d.base;status.textContent=d.text!==d.base?'저장하지 않은 일일 기록':'온라인 기록 연결됨';}
  const compare=document.createElement('button');compare.type='button';compare.className='quiet';compare.textContent='최신 기록과 비교';button.after(compare);
  compare.onclick=async()=>{if(saving||!loaded)return;const date=dates.get(id)||today(),d=getDraft(id,date);compare.disabled=true;try{const remote=await read(`${path(id)}/${date}`);if(!alive())return;history.set(id,{...history.get(id),[date]:remote||undefined});list();if(Number(remote?.revision||0)===d.revision){status.textContent='최신 온라인 기록과 같은 버전입니다.';return;}const latest=String(remote?.text||'');if(confirm(`최신 온라인 기록:\n\n${latest}\n\n현재 작성 내용을 유지한 채 이 버전을 기준으로 다시 저장할까요? 저장 버튼을 누르기 전에는 온라인 기록이 변경되지 않습니다.`)){d.base=latest;d.revision=Number(remote?.revision||0);persist();show();}}catch(error){if(alive())status.textContent=`최신 기록 확인 실패 · ${error.message}`;}finally{compare.disabled=false;}};
  button.onclick=async()=>{
   if(saving||!loaded)return;const date=dates.get(id)||today(),d=getDraft(id,date),submitted=d.text,expected=d.revision;if(submitted===d.base)return;
   if(!navigator.onLine){status.textContent='오프라인입니다. 연결 후 메모를 저장해 주세요. 작성 내용은 유지됩니다.';return;}
   saving=true;refresh();let failure='';
   try{
    const f=await getFirebase(),current=f.auth.currentUser;if(!current)throw Error('다시 로그인해 주세요.');
    const [session,profile]=await Promise.all([read(`authSessions/${current.uid}`),read('users/admin')]);if(session?.userUid!=='admin'||profile?.status!=='active')throw Error('관리자 권한을 확인할 수 없습니다.');
    const ref=f.d.ref(f.db,`${path(id)}/${date}`),payload={version:1,revision:expected+1,text:submitted,updatedAt:Date.now(),updatedBy:'admin'};let release=()=>{},timer;
    try{
     await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('연결 시간이 초과되었습니다. 다시 저장해 주세요.')),15000);release=f.d.onValue(ref,resolve,reject);});clearTimeout(timer);
     if(!navigator.onLine)throw Error('연결이 끊어졌습니다. 다시 저장해 주세요.');
     const result=await f.d.runTransaction(ref,remote=>Number(remote?.revision||0)===expected?payload:undefined,{applyLocally:false});
     if(!result.committed)throw Error('다른 창의 기록과 충돌했습니다. 최신 기록과 비교한 뒤 다시 저장해 주세요.');
     history.set(id,{...history.get(id),[date]:payload});d.base=submitted;d.revision=payload.revision;
    }finally{clearTimeout(timer);release();}
   }catch(error){failure=`저장 실패 · ${error.message} 작성 내용은 유지됩니다.`;}
   finally{saving=false;persist();refresh();}
   if(failure&&alive())status.textContent=failure;
  };
  try{const remote=await read(path(id));history.set(id,remote||{});loaded=true;list();show();}catch(error){if(alive())status.textContent=`기록을 불러오지 못했습니다. ${error.message} 다시 선택하여 연결해 주세요.`;}
 }
 return {html,mount,clear(){epoch++;refresh=()=>{};drafts.clear();history.clear();dates.clear();removeEventListener('beforeunload',unload);if(enabled)try{sessionStorage.removeItem(storageKey);}catch{}},async canLeave({logout=false}={}){return !enabled||(!saving&&(!dirty()||confirm(logout?'저장하지 않은 관리자 메모는 로그아웃 시 삭제됩니다. 로그아웃할까요?':'저장하지 않은 관리자 일일 기록이 있습니다. 이동할까요? 작성 내용은 이 탭의 임시 기록에 유지됩니다.')));}};
}
