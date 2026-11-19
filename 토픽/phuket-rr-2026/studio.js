(() => {
'use strict';
const $=s=>document.querySelector(s), {key,saved,order,original,defaults}=window.Phuket;
const studio=$('#studio'), status=$('#studioStatus');
const screening=document.createElement('dialog');
screening.id='screening';screening.setAttribute('aria-label','발표 영상 크게 보기');
screening.innerHTML='<button class="screening-close" type="button" aria-label="영상 크게 보기 닫기">닫기 ×</button><div class="screening-stage"></div>';
document.body.append(screening);
let screeningOrigin=null;
function closeScreening(){if(screening.open)screening.close();}
screening.querySelector('button').onclick=closeScreening;
screening.addEventListener('close',()=>{const video=screening.querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();video.remove();}screeningOrigin?.focus();screeningOrigin=null;});
function playLarge(video,button){
 document.querySelectorAll('.slide video').forEach(v=>v.pause());
 const screeningVideo=video.cloneNode(false);screeningVideo.controls=true;screeningVideo.playsInline=true;screeningVideo.preload='auto';
 screeningVideo.addEventListener('ended',closeScreening);
 screeningVideo.addEventListener('error',()=>say('영상 재생을 확인하세요. 닫은 후 원본 카드에서도 재생할 수 있습니다.'));
 screening.querySelector('.screening-stage').replaceChildren(screeningVideo);screeningOrigin=button;screening.showModal();screening.querySelector('button').focus();
 screeningVideo.play().catch(()=>{});
}
const labels={'opening-video':'오프닝 · 극한 근무 현장 (81.4초)','sea-photo':'바다와 액티비티 사진','taste-photo':'음식·쇼핑 사진','people-photo':'함께한 사람들 · 정장 단체 사진','together-photo':'다음 R&R, 함께 · 리조트 단체 사진','ending-video':'엔딩 영상 (12초)'};
let editedOrder=[...order], database, mediaURLs=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=s=>{status.textContent=s;const toast=$('#status');toast.textContent=s;toast.classList.add('show');clearTimeout(say.timeout);say.timeout=setTimeout(()=>toast.classList.remove('show'),4500);};
function renderOrder(){
 const notes={...defaults,...saved.notes}; document.querySelectorAll('[data-note]').forEach(el=>notes[el.dataset.note]=el.value);
 $('#orderEditor').innerHTML=editedOrder.map((id,i)=>`<div class="editor-row"><strong>${String(i+1).padStart(2,'0')} · ${esc($('[data-id="'+id+'"]').dataset.title)}</strong><div class="order-arrows"><button data-up="${id}" ${i===0?'disabled':''} aria-label="${esc(id)} 위로">↑</button><button data-down="${id}" ${i===editedOrder.length-1?'disabled':''} aria-label="${esc(id)} 아래로">↓</button></div><label>발표자 노트<textarea data-note="${id}">${esc(notes[id])}</textarea></label></div>`).join('');
}
function applyActions(){document.querySelectorAll('[data-action]').forEach(el=>{const a=saved.actions?.[el.dataset.action]||{};const lines=[a.owner&&'담당자: '+a.owner,a.date&&'시작일: '+a.date,a.metric&&'측정 지표: '+a.metric].filter(Boolean);el.textContent=lines.join('\n');el.hidden=!lines.length;});}
$('#mediaEditor').innerHTML=Object.entries(labels).map(([id,label])=>`<div class="editor-row"><label>${esc(label)}<input type="file" data-upload="${id}" accept="${id.includes('video')?'video/*':'image/*'}"></label><span data-media-status="${id}">미연결</span><button data-remove="${id}">제거</button></div>`).join('');
$('#actionEditor').innerHTML=['약속·참석·첫 출근','다음 직급에 필요한 경험','90일 목표와 월요일 할 일'].map((name,i)=>{const a=saved.actions?.[i]||{};return `<div class="editor-row" data-action-editor="${i}"><strong>${name}</strong><label>담당자<input data-field="owner" value="${esc(a.owner)}" placeholder="팀과 합의 후 입력"></label><label>시작일<input type="date" data-field="date" value="${esc(a.date)}"></label><label>측정 지표<input data-field="metric" value="${esc(a.metric)}" placeholder="지표와 목표를 합의 후 입력"></label></div>`;}).join('');
renderOrder(); applyActions();
$('#prepareButton').onclick=()=>{studio.showModal();$('#closeStudio').focus();}; $('#closeStudio').onclick=()=>studio.close(); studio.addEventListener('close',()=>$('#prepareButton').focus());
document.addEventListener('keydown',e=>{if(studio.open||screening.open){e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();if(screening.open)closeScreening();else studio.close();}}else if(e.target.closest('video'))e.stopImmediatePropagation();},true);
$('#orderEditor').onclick=e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.up||b.dataset.down, i=editedOrder.indexOf(id),j=i+(b.dataset.up?-1:1);if(j>=0&&j<editedOrder.length){[editedOrder[i],editedOrder[j]]=[editedOrder[j],editedOrder[i]];renderOrder();}};
$('#resetOrder').onclick=()=>{editedOrder=[...original];renderOrder();say('기본 순서로 배치했습니다. 저장하면 적용됩니다.');};
$('#saveStudio').onclick=()=>{const notes={};document.querySelectorAll('[data-note]').forEach(e=>notes[e.dataset.note]=e.value);const actions={};document.querySelectorAll('[data-action-editor]').forEach(row=>{const a={};row.querySelectorAll('[data-field]').forEach(e=>a[e.dataset.field]=e.value);actions[row.dataset.actionEditor]=a;});try{localStorage.setItem(key,JSON.stringify({order:editedOrder,notes,actions}));location.hash='#slide-1';location.reload();}catch(e){say('저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.');}};
function mount(id,blob){
 if(mediaURLs.has(id)){URL.revokeObjectURL(mediaURLs.get(id));mediaURLs.delete(id);}
 const url=URL.createObjectURL(blob);mediaURLs.set(id,url);renderMedia(id,url,blob.name||'저장된 원본 연결됨');
}
function renderMedia(id,url,name,poster,gallery){
 document.querySelectorAll('[data-media="'+id+'"]').forEach(slot=>{slot.replaceChildren();const media=document.createElement(slot.dataset.type==='video'?'video':'img');if(media.tagName==='VIDEO'){['touchstart','touchend'].forEach(type=>media.addEventListener(type,e=>e.stopPropagation()));media.controls=true;media.preload='auto';media.playsInline=true;media.addEventListener('error',()=>{say('영상 형식을 재생할 수 없습니다. 브라우저에서 지원하는 원본을 확인하세요.');});}else media.alt=labels[id];media.src=url;slot.append(media);if(media.tagName==='VIDEO'){slot.classList.add('has-video');const play=document.createElement('button');play.type='button';play.className='screening-play';play.textContent=id==='opening-video'?'인트로 크게 재생 ↗':'엔딩 크게 재생 ↗';play.onclick=()=>playLarge(media,play);slot.append(play);}});
 if(typeof poster==='string'&&/^assets\//.test(poster)&&!poster.includes('..'))document.querySelectorAll('[data-media="'+id+'"] video').forEach(video=>video.poster=poster);
 const extras=(Array.isArray(gallery)?gallery:[]).filter(entry=>entry&&typeof entry.src==='string'&&/^assets\//.test(entry.src)&&!entry.src.includes('..')).slice(0,2);
 document.querySelectorAll('[data-media="'+id+'"]').forEach(slot=>{slot.classList.toggle('has-strip',slot.dataset.type==='image'&&extras.length>0);if(slot.dataset.type!=='image'||!extras.length)return;const strip=document.createElement('div');strip.className='media-strip';strip.setAttribute('aria-label','추가 여행 사진');extras.forEach(entry=>{const img=document.createElement('img');img.src=entry.src;img.alt=entry.label||name;strip.append(img);});slot.append(strip);});
 $('[data-media-status="'+id+'"]').textContent=name;
}
Object.entries(window.PhuketMedia||{}).forEach(([id,entry])=>{if(labels[id]&&entry&&typeof entry.src==='string'&&/^assets\//.test(entry.src)&&!entry.src.includes('..'))renderMedia(id,entry.src,entry.label||'발표용 원본 연결됨',entry.poster,entry.gallery);});
const dbReady=new Promise((resolve,reject)=>{if(!window.indexedDB){reject(Error('unsupported'));return;}const request=indexedDB.open('presence-phuket-media',1);request.onupgradeneeded=()=>request.result.createObjectStore('media');request.onsuccess=()=>{database=request.result;resolve(database);};request.onerror=()=>reject(request.error);});
function transact(mode,fn){return dbReady.then(db=>new Promise((resolve,reject)=>{const tx=db.transaction('media',mode);fn(tx.objectStore('media'));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);}));}
dbReady.then(db=>Object.keys(labels).forEach(id=>{const request=db.transaction('media').objectStore('media').get(id);request.onsuccess=()=>{if(request.result)mount(id,request.result);};})).catch(()=>say('이 브라우저에서는 미디어 저장을 사용할 수 없습니다. 저장 허용 설정을 확인하세요.'));
$('#mediaEditor').addEventListener('change',async e=>{if(!e.target.matches('[data-upload]'))return;const file=e.target.files[0],id=e.target.dataset.upload;if(!file)return;const expected=id.includes('video')?'video/':'image/';if(!file.type.startsWith(expected)){say('사진 또는 영상 파일 형식을 확인하세요.');return;}try{await transact('readwrite',s=>s.put(file,id));mount(id,file);say('이 브라우저에 원본을 저장했습니다. 발표 전 재생을 확인하세요.');}catch(error){say('미디어를 저장하지 못했습니다. 저장 공간이나 브라우저 권한을 확인하세요.');}e.target.value='';});
$('#mediaEditor').addEventListener('click',async e=>{const id=e.target.closest('[data-remove]')?.dataset.remove;if(!id)return;try{await transact('readwrite',s=>s.delete(id));location.reload();}catch(error){say('미디어를 제거하지 못했습니다. 다시 시도하세요.');}});
function pauseHidden(){document.querySelectorAll('.slide[hidden] video').forEach(v=>v.pause());if(screeningOrigin?.closest('.slide')?.hidden)closeScreening();}
new MutationObserver(pauseHidden).observe($('#slides'),{subtree:true,attributes:true,attributeFilter:['hidden']});document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('video').forEach(v=>v.pause());});
let elapsed=0,started=0,running=false;
function renderTimer(){const t=Math.floor(elapsed+(running?(performance.now()-started)/1000:0));$('#rehearsalTime').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')} / 15:00`;$('.rehearsal').classList.toggle('over',t>=900);}
$('#rehearsalToggle').onclick=()=>{if(running){elapsed+=(performance.now()-started)/1000;running=false;}else{started=performance.now();running=true;}$('#rehearsalToggle').textContent=running?'일시정지':'계속하기';renderTimer();};$('#rehearsalReset').onclick=()=>{elapsed=0;running=false;$('#rehearsalToggle').textContent='리허설 시작';renderTimer();};setInterval(renderTimer,250);
})();
