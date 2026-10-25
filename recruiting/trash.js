export function createTrash({getAll,save,dialog,esc,toast,canAct,prepare,onDeleted,refresh,actor}){
 let busy=false;
 const deleted=()=>getAll().filter(c=>c.deleted).sort((a,b)=>(b.deletedAt||0)-(a.deletedAt||0));
 const show=()=>{if(!dialog.open)dialog.showModal();dialog.querySelector('[data-close-trash]')?.addEventListener('click',()=>dialog.close());};
 function open(){
  const list=deleted();dialog.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">CREW CAMP · RECYCLE BIN</p><h2 id="utility-title">휴지통 <small>${list.length}명</small></h2></div><button data-close-trash>닫기</button></div><p class="hint">삭제한 후보자는 목록·일정·실적 집계에서 제외됩니다. 복원하면 이전 기록이 그대로 돌아옵니다.</p><div class="trash-list">${list.length?list.map(c=>`<article class="trash-item"><div><b>${esc(c.name)}</b><p>${esc([c.age,c.gender,c.mobile||c.phone||'연락처 없음'].filter(Boolean).join(' · '))}</p><small>${c.deletedAt?esc(new Date(c.deletedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))+' 삭제':''}</small></div><button class="quiet" data-restore="${esc(c.id)}" aria-label="${esc(c.name)} 복원">복원 ↩</button></article>`).join(''):'<div class="trash-empty">✦ 휴지통이 비어 있어요.</div>'}</div><p class="error" id="trash-error" role="alert"></p>`;
  show();dialog.querySelectorAll('[data-restore]').forEach(button=>button.onclick=()=>restore(button.dataset.restore));
 }
 function request(id){
  if(busy||!canAct()){toast('저장이 끝난 뒤 다시 눌러 주세요.');return;}
  const c=getAll().find(c=>c.id===id&&!c.deleted);if(!c)return;prepare(id);
  dialog.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">KEEP YOUR NOTEBOOK TIDY</p><h2 id="utility-title">이 후보자를 삭제할까요?</h2></div><button data-close-trash>취소</button></div><div class="trash-identity"><b>${esc(c.name)}</b><p>${esc([c.age,c.gender,c.mobile||c.phone||'연락처 없음'].filter(Boolean).join(' · '))}</p></div><p>휴지통으로 옮기면 후보자 목록과 실적 집계에서 빠집니다. 필요하면 휴지통에서 복원할 수 있어요.</p>${c.sheetState||c.interviewDate?'<p class="hint">구글 인터뷰로그에 이미 등록된 행은 그대로 남습니다. 캠프에서는 동기화를 멈춥니다.</p>':''}<p class="error" id="trash-error" role="alert"></p><button class="danger-action" id="confirm-trash">삭제 · 휴지통으로 이동</button>`;
  show();dialog.querySelector('#confirm-trash').onclick=async()=>{
   if(busy||!canAct())return;const current=getAll().find(x=>x.id===id&&!x.deleted);if(!current){dialog.close();return;}
   busy=true;const b=dialog.querySelector('#confirm-trash');b.disabled=true;
   try{await save({...current,deleted:true,deletedAt:Date.now(),deletedBy:actor()},Number(current.revision||0));onDeleted(id);dialog.close();refresh();toast(current.name+'님을 휴지통으로 옮겼어요.');}
   catch(error){dialog.querySelector('#trash-error').textContent=error.message;}
   finally{busy=false;b.disabled=false;}
  };
 }
 async function restore(id){
  if(busy||!canAct())return;const current=getAll().find(c=>c.id===id&&c.deleted);if(!current)return;
  busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await save({...current,deleted:false,restoredAt:Date.now()},Number(current.revision||0));refresh();open();toast(current.name+'님의 기록을 복원했어요.');}
  catch(error){dialog.querySelector('#trash-error').textContent=error.message;}
  finally{busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 return {count:()=>deleted().length,request,open};
}
