(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const storage={get:(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const savedKey='presence.edu.bookmarks.v1',themeKey='presence.edu.theme.v1';
  const stored=storage.get(savedKey,[]);
  const state={data:null,active:'__ALL__',isAdmin:false,query:'',savedOnly:false,selected:null,saved:new Set(Array.isArray(stored)?stored:[])};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let hooks=null,bookClubMarkup='';
  const svg=body=>`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${body}</svg>`;
  const icons={
    grid:svg('<rect x="3.5" y="3.5" width="6" height="6" rx="1.5"/><rect x="14.5" y="3.5" width="6" height="6" rx="1.5"/><rect x="3.5" y="14.5" width="6" height="6" rx="1.5"/><rect x="14.5" y="14.5" width="6" height="6" rx="1.5"/>'),
    book:svg('<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1v14"/>'),
    compass:svg('<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>'),
    mic:svg('<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v4M8 22h8"/>'),
    flag:svg('<path d="M5 22V4c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>'),
    spark:svg('<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>'),
    camera:svg('<rect x="3" y="7" width="18" height="14" rx="3"/><circle cx="12" cy="14" r="3.5"/><path d="m7 7 2-4h6l2 4"/>'),
    people:svg('<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3"/>'),
    globe:svg('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>'),
    chart:svg('<path d="M4 3v17h17M8 14l4-4 4 3 5-7"/>'),
    ticket:svg('<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4ZM15 6v3m0 2v2m0 2v3"/>'),
    bookmark:svg('<path d="M6 4h12v17l-6-4-6 4z"/>'),
    sun:svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>'),
    moon:svg('<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>')
  };
  const categories={
    '__ALL__':{label:'전체',icon:'grid'},'신입':{icon:'book'},'피치카드':{icon:'mic'},'세일즈':{icon:'chart'},'섹터리더':{icon:'flag'},'멘탈리티':{icon:'spark'},'마이스토리':{icon:'camera'},'리캡':{icon:'ticket'},'위페어':{icon:'globe'},'클라이언트 미팅':{icon:'people'},'BOM':{icon:'compass'},'FOM':{icon:'flag'}
  };
  const assetDefs=[
    ['book','아직 쓰이지 않은 노트','배움의 시작 · 신입'],['compass','나만의 방향을 찾는 나침반','리더십 · 성장'],['mic','세상에 전하는 나의 목소리','피치 · 소통'],['camera','우리의 한 장면','마이스토리 · 기록'],['globe','조금 더 넓어지는 세계','체리티 · 새로운 관점'],['map','한 걸음씩 만드는 길','필드 · 실천'],['plane','가능성을 향한 첫 비행','도전 · 새로운 시작'],['ticket','다음 챕터로 가는 티켓','온보딩 · 새로운 기회']
  ];
  function artFor(item){
    const t=item.title+' '+item.href+' '+item.tag;
    if(/테스트링크|체리티|charity|위페어/i.test(t))return 'globe';
    if(/전쟁|리캡|Recap|Story|스토리/i.test(t))return 'camera';
    if(/Call Back|콜백|트립|필드/i.test(t))return 'map';
    if(/Onboarding|온보딩/i.test(t))return 'ticket';
    if(/피치|Pitch|비언어|말보다/i.test(t))return 'mic';
    if(/리더|GRASP|TRAIN|Guide/i.test(t))return 'compass';
    if(/NoZero|Steady|멘탈/i.test(t))return 'plane';
    return 'book';
  }
  const tones={book:['#8faee622','#b3c9ef'],compass:['#b4c5a722','#b8ceac'],mic:['#eaa78322','#edba9c'],camera:['#8eafdc22','#b0c5e5'],globe:['#99c8bc22','#bad8ce'],map:['#edb09220','#ecc4a9'],plane:['#a8badd22','#bdcbea'],ticket:['#cab99322','#dfcfb1']};
  function safeUrl(href){try{const u=new URL(href,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'edu.html';}catch{return 'edu.html';}}
  function sparkle(event,element){
    if(reduced.matches)return;
    const r=element.getBoundingClientRect(),x=event.clientX||r.x+r.width/2,y=event.clientY||r.y+r.height/2;
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3-.5,s=document.createElement('i');s.className='click-spark';s.setAttribute('aria-hidden','true');
      s.style.cssText=`--x:${x}px;--y:${y}px;--dx:${Math.cos(a)*37}px;--dy:${Math.sin(a)*31-5}px;--spark:${['#b4caed','#ecc09a','#c8d7b9'][i%3]}`;
      document.body.append(s);s.addEventListener('animationend',()=>s.remove(),{once:true});setTimeout(()=>s.remove(),650);
    }
  }
  function setTheme(theme){document.documentElement.dataset.theme=theme;storage.set(themeKey,theme);$('#themeButton').innerHTML=icons[theme==='dark'?'sun':'moon'];$('#themeButton').setAttribute('aria-label',theme==='dark'?'밝은 화면으로 전환':'어두운 화면으로 전환');}
  function savedLabels(){
    $('#savedCount').textContent=state.saved.size;
    document.querySelectorAll('.bookmark').forEach(button=>{const yes=state.saved.has(button.dataset.href);button.setAttribute('aria-pressed',String(yes));button.setAttribute('aria-label',`${button.dataset.title} ${yes?'보관함에서 빼기':'보관함에 담기'}`);});
    if(state.selected)$('#dialogSave').textContent=state.saved.has(state.selected.href)?'보관함에서 빼기':'보관함에 담기';
  }
  function toggleSaved(href){const remove=state.saved.has(href);remove?state.saved.delete(href):state.saved.add(href);storage.set(savedKey,[...state.saved]);hooks.toast(remove?'보관함에서 뺐어요.':'나의 보관함에 담았어요.');if(state.savedOnly)hooks.render();else savedLabels();}
  function renderFolders(){
    const data=state.data,order=['__ALL__',...Object.keys(categories).filter(f=>f!=='__ALL__'&&data.folders.includes(f)),...data.folders.filter(f=>!categories[f])];
    const entries=order.map(folder=>({folder,label:categories[folder]?.label||folder,icon:categories[folder]?.icon||'book',count:folder==='__ALL__'?data.items.length+1:data.items.filter(i=>i.folder===folder).length,editable:folder!=='__ALL__'}));
    entries.splice(2,0,{folder:'__BOOKCLUB__',label:'독서발표회',icon:'book',count:1},{folder:'__WEPAIR__',label:'위페어 발표',icon:'globe',count:''});
    $('#folders').innerHTML=entries.map(f=>`<div class="category-entry"><button type="button" ${f.folder==='__BOOKCLUB__'?'id="bookclubTab"':''} class="category chip ${state.active===f.folder?'on':''}" data-f="${escape(f.folder)}" aria-pressed="${state.active===f.folder}"><span class="tab-glyph">${icons[f.icon]}</span><span class="tab-name">${escape(f.label)}</span><span class="count">${f.count}</span></button>${state.isAdmin&&f.editable?`<button class="folder-delete" data-del="${escape(f.folder)}" aria-label="${escape(f.folder)} 폴더 삭제">×</button>`:''}</div>`).join('')+(state.isAdmin?'<button type="button" class="category chip addf" id="addFolder">＋ 폴더 추가</button>':'');
  }
  function card(item,index){
    const art=artFor(item),tone=tones[art];
    const artMarkup=`<div class="card-art"><span class="card-tag">${escape(item.tag||'LEARN')}</span><span class="prop prop-${art}" aria-hidden="true"></span></div>`;
    const description=`<p class="su">${escape(item.sub)}</p>`;
    const body=state.isAdmin?
      `${artMarkup}<div class="card-copy"><label class="editor-title-label" for="title-${escape(item.id)}">제목</label><input class="title-edit" id="title-${escape(item.id)}" data-title-edit="${escape(item.id)}" value="${escape(item.title)}" aria-label="자료 제목"><div class="rename-hint">Enter 또는 바깥을 누르면 저장됩니다.</div>${description}<div class="mv"><label for="folder-${escape(item.id)}">폴더 이동</label><select id="folder-${escape(item.id)}" data-mv="${escape(item.id)}">${state.data.folders.map(f=>`<option value="${escape(f)}" ${f===item.folder?'selected':''}>${escape(f)}</option>`).join('')}</select></div></div><button class="edit-detail" data-edit-detail="${escape(item.id)}">상세 편집 ↗</button><button class="xdel" data-xdel="${escape(item.id)}" aria-label="${escape(item.title)} 자료 삭제">×</button>`:
      `<button class="card-open" aria-label="${escape(item.title)} 자료 보기">${artMarkup}<div class="card-copy"><h4 class="ti">${escape(item.title)}</h4>${description}</div><div class="card-bottom"><span>${escape(item.folder)} · 교육 자료</span><span class="open-label">펼쳐보기 <span aria-hidden="true">↗</span></span></div></button><button class="bookmark" data-href="${escape(item.href)}" data-title="${escape(item.title)}" aria-pressed="false">${icons.bookmark}</button>`;
    return `<article class="item lesson-card" data-id="${escape(item.id)}" data-href="${escape(item.href||'#')}" data-target="${escape(item.target||'')}" style="--i:${Math.min(index,8)};--tint:${tone[0]};--detail:${tone[1]}">${body}</article>`;
  }
  function render(data,active,isAdmin,bookClubCard){
    Object.assign(state,{data,active,isAdmin});bookClubMarkup=bookClubCard;
    document.body.classList.toggle('editing',isAdmin);renderFolders();
    $('#adminBtn').setAttribute('aria-pressed',String(isAdmin));
    $('#adminBtn').textContent=isAdmin?'편집 완료':'자료 관리';
    $('#savedButton').hidden=isAdmin;
    const special=active==='__WEPAIR__'||active==='__BOOKCLUB__';$('#searchInput').disabled=special;
    $('#emptyState').hidden=true;$('#grid').removeAttribute('aria-busy');
    $('#selectedTitle').textContent=active==='__WEPAIR__'?'위페어 발표':active==='__BOOKCLUB__'?'독서발표회':state.savedOnly?'나의 보관함':active==='__ALL__'?'전체 챕터':active+' 챕터';
    $('#resultsNote').textContent=isAdmin?'제목·폴더·링크를 편집할 수 있어요.':'지금 마음이 가는 배움부터 펼쳐보세요.';
    if(active==='__WEPAIR__'){
      $('#resultCount').textContent='프레젠테이션';
      $('#grid').innerHTML='<section class="wepair-panel" aria-label="위페어 프레젠테이션"><div class="wepair-head"><div class="wepair-title"><span class="wepair-mark">W</span><div><strong>위페어 프레젠테이션</strong><span>교육 화면을 이 페이지 안에서 바로 확인할 수 있어요.</span></div></div><a class="wepair-open" href="https://jaeyoung5178-bot.github.io/wepair-presentation/" target="_blank" rel="noopener">크게 보기 ↗</a></div><div class="wepair-frame-wrap"><iframe class="wepair-frame" src="https://jaeyoung5178-bot.github.io/wepair-presentation/" title="위페어 프레젠테이션" loading="eager" allow="fullscreen" allowfullscreen></iframe></div></section>';
      savedLabels();return;
    }
    if(active==='__BOOKCLUB__'){$('#resultCount').textContent='1개의 발표';$('#grid').innerHTML=bookClubMarkup;savedLabels();return;}
    const query=state.query.toLocaleLowerCase();
    const list=data.items.filter(item=>(active==='__ALL__'||item.folder===active)&&(!state.savedOnly||state.saved.has(item.href))&&(!query||(item.title+' '+item.sub+' '+item.tag+' '+item.folder).toLocaleLowerCase().includes(query)));
    const showBookClub=active==='__ALL__'&&!state.savedOnly&&(!query||'퓨처 셀프 future self 독서발표회 미래의 내가 오늘을 살게 하라'.includes(query));
    $('#resultCount').textContent=`${list.length+(showBookClub?1:0)}개의 배움`;
    $('#grid').innerHTML=(showBookClub?bookClubMarkup:'')+list.map(card).join('')+(isAdmin?'<button type="button" class="additem" id="addItem">＋ 자료 추가</button>':'');
    if(!list.length&&!showBookClub){$('#emptyState').hidden=false;$('#emptyTitle').textContent=query?'찾는 배움이 아직 보이지 않네요.':state.savedOnly?'마음에 드는 배움을 담아보세요.':'아직 펼쳐지지 않은 챕터예요.';$('#emptyText').textContent=query?'다른 단어로 검색하거나 전체 자료를 둘러보세요.':state.savedOnly?'카드의 책갈피를 누르면 이 기기의 보관함에 저장돼요.':isAdmin?'자료 추가 버튼으로 새 교육 자료를 등록하세요.':'다른 챕터에서 새로운 배움을 찾아보세요.';}
    savedLabels();
  }
  function openDetail(element){
    const item=state.data.items.find(i=>String(i.id)===element.dataset.id);if(!item)return;
    state.selected=item;$('#dialogProp').className='prop prop-'+artFor(item);$('#dialogTitle').textContent=item.title;$('#dialogDescription').textContent=item.sub;$('#dialogCategory').textContent=item.folder+' / '+(item.tag||'LEARN');
    $('#dialogOpen').href=safeUrl(item.href);$('#dialogOpen').target=item.target==='_blank'?'_blank':'_self';
    $('#dialogNoteText').textContent=item.target==='_blank'?'교육 자료는 새 창에서 열립니다. 돌아오면 지금 고른 챕터가 그대로 있어요.':'교육 자료로 이동합니다. 뒤로 돌아오면 지금 고른 챕터에서 이어볼 수 있어요.';
    savedLabels();$('#lessonDialog').showModal();
  }
  function clearFilters(){state.query='';state.savedOnly=false;$('#searchInput').value='';$('#savedButton').setAttribute('aria-pressed','false');}
  function configure(callbacks){
    hooks=callbacks;setTheme(storage.get(themeKey,'dark'));
    $('#themeButton').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    $('#searchInput').addEventListener('input',event=>{state.query=event.target.value.trim();hooks.render();});
    $('#savedButton').addEventListener('click',()=>{state.savedOnly=!state.savedOnly;$('#savedButton').setAttribute('aria-pressed',String(state.savedOnly));hooks.selectCategory('__ALL__');});
    $('#resetButton').addEventListener('click',()=>{clearFilters();hooks.selectCategory('__ALL__');});
    $('#startButton').addEventListener('click',event=>{sparkle(event,event.currentTarget);clearFilters();hooks.selectCategory('신입');$('#library').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});});
    $('#folders').addEventListener('click',event=>{const button=event.target.closest('.chip[data-f]');if(button){state.savedOnly=false;$('#savedButton').setAttribute('aria-pressed','false');sparkle(event,button);}},true);
    $('#grid').addEventListener('click',event=>{const bookmark=event.target.closest('.bookmark');if(bookmark){event.preventDefault();event.stopImmediatePropagation();sparkle(event,bookmark);toggleSaved(bookmark.dataset.href);}else{const card=event.target.closest('.card-open');if(card)sparkle(event,card);}},true);
    $('#dialogSave').addEventListener('click',event=>{if(state.selected){sparkle(event,event.currentTarget);toggleSaved(state.selected.href);}});
    $('#dialogClose').addEventListener('click',()=>$('#lessonDialog').close());
    $('#lessonDialog').addEventListener('click',event=>{if(event.target===event.currentTarget){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close();}});
    let editorReturnFocus=null;
    new MutationObserver(()=>{const open=$('#itemMask').classList.contains('on');if(open){editorReturnFocus=document.activeElement;$('#fTitle').focus();}else if(editorReturnFocus?.isConnected){editorReturnFocus.focus();editorReturnFocus=null;}else if(!open)$('#adminBtn').focus({preventScroll:true});}).observe($('#itemMask'),{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',event=>{
      if($('#itemMask').classList.contains('on')){
        if(event.key==='Escape'){event.preventDefault();$('#itemCancel').click();}
        if(event.key==='Tab'){
          const controls=[...$('#itemMask').querySelectorAll('input,select,button')].filter(e=>!e.disabled),first=controls[0],last=controls.at(-1);
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
        return;
      }
      if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!$('#lessonDialog').open&&!event.target.matches('input,textarea,[contenteditable]')){event.preventDefault();if($('#searchInput').disabled)hooks.selectCategory('__ALL__');$('#searchInput').focus();}
    });
  }
  window.PresenceEducation={configure,render,openDetail};
})();
