/* Presentation layer only: retain original reel, auth, photo and data handlers. */
(function(){
  'use strict';
  if(window.__presenceSoftHub)return;
  window.__presenceSoftHub=true;
  document.documentElement.dataset.hubDesign='20260928-soft1';
  const $=id=>document.getElementById(id);
  const paths={dots:'M5 12h.01M12 12h.01M19 12h.01',pause:'M8 5v14M16 5v14',play:'m8 5 11 7-11 7Z',speed:'M5 16a8 8 0 1 1 14 0M12 13l4-4M12 18h.01',close:'m6 6 12 12M18 6 6 18',arrow:'m9 5 7 7-7 7',grid:'M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z',sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',moon:'M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11',search:'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M16 16l4 4',external:'M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5'};
  function icon(name,extra=''){return '<svg class="hub-icon '+extra+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';}
  function charm(i){return '<span class="hub-charm" aria-hidden="true" style="--charm-col:'+(i%4)+';--charm-row:'+Math.floor(i/4)+'"></span>';}
  function admin(){try{return localStorage.getItem('presence_hub_admin')==='1'&&Date.now()-Number(localStorage.getItem('presence_hub_lastauth')||0)<30*86400000;}catch(e){return false;}}
  const head=document.querySelector('header'),logo=document.querySelector('.logo-col'),brand=document.querySelector('.brand');
  const mark=document.createElement('span');mark.className='hub-brandmark';mark.innerHTML='<img src="assets/education/presence-logo.png" width="39" height="22" alt="Presence">';logo.prepend(mark);
  brand.querySelector('.reel-id').textContent='PRESENCE · OUR MOMENTS';
  brand.querySelector('h1').textContent='우리의 순간, 다음의 가능성.';
  const sub=document.createElement('p');sub.className='brand-sub';sub.textContent='함께 쌓아가는 우리의 장면들';brand.append(sub);
  const controls=document.querySelector('.ctrl'),toggle=$('toggle'),speed=$('speed'),menu=$('menu'),more=$('moreBtn');
  let currentSpeed='24 FPS';
  function styleControls(){
    const paused=$('stack').classList.contains('paused');
    toggle.innerHTML=icon(paused?'play':'pause')+'<span>'+(paused?'다시 재생':'잠깐 멈춤')+'</span>';
    toggle.setAttribute('aria-label',paused?'사진 필름 다시 재생':'사진 필름 잠깐 멈춤');toggle.setAttribute('aria-pressed',String(paused));
    const label=speed.textContent.match(/\d+ FPS/);if(label)currentSpeed=label[0];
    speed.innerHTML=icon('speed')+'<span>'+currentSpeed+'</span>';speed.setAttribute('aria-label','필름 속도 전환 · 현재 '+currentSpeed);
  }
  toggle.addEventListener('click',styleControls);speed.addEventListener('click',styleControls);styleControls();
  more.innerHTML='<span>둘러보기</span>'+icon('dots');more.setAttribute('aria-controls','menu');more.setAttribute('aria-expanded','false');more.setAttribute('aria-label','둘러보기 메뉴 열기');
  menu.setAttribute('aria-label','프레젠스 바로가기');menu.inert=true;
  const items=Array.from(menu.children),sections=[['daily','기록과 실행'],['learn','배움과 아카이브'],['connect','우리의 연결'],['manage','공간 관리']];
  const specs={RECORD:['daily',0,'개인 세일즈 기록','나의 필드와 성장'],FIELD:['daily',1,'콜백싯','오늘의 실행을 기록해요'],SITES:['daily',4,'사이트 운영','필드와 활동 장소'],SCORE:['daily',5,'스코어방 결과','함께 만든 성과'],MEMO:['daily',9,'메모와 액션플랜','생각을 다음 행동으로'],EDU:['learn',2,'에듀케이션','우리의 배움 라이브러리'],RECAP:['learn',3,'팀 리캡','지나온 배움 돌아보기'],LIBRARY:['learn',10,'재영의 서재','읽고 나누는 생각'],WORK:['connect',6,'프레젠스 워크북','함께 자라는 공간'],BRAND:['connect',7,'맛도사','일상 속 맛있는 발견'],NOTION:['connect',8,'인천 HC50','팀 노션 바로가기'],PHOTO:['manage',11,'사진 올리기','새로운 순간을 필름에'],TEAM:['manage',12,'팀원 사진 공간','함께 나누는 순간'],LOCK:['manage',13,'관리자 잠금','공간을 안전하게']};
  const menuContent=document.createDocumentFragment();
  const menuHead=document.createElement('div');menuHead.className='hub-menu-head';menuHead.innerHTML='<div><p>YOUR NEXT CHAPTER</p><h2>어디로 가볼까요?</h2></div><button class="hub-menu-close" type="button" aria-label="둘러보기 메뉴 닫기">'+icon('close')+'</button>';menuContent.append(menuHead);
  const grids={};sections.forEach(([key,title])=>{const section=document.createElement('section');section.className='hub-menu-section';section.dataset.group=key;section.innerHTML='<h3>'+title+'</h3><div class="hub-menu-grid"></div>';grids[key]=section.lastElementChild;menuContent.append(section);});
  items.forEach(item=>{const tag=item.querySelector('.m-tag')?.textContent.trim(),s=specs[tag];if(!s)return;item.classList.add('hub-menu-item');item.dataset.hubCategory=tag;item.innerHTML=charm(s[1])+'<span class="hub-menu-copy"><strong>'+s[2]+'</strong><small>'+s[3]+'</small></span>'+icon(item.target==='_blank'?'external':'arrow','hub-menu-arrow');grids[s[0]].append(item);});
  const bottom=document.createElement('div');bottom.className='hub-menu-bottom';bottom.innerHTML='<span>각자의 가능성, 함께하는 Presence.</span><button class="hub-menu-settings" type="button">설정</button>';menuContent.append(bottom);
  const contentNodes=Array.from(menuContent.childNodes);menu.replaceChildren();
  function syncAccess(){
    const isAdmin=admin();
    if(isAdmin&&!menu.firstChild)contentNodes.forEach(n=>menu.append(n));
    if(!isAdmin&&menu.firstChild){menu.classList.remove('open');menu.replaceChildren();}
    menu.inert=!isAdmin||!menu.classList.contains('open');
    if(!isAdmin)$('gearMenu')?.classList.remove('open');
  }
  syncAccess();setInterval(syncAccess,1000);window.addEventListener('storage',syncAccess);
  function positionMenu(){document.documentElement.style.setProperty('--hub-menu-top',Math.max(12,Math.min(head.getBoundingClientRect().bottom+8,window.innerHeight-120))+'px');}
  function closeMenu(restore){menu.classList.remove('open');if(restore)more.focus();}
  menuHead.querySelector('button').addEventListener('click',()=>closeMenu(true));
  bottom.querySelector('button').addEventListener('click',()=>{$('gearBtn').click();});
  controls.addEventListener('click',syncAccess,true);
  more.addEventListener('click',()=>{syncAccess();positionMenu();});
  window.addEventListener('resize',positionMenu,{passive:true});window.addEventListener('scroll',()=>{if(menu.classList.contains('open'))positionMenu();},{passive:true});positionMenu();
  new MutationObserver(()=>{const open=menu.classList.contains('open')&&admin();more.setAttribute('aria-expanded',String(open));more.setAttribute('aria-label',open?'둘러보기 메뉴 닫기':'둘러보기 메뉴 열기');menu.inert=!open;if(open)positionMenu();}).observe(menu,{attributes:true,attributeFilter:['class']});
  menu.addEventListener('click',e=>{const item=e.target.closest('.hub-menu-item');if(item)closeMenu(false);});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&more.getAttribute('aria-expanded')==='true')closeMenu(true);
    if((e.key==='ArrowDown'||e.key==='Enter')&&document.activeElement===more&&menu.classList.contains('open')){e.preventDefault();menu.querySelector('.hub-menu-item')?.focus();}
    if(e.key==='Tab'&&menu.classList.contains('open')){const focusables=Array.from(menu.querySelectorAll('a[href],button:not([disabled])'));const last=focusables[focusables.length-1];if(e.shiftKey&&document.activeElement===focusables[0]){e.preventDefault();more.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();closeMenu(true);}}
  },true);
  const footer=document.createElement('div');footer.className='hub-footer';footer.innerHTML='<p class="hub-footer-note"><strong>Presence.</strong>함께 머물고, 함께 자라는 곳.</p><div class="hub-utility"></div>';document.querySelector('.credits').append(footer);
  const utility=footer.lastElementChild,join=document.createElement('a');join.className='hub-join';join.href='https://presence.co.kr';join.target='_blank';join.rel='noopener';join.innerHTML='함께하기 '+icon('external');utility.append(join);
  function syncUtilities(){
    const gallery=$('reel-gal-btn'),theme=$('pth-btn'),search=$('hsBtn');
    if(gallery&&!gallery.dataset.soft){gallery.dataset.soft='1';gallery.innerHTML=icon('grid')+'<span>사진 모아보기</span>';gallery.setAttribute('aria-label','사진 모아보기');utility.prepend(gallery);}
    if(theme&&!theme.dataset.soft){theme.dataset.soft='1';utility.append(theme);theme.addEventListener('click',styleTheme);styleTheme();}
    if(search&&!search.dataset.soft){search.dataset.soft='1';search.innerHTML=icon('search')+'<span>자료 검색</span>';search.setAttribute('aria-label','자료 검색');utility.append(search);}
  }
  function styleTheme(){const light=document.documentElement.classList.contains('pth-light');$('pth-btn').innerHTML=icon(light?'moon':'sun')+'<span>'+(light?'어두운 화면':'밝은 화면')+'</span>';$('pth-btn').setAttribute('aria-label',light?'어두운 화면으로 전환':'밝은 화면으로 전환');}
  syncUtilities();const utilitiesObserver=new MutationObserver(syncUtilities);utilitiesObserver.observe(document.body,{childList:true});setTimeout(()=>utilitiesObserver.disconnect(),10000);
  // Existing upload dialogs keep their data handlers; add clear labels and keyboard access.
  document.querySelectorAll('.hp-wrap').forEach(panel=>{const isPhoto=!!panel.querySelector('#hpFile');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',isPhoto?'필름 사진 추가':'팀원 사진 공간');const title=panel.querySelector('.hp-title');title.innerHTML=charm(isPhoto?11:12)+'<span>'+(isPhoto?'새로운 순간을 올려요':'우리의 순간을 함께 나눠요')+'</span>';const drop=panel.querySelector('.hp-drop');drop.tabIndex=0;drop.setAttribute('role','button');drop.setAttribute('aria-label','필름에 올릴 사진 선택');drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();drop.click();}});panel.querySelector('.hp-cap').setAttribute('aria-label','사진 캡션');panel.querySelectorAll('.hp-x').forEach(b=>{b.textContent=b.textContent.replace(/^[^가-힣A-Za-z]+/,'');});const msg=panel.querySelector('.hp-msg');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');});
  const searchBox=$('hsBox');if(searchBox){$('hsKick').textContent='다음 배움을 찾아보세요';$('hsIn').setAttribute('aria-label','교육 자료와 페이지 검색');const close=document.createElement('button');close.className='hub-dialog-close';close.setAttribute('aria-label','자료 검색 닫기');close.innerHTML=icon('close');close.onclick=()=>{$('hsOv').classList.remove('on');};searchBox.prepend(close);}
  let activeDialog=null,returnFocus=null;
  function dialogSync(){
    const next=Array.from(document.querySelectorAll('.hp-wrap.open,#pdl-lb.on,#hsOv.on,#reel-gal,.dev.open')).pop()||null;
    if(next===activeDialog)return;
    if(next){if(!activeDialog)returnFocus=document.activeElement;activeDialog=next;next.setAttribute('role','dialog');next.setAttribute('aria-modal','true');if(!next.getAttribute('aria-label'))next.setAttribute('aria-label',next.id==='reel-gal'?'사진 모아보기':next.id==='hsOv'?'자료 검색':'사진 보기');const x=next.querySelector('button');if(next.id==='reel-gal'&&x)x.setAttribute('aria-label','사진 모아보기 닫기');closeMenu(false);document.body.classList.add('hub-modal-open');if(!next.contains(document.activeElement))(next.querySelector('input:not([type=file]),button,[tabindex="0"]')||next).focus();}
    else{activeDialog=null;document.body.classList.remove('hub-modal-open');if(returnFocus?.isConnected)returnFocus.focus();}
  }
  const dialogObserver=new MutationObserver(dialogSync);dialogObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',e=>{if(!activeDialog)return;if(e.key==='Escape'){if(activeDialog.id==='reel-gal')activeDialog.remove();else activeDialog.classList.remove('open','on');e.preventDefault();}if(e.key==='Tab'){const list=Array.from(activeDialog.querySelectorAll('button:not([disabled]),a[href],input:not([type=file]),[tabindex="0"]')).filter(n=>n.getClientRects().length);if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},true);
})();
