(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const slides = [...document.querySelectorAll('.slide')];
  const data = window.SalesTalk;
  const panel = $('#panel');
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current=0, lastFocus=null, deadline=0, remaining=1500, running=false, timerId=null;
  let photoTarget=null, dbPromise=null;
  const sourcePhotos=[...document.querySelectorAll('.photo-slot img')].map(img=>img.getAttribute('src'));
  const photoNames=['옥스팜 활동에 참여한 순간','옥스팜 행사에서 함께한 사람들','옥스팜 현장 활동'];
  const photoUrls=new Map();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let motionPaused=reduced.matches;
  const pitchVideo=$('#pitchVideo'),pitchPhotos=$('#pitchPhotos'),pitchVideoStep=$('#pitchVideoStep');
  const pitchIndex=pitchPhotos?slides.indexOf(pitchPhotos.closest('.slide')):-1;
  slides.forEach((slide,i)=>{const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0');o.setAttribute('aria-label',`${i+1}. ${data[i].title}`);$('#slideSelect').append(o);});
  $('.total').textContent=`/ ${slides.length}`;
  const routeIndex=()=>{const m=location.hash.match(/^#slide-(\d+)$/);return m?Math.max(0,Math.min(slides.length-1,Number(m[1])-1)):0;};
  function show(index,history=true){
    const previous=current;
    current=Math.max(0,Math.min(slides.length-1,Number(index)||0));
    if(previous!==current){pitchVideo?.pause();if(current===pitchIndex){setPitchStep(false);pitchVideo.currentTime=0;}}
    slides.forEach((s,i)=>{s.hidden=i!==current;s.classList.toggle('active',i===current);s.setAttribute('aria-hidden',String(i!==current));});
    document.body.dataset.chapter=data[current].chapter;
    document.body.style.setProperty('--accent',data[current].chapter==='CUSTOMER'?'var(--violet)':data[current].chapter==='SELF'?'var(--amber)':'var(--green)');
    $('#chapter').textContent=data[current].chapter;
    $('#slideSelect').value=current;
    $('#prev').disabled=current===0;$('#next').disabled=current===slides.length-1;
    $('#next').setAttribute('aria-label',current===pitchIndex&&pitchVideoStep.hidden?'피치 영상 보기':'다음 슬라이드');
    $('#progressFill').style.width=`${(current+1)/slides.length*100}%`;
    $('#announcement').textContent=`${current+1} / ${slides.length}. ${data[current].title}`;
    $('#stage').scrollTop=0;
    if(history)window.history.replaceState(null,'',`#slide-${current+1}`);
    if(document.activeElement.closest('.slide[hidden]')) $('#stage').focus({preventScroll:true});
  }
  function setPitchStep(videoVisible,play=false){
    if(!pitchVideo)return;
    pitchPhotos.hidden=videoVisible;pitchVideoStep.hidden=!videoVisible;
    if(!videoVisible)pitchVideo.pause();
    $('#next').setAttribute('aria-label',videoVisible?'다음 슬라이드':'피치 영상 보기');
    $('#stage').scrollTop=0;
    $('#announcement').textContent=`${pitchIndex+1} / ${slides.length}. ${videoVisible?'실제 피치 영상':'100개 넘는 피치 연습 기록'}`;
    if(document.activeElement.closest('[hidden]'))$('#stage').focus({preventScroll:true});
    if(videoVisible&&play)pitchVideo.play().catch(()=>status('영상의 재생 버튼을 눌러 시작해 주세요.'));
  }
  function move(direction){
    if(current===pitchIndex){
      if(direction>0&&pitchVideoStep.hidden){setPitchStep(true,true);return;}
      if(direction<0&&!pitchVideoStep.hidden){setPitchStep(false);return;}
    }
    show(current+direction);
  }
  const fmt=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
  function elapsedTo(i){return data.slice(0,i).reduce((sum,s)=>sum+s.seconds,0);}
  function openPanel(title,label,body){
    pitchVideo?.pause();
    if(!panel.open)lastFocus=document.activeElement;
    $('#panelTitle').textContent=title;$('#panelLabel').textContent=label;
    $('#panelBody').innerHTML=body;$('#panelBody').scrollTop=0;
    document.body.classList.add('panel-open');
    if(!panel.open)panel.showModal();$('#closePanel').focus();
  }
  function notes(){
    const item=data[current],start=elapsedTo(current);
    openPanel(item.title,'PRESENTER NOTES',`<div class="panel-meta"><span>${current+1} / ${slides.length}</span><span>${fmt(start)}–${fmt(start+item.seconds)}</span><span>권장 ${item.seconds}초</span></div><p class="panel-caption">이 노트는 현재 화면에 표시됩니다. [대괄호]는 진행 안내입니다.</p>${item.notes.split('\n\n').map(p=>`<p>${escape(p)}</p>`).join('')}<div class="notes-navigation"><button id="previousNote" ${current===0?'disabled':''}>← 이전 노트</button><button id="nextNote" ${current===slides.length-1?'disabled':''}>다음 노트 →</button></div>`);
    $('#previousNote').onclick=()=>{show(current-1);notes();};$('#nextNote').onclick=()=>{show(current+1);notes();};
  }
  function outline(){
    openPanel('발표 목차','25 MIN / '+slides.length+' SLIDES',`<p class="panel-caption">장면을 선택하면 바로 이동합니다. ← → 이동 · N 노트 · F 전체화면 · M 모션 멈춤/재생</p><div class="outline-list">${data.map((s,i)=>`<button data-jump="${i}" aria-current="${i===current}"><span>${String(i+1).padStart(2,'0')}</span>${escape(s.title)}<small>${fmt(elapsedTo(i))}</small></button>`).join('')}</div><p class="panel-caption" style="margin-top:20px"><a href="발표원고.md" target="_blank" rel="noopener">전체 발표 원고 열기 ↗</a></p><button id="resetTimer">25분 타이머 초기화</button><button id="motionControl" style="margin-left:8px">모션 ${motionPaused?'켜기':'멈춤'}</button>`);
    $('#panelBody').querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{show(b.dataset.jump);panel.close();});
    $('#resetTimer').onclick=()=>{pauseTimer();remaining=1500;renderTimer();status('타이머를 25분으로 초기화했습니다.');};
    $('#motionControl').onclick=()=>{toggleMotion();$('#motionControl').textContent=`모션 ${motionPaused?'켜기':'멈춤'}`;};
  }
  function status(message){$('#status').textContent=message;$('#status').classList.add('show');clearTimeout(status.id);status.id=setTimeout(()=>$('#status').classList.remove('show'),4500);}
  function renderTimer(){const button=$('#timer');button.textContent=fmt(Math.ceil(remaining));button.dataset.running=running;button.setAttribute('aria-label',`발표 시간 ${fmt(Math.ceil(remaining))}. ${running?'타이머 일시정지':'타이머 시작'}`);}
  function pauseTimer(){if(running)remaining=Math.max(0,(deadline-performance.now())/1000);running=false;clearInterval(timerId);renderTimer();}
  function toggleTimer(){if(running){pauseTimer();return;}if(remaining<=0)remaining=1500;deadline=performance.now()+remaining*1000;running=true;renderTimer();timerId=setInterval(()=>{remaining=Math.max(0,(deadline-performance.now())/1000);if(remaining<=0){pauseTimer();status('25분이 지났습니다. 마무리할 시간입니다.');}renderTimer();},200);}
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else status('이 브라우저는 전체화면을 지원하지 않습니다.');}catch{status('전체화면을 열지 못했습니다. 브라우저 설정을 확인해 주세요.');}}
  function toggleMotion(){if(reduced.matches){status('기기의 동작 줄이기 설정을 따르고 있습니다.');return;}motionPaused=!motionPaused;document.body.classList.toggle('motion-disabled',motionPaused);}
  document.addEventListener('sales-motion-toggle',toggleMotion);
  function database(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open('presence-great-sales-photos-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return dbPromise;}
  async function storePhoto(id,blob){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');const store=tx.objectStore('photos');blob?store.put(blob,id):store.delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  function applyPhoto(id,blob){const image=document.querySelector(`[data-photo="${id}"] img`);if(!image)return;if(photoUrls.has(id))URL.revokeObjectURL(photoUrls.get(id));if(blob){const url=URL.createObjectURL(blob);photoUrls.set(id,url);image.src=url;}else{photoUrls.delete(id);image.src=sourcePhotos[id];}image.hidden=false;image.previousElementSibling?.classList.contains('photo-empty')&&(image.previousElementSibling.hidden=true);}
  async function restorePhotos(){try{const db=await database();for(let id=0;id<sourcePhotos.length;id++){const request=db.transaction('photos').objectStore('photos').get(id);request.onsuccess=()=>{if(request.result)applyPhoto(id,request.result);};}}catch{/* The original photos remain available without browser storage. */}}
  function photos(){
    openPanel('발표 사진','MY PHOTOS',`<p class="panel-caption">기본 사진은 체리티교육에서 가져왔습니다. 교체한 사진은 <b>이 브라우저에만 저장</b>되며 다른 사람의 화면에는 반영되지 않습니다. JPG · PNG · WebP, 최대 15MB.</p><div class="photo-settings">${sourcePhotos.map((_,i)=>`<article><img src="${escape(document.querySelector(`[data-photo="${i}"] img`).src)}" alt="${photoNames[i]}"><div><h3>${photoNames[i]}</h3><div class="buttons"><button data-replace="${i}">사진 교체</button><button data-restore="${i}">원본으로</button></div></div></article>`).join('')}</div>`);
    $('#panelBody').querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>{photoTarget=Number(b.dataset.replace);$('#photoInput').click();});
    $('#panelBody').querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{const id=Number(b.dataset.restore);try{await storePhoto(id,null);applyPhoto(id,null);photos();status('기본 사진으로 되돌렸습니다.');}catch{status('사진 설정을 저장하지 못했습니다.');}});
  }
  $('#photoInput').onchange=async event=>{const file=event.target.files[0],id=photoTarget;event.target.value='';if(!file||id===null)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024){status('15MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.');return;}try{const bitmap=await createImageBitmap(file);bitmap.close();await storePhoto(id,file);applyPhoto(id,file);photos();status('이 브라우저에 사진을 저장했습니다.');}catch{status('사진을 읽거나 저장하지 못했습니다. 다른 사진을 선택해 주세요.');}};
  $('#notesButton').onclick=notes;$('#outlineButton').onclick=outline;$('#settingsButton').onclick=photos;$('#fullscreen').onclick=toggleFullscreen;$('#timer').onclick=toggleTimer;
  $('#prev').onclick=()=>move(-1);$('#next').onclick=()=>move(1);$('#slideSelect').onchange=e=>show(e.target.value);
  if(pitchVideo){
    $('#showPitchVideo').onclick=()=>setPitchStep(true,true);
    $('#showPitchPhotos').onclick=()=>setPitchStep(false);
    const videoError=()=>{$('#pitchVideoError').hidden=false;};
    pitchVideo.addEventListener('error',videoError);pitchVideo.querySelector('source').addEventListener('error',videoError);
  }
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
  $('#closePanel').onclick=()=>panel.close();panel.addEventListener('close',()=>{document.body.classList.remove('panel-open');lastFocus?.focus({preventScroll:true});});
  panel.addEventListener('click',e=>{if(e.target!==panel)return;const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)panel.close();});
  document.addEventListener('keydown',e=>{if(panel.open||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('video,input,select,textarea,[contenteditable=true]'))return;const key=e.key.toLowerCase();if(e.target.closest('button,a')&&[' ','enter'].includes(key))return;if(['arrowright','pagedown',' '].includes(key)){e.preventDefault();move(1);}else if(['arrowleft','pageup'].includes(key)){e.preventDefault();move(-1);}else if(key==='home'){e.preventDefault();show(0);}else if(key==='end'){e.preventDefault();show(slides.length-1);}else if(key==='n')notes();else if(key==='f')toggleFullscreen();else if(key==='m')toggleMotion();});
  let touch=null;$('#stage').addEventListener('touchstart',e=>{if(e.target.closest('video,a,button,select')||e.touches.length!==1){touch=null;return;}const t=e.touches[0];touch={x:t.clientX,y:t.clientY,at:performance.now()};},{passive:true});$('#stage').addEventListener('touchend',e=>{if(!touch)return;const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;if(Math.abs(dx)>75&&Math.abs(dx)>Math.abs(dy)*1.7&&performance.now()-touch.at<800)move(dx<0?1:-1);touch=null;},{passive:true});
  window.addEventListener('hashchange',()=>show(routeIndex(),false));
  document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'전체화면 종료':'전체화면';});
  reduced.addEventListener('change',()=>{motionPaused=reduced.matches;document.body.classList.toggle('motion-disabled',motionPaused);});
  document.body.classList.toggle('motion-disabled',motionPaused);show(routeIndex(),false);renderTimer();restorePhotos();
})();
