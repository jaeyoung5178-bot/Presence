(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const storage={get:(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const savedKey='presence.edu.bookmarks.v1',themeKey='presence.edu.theme.v1';
  const stored=storage.get(savedKey,[]);
  const params=new URLSearchParams(location.search);
  const initialFolder=params.get('view')==='topics'?'__TOPICS__':params.get('tab')==='bookclub'?'__BOOKCLUB__':params.get('tab')==='wepair'?'위페어':params.get('category')||'__ALL__';
  const state={data:null,active:initialFolder,view:initialFolder==='__TOPICS__'?'topics':initialFolder!=='__ALL__'||params.get('view')==='all'?'materials':'shelves',fromShelf:false,parentView:null,lastFolder:null,isAdmin:false,query:'',savedOnly:false,selected:null,saved:new Set(Array.isArray(stored)?stored:[])};
  const remembered=history.state?.presenceLibrary;
  if(remembered?.folder===state.active&&remembered.view===state.view)Object.assign(state,{fromShelf:!!remembered.fromShelf,parentView:remembered.parentView||null,lastFolder:remembered.lastFolder||null,query:remembered.query||'',savedOnly:!!remembered.savedOnly});
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
  const topicFolders=['세일즈','멘탈리티','마이스토리','섹터리더'];
  const libraryInfo={
    '신입':{art:'sprout',description:'처음부터, 차근차근'},
    '__BOOKCLUB__':{art:'reading',description:'함께 읽고 생각을 나눠요'},
    '__TOPICS__':{art:'topics',description:'세일즈부터 리더십까지'},
    '피치카드':{art:'pitch',description:'마음을 움직이는 한마디'},
    '위페어':{art:'wepair',description:'함께 만든 경험과 배움'},
    '리캡':{art:'recap',description:'우리의 배움을 돌아봐요'},
    '세일즈':{art:'sales',description:'현장에서 쌓아가는 실력'},
    '멘탈리티':{art:'mindset',description:'나를 믿고 나아가는 힘'},
    '마이스토리':{art:'story',description:'나만의 이야기를 발견해요'},
    '섹터리더':{art:'leader',description:'함께 성장하는 팀의 방향'},
    '클라이언트 미팅':{art:'meeting',description:'좋은 협업을 만드는 대화'},
    'BOM':{art:'bom',description:'다음 성장을 준비해요'},
    'FOM':{art:'fom',description:'현장과 함께 만드는 다음 장'},
    '__ALL__':{art:'pencil',description:'모든 라이브러리의 자료를 한곳에서'}
  };
  const libraryLabel=folder=>folder==='__TOPICS__'?'토픽':folder==='__BOOKCLUB__'?'독서발표회':folder==='__ALL__'?'전체 자료':folder;
  const infoFor=folder=>libraryInfo[folder]||{art:null,description:'함께 쌓아가는 배움의 기록'};
  function pageUrl(){return state.view==='shelves'?'edu.html':state.view==='topics'?'edu.html?view=topics':state.active==='__BOOKCLUB__'?'edu.html?tab=bookclub':state.active==='__ALL__'?'edu.html?view=all':'edu.html?category='+encodeURIComponent(state.active);}
  function rememberPage(){
    history.replaceState({...history.state,presenceLibrary:{view:state.view,folder:state.active,fromShelf:state.fromShelf,parentView:state.parentView,lastFolder:state.lastFolder,query:state.query,savedOnly:state.savedOnly,scroll:scrollY}},'',pageUrl());
  }
  function focusPage(scroll=0,restoreFolder=false){
    requestAnimationFrame(()=>{
      const target=state.view!=='materials'?(restoreFolder&&[...document.querySelectorAll('[data-f]')].find(e=>e.dataset.f===state.lastFolder)||$(state.view==='shelves'?'#libraryTitle':'#chapterTitle')):$('#chapterTitle');
      target?.focus({preventScroll:true});window.scrollTo({top:scroll,behavior:'instant'});
    });
  }
  function navigate(folder,view='materials',replace=false){
    if(folder==='__TOPICS__')view='topics';
    if(folder==='__WEPAIR__')folder='위페어';
    const parentView=state.view!=='materials'?state.view:null,fromShelf=parentView==='shelves';
    if(parentView)state.lastFolder=folder;
    rememberPage();
    if(!replace)history.pushState(null,'',location.href);
    Object.assign(state,{view,fromShelf,parentView});clearFilters();hooks.selectCategory(folder==='__TOPICS__'?'__ALL__':folder);focusPage(0,view==='shelves');
  }
  function renderPageFrame(){
    const shelves=state.view==='shelves',collections=state.view!=='materials',special=state.active==='__BOOKCLUB__';
    document.body.dataset.libraryView=state.view;
    $('#libraryIntro').hidden=!shelves;$('.category-panel').hidden=!collections;
    $('#libraryDetailHeading').hidden=shelves;$('#libraryBreadcrumb').hidden=shelves;
    $('#materialToolbar').hidden=collections;$('.search-and-save').hidden=special;
    $('#grid').hidden=collections;
    $('#topicCrumb').hidden=!topicFolders.includes(state.active)||collections;
    $('#chapterTitle').textContent=libraryLabel(state.active);
    $('#currentLibrary').textContent=libraryLabel(state.active);
    $('#chapterDescription').textContent=infoFor(state.active).description;
    $('#chapterProp').className='library-prop library-prop-'+(infoFor(state.active).art||'pencil');
    document.title=shelves?'라이브러리 · Presence':libraryLabel(state.active)+' · Presence 라이브러리';
    rememberPage();
  }
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
    $('#savedCount').textContent=state.data?state.data.items.filter(item=>(state.active==='__ALL__'||item.folder===state.active)&&state.saved.has(item.href)).length:state.saved.size;
    document.querySelectorAll('.bookmark').forEach(button=>{const yes=state.saved.has(button.dataset.href);button.setAttribute('aria-pressed',String(yes));button.setAttribute('aria-label',`${button.dataset.title} ${yes?'보관함에서 빼기':'보관함에 담기'}`);});
    if(state.selected)$('#dialogSave').textContent=state.saved.has(state.selected.href)?'보관함에서 빼기':'보관함에 담기';
  }
  function toggleSaved(href){const remove=state.saved.has(href);remove?state.saved.delete(href):state.saved.add(href);storage.set(savedKey,[...state.saved]);hooks.toast(remove?'보관함에서 뺐어요.':'나의 보관함에 담았어요.');if(state.savedOnly)hooks.render();else savedLabels();}
  function renderFolders(){
    const data=state.data,topics=state.view==='topics';
    const primary=['신입','__BOOKCLUB__','__TOPICS__','피치카드','위페어','리캡'];
    const order=topics?topicFolders.filter(f=>data.folders.includes(f)):[...primary.filter(f=>f.startsWith('__')||data.folders.includes(f)),...data.folders.filter(f=>!primary.includes(f)&&!topicFolders.includes(f))];
    const entries=order.map(folder=>({folder,label:libraryLabel(folder),count:folder==='__BOOKCLUB__'?(window.PresenceBookGallery?.count()??1):folder==='__TOPICS__'?topicFolders.filter(f=>data.folders.includes(f)).length:data.items.filter(i=>i.folder===folder).length,editable:!folder.startsWith('__')}));
    const available=entries.filter(f=>f.count>0),upcoming=entries.filter(f=>f.count===0);
    $('#libraryTotal').textContent=available.length+'개의 라이브러리';
    const entry=(f,compact=false)=>{
      const info=infoFor(f.folder),unit=f.folder==='__TOPICS__'?'개의 주제':f.folder==='__BOOKCLUB__'?'개의 발표':'개의 자료';
      const art=info.art?`<span class="library-prop library-prop-${info.art}"></span>`:`<span class="library-monogram">${escape(f.label.slice(0,1))}</span>`;
      return `<div class="category-entry${compact?' library-empty':''}"><button type="button" ${f.folder==='__BOOKCLUB__'?'id="bookclubTab"':''} class="category chip library-card" data-f="${escape(f.folder)}" aria-label="${escape(f.label)} · ${f.count}${unit}${compact?' · 준비 중':''}"><span class="library-card-art" aria-hidden="true">${art}</span><span class="library-card-copy"><span class="library-name-line"><span class="tab-name">${escape(f.label)}</span><span class="library-card-meta"><span class="count">${f.count}</span><span>${unit}</span></span></span><span class="library-description">${escape(compact?'준비 중':info.description)}</span></span><span class="library-card-arrow" aria-hidden="true">›</span></button>${state.isAdmin&&f.editable?`<button class="folder-delete" data-del="${escape(f.folder)}" aria-label="${escape(f.folder)} 폴더 삭제">×</button>`:''}</div>`;
    };
    $('#folders').innerHTML=(topics?entries:available).map(f=>entry(f)).join('')+(!topics&&upcoming.length?'<div class="upcoming-heading">준비 중인 라이브러리</div><div class="upcoming-folders">'+upcoming.map(f=>entry(f,true)).join('')+'</div>':'')+(state.isAdmin&&!topics?'<button type="button" class="category chip addf" id="addFolder">＋ 라이브러리 추가</button>':'');
  }
  function card(item,index){
    const artMarkup=`<div class="card-art"><span class="card-tag">${escape(item.tag||'LEARN')}</span></div>`;
    const description=`<p class="su">${escape(item.sub)}</p>`;
    const body=state.isAdmin?
      `${artMarkup}<div class="card-copy"><label class="editor-title-label" for="title-${escape(item.id)}">제목</label><input class="title-edit" id="title-${escape(item.id)}" data-title-edit="${escape(item.id)}" value="${escape(item.title)}" aria-label="자료 제목"><div class="rename-hint">Enter 또는 바깥을 누르면 저장됩니다.</div>${description}<div class="mv"><label for="folder-${escape(item.id)}">폴더 이동</label><select id="folder-${escape(item.id)}" data-mv="${escape(item.id)}">${state.data.folders.map(f=>`<option value="${escape(f)}" ${f===item.folder?'selected':''}>${escape(f)}</option>`).join('')}</select></div></div><button class="edit-detail" data-edit-detail="${escape(item.id)}">상세 편집 ↗</button><button class="xdel" data-xdel="${escape(item.id)}" aria-label="${escape(item.title)} 자료 삭제">×</button>`:
      `<a class="card-open" href="${escape(safeUrl(item.href))}" ${item.target==='_blank'?'target="_blank" rel="noopener"':''} aria-label="${escape(item.title)} 교육 자료 열기${item.target==='_blank'?' (새 창)':''}"><div class="card-copy"><h4 class="ti">${escape(item.title)}</h4>${description}</div><span class="lesson-open-arrow" aria-hidden="true">↗</span></a><button class="bookmark" data-href="${escape(item.href)}" data-title="${escape(item.title)}" aria-pressed="false">${icons.bookmark}</button>`;
    return `<article class="item lesson-card" data-id="${escape(item.id)}" data-href="${escape(item.href||'#')}" data-target="${escape(item.target||'')}">${body}</article>`;
  }
  function render(data,active,isAdmin,bookClubCard){
    active=state.view==='topics'?'__TOPICS__':active==='__WEPAIR__'?'위페어':active;
    Object.assign(state,{data,active,isAdmin});bookClubMarkup=bookClubCard;
    document.body.classList.toggle('editing',isAdmin);renderFolders();renderPageFrame();
    $('#adminBtn').setAttribute('aria-pressed',String(isAdmin));
    $('#adminBtn').textContent=isAdmin?'편집 완료':'자료 관리';
    $('#savedButton').hidden=isAdmin;
    const special=active==='__BOOKCLUB__';$('#searchInput').disabled=special;
    $('#emptyState').hidden=true;$('#grid').removeAttribute('aria-busy');
    if(state.view!=='materials'){$('#grid').innerHTML='';savedLabels();return;}
    $('#selectedTitle').textContent=state.savedOnly?'보관한 자료':'교육 자료';
    $('#resultsNote').textContent=isAdmin?'제목·폴더·링크를 편집할 수 있어요.':'지금 마음이 가는 배움부터 펼쳐보세요.';
    if(active==='__BOOKCLUB__'){$('#resultCount').textContent='1개의 발표';$('#grid').innerHTML=bookClubMarkup;savedLabels();return;}
    const query=state.query.toLocaleLowerCase();
    const list=data.items.filter(item=>(active==='__ALL__'||item.folder===active)&&(!state.savedOnly||state.saved.has(item.href))&&(!query||(item.title+' '+item.sub+' '+item.tag+' '+item.folder).toLocaleLowerCase().includes(query)));
    const showBookClub=active==='__ALL__'&&!state.savedOnly&&(!query||'퓨처 셀프 future self 독서발표회 미래의 내가 오늘을 살게 하라'.includes(query));
    $('#resultCount').textContent=`${list.length+(showBookClub?1:0)}개`;
    $('#grid').innerHTML=(showBookClub?bookClubMarkup:'')+list.map(card).join('')+(isAdmin?'<button type="button" class="additem" id="addItem">＋ 자료 추가</button>':'');
    if(!list.length&&!showBookClub){$('#emptyState').hidden=false;$('#emptyTitle').textContent=query?'검색 결과가 없어요.':state.savedOnly?'보관한 자료가 없어요.':'새로운 자료를 준비하고 있어요.';$('#emptyText').textContent=query?'다른 검색어로 다시 찾아보세요.':state.savedOnly?'자료의 책갈피를 누르면 이 기기에 저장돼요.':isAdmin?'자료 추가 버튼으로 새 교육 자료를 등록하세요.':'라이브러리 목록에서 다른 배움을 만나보세요.';$('#resetButton').hidden=!query&&!state.savedOnly;}
    savedLabels();
  }
  // The existing host delegates here; native links now open materials directly.
  function openDetail(){}
  function clearFilters(){state.query='';state.savedOnly=false;$('#searchInput').value='';$('#savedButton').setAttribute('aria-pressed','false');}
  function configure(callbacks){
    hooks=callbacks;setTheme(storage.get(themeKey,'dark'));document.body.classList.add('library-first','library-compact');
    $('.hero').hidden=true;
    const search=$('.search-and-save'),heading=$('.library-heading');
    heading.id='libraryIntro';
    heading.innerHTML='<div><p class="section-kicker">PRESENCE EDUCATION</p><h1 id="libraryTitle" tabindex="-1">라이브러리<span class="library-title-dot">.</span></h1><p class="library-intro-copy">우리의 다음을 채우는 작은 배움.</p></div><div class="library-intro-actions"><span id="libraryTotal">라이브러리를 불러오는 중</span><button type="button" id="allMaterials">전체 자료 <span aria-hidden="true">↗</span></button></div>';
    $('.category-label').hidden=true;
    $('#folders').setAttribute('aria-label','교육 라이브러리 선택');
    $('#library').insertAdjacentHTML('afterbegin','<nav id="libraryBreadcrumb" class="library-breadcrumb" aria-label="현재 위치" hidden><button type="button" id="backToLibraries"><span aria-hidden="true">←</span> 라이브러리</button><span aria-hidden="true">/</span><span id="topicCrumb" hidden><button type="button" id="backToTopics">토픽</button><span aria-hidden="true">/</span></span><span id="currentLibrary" aria-current="page"></span></nav>');
    $('.category-panel').insertAdjacentHTML('beforebegin','<header id="libraryDetailHeading" class="library-detail-heading" hidden><div><h1 id="chapterTitle" tabindex="-1"></h1><p id="chapterDescription"></p></div><span id="chapterProp" class="library-prop" aria-hidden="true"></span></header>');
    $('.category-panel').insertAdjacentHTML('afterend','<div id="materialToolbar" class="material-toolbar" hidden></div>');
    $('#materialToolbar').append($('.results-heading'),search);
    $('#resetButton').textContent='필터 초기화';$('#savedButton').innerHTML=icons.bookmark+'<span>보관한 자료</span><b id="savedCount">0</b>';
    $('#searchInput').placeholder='자료 검색';$('#searchInput').setAttribute('aria-label','현재 라이브러리의 교육 자료 검색');
    $('#searchInput').value=state.query;$('#savedButton').setAttribute('aria-pressed',String(state.savedOnly));
    $('#savedButton').setAttribute('aria-label','현재 라이브러리에서 보관한 자료만 보기');
    $('#allMaterials').addEventListener('click',()=>navigate('__ALL__'));
    $('#backToLibraries').addEventListener('click',()=>{if(state.parentView==='shelves')history.back();else navigate('__ALL__','shelves',true);});
    $('#backToTopics').addEventListener('click',()=>{if(state.parentView==='topics')history.back();else navigate('__TOPICS__','topics',true);});
    window.addEventListener('popstate',event=>{
      const saved=event.state?.presenceLibrary,url=new URLSearchParams(location.search);
      const rawFolder=saved?.folder||(url.get('view')==='topics'?'__TOPICS__':url.get('tab')==='bookclub'?'__BOOKCLUB__':url.get('tab')==='wepair'?'위페어':url.get('category')||'__ALL__');
      const folder=rawFolder==='__WEPAIR__'?'위페어':rawFolder;
      Object.assign(state,{view:saved?.view||(folder==='__TOPICS__'?'topics':folder!=='__ALL__'||url.get('view')==='all'?'materials':'shelves'),fromShelf:saved?.fromShelf||false,parentView:saved?.parentView||null,lastFolder:saved?.lastFolder||state.lastFolder,query:saved?.query||'',savedOnly:saved?.savedOnly||false});
      $('#searchInput').value=state.query;$('#savedButton').setAttribute('aria-pressed',String(state.savedOnly));
      hooks.selectCategory(folder==='__TOPICS__'?'__ALL__':folder);focusPage(saved?.scroll||0,true);
    });
    window.addEventListener('pagehide',rememberPage);
    $('#folders').innerHTML=Array.from({length:6},()=>'<div class="category-skeleton" aria-hidden="true"></div>').join('');
    $('#libraryTotal').setAttribute('aria-live','polite');$('#emptyState .prop').className='library-prop library-prop-lamp';renderPageFrame();
    if(params.get('tab')==='wepair')hooks.selectCategory('위페어');
    $('#themeButton').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    $('#searchInput').addEventListener('input',event=>{state.query=event.target.value.trim();hooks.render();});
    $('#savedButton').addEventListener('click',()=>{state.savedOnly=!state.savedOnly;$('#savedButton').setAttribute('aria-pressed',String(state.savedOnly));hooks.render();});
    $('#resetButton').addEventListener('click',()=>{clearFilters();hooks.render();});
    $('#folders').addEventListener('click',event=>{const button=event.target.closest('.chip[data-f]');if(button){event.preventDefault();event.stopImmediatePropagation();navigate(button.dataset.f);}},true);
    $('#grid').addEventListener('click',event=>{const bookmark=event.target.closest('.bookmark');if(bookmark){event.preventDefault();event.stopImmediatePropagation();toggleSaved(bookmark.dataset.href);}},true);
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
      if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!$('#lessonDialog').open&&!event.target.matches('input,textarea,[contenteditable]')){event.preventDefault();if(state.view!=='materials'||$('#searchInput').disabled)navigate('__ALL__');requestAnimationFrame(()=>$('#searchInput').focus());}
    });
  }
  window.PresenceEducation={configure,render,openDetail};
})();
