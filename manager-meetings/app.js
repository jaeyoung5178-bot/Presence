(function(){
  'use strict';
  /* Integration options: dataUrl (JSON), backUrl (learning/archive return URL),
     navigation ([{label, href}]), assetBase (optional URL that replaces the JSON directory).
     All meeting content comes from content.json; no client-side completion state is invented. */
  const config = Object.assign({dataUrl:'../content.json',backUrl:'../index.html?open=learn',presenceUrl:'https://presence.co.kr/index.html',navigation:[]},window.PRESENCE_MANAGER_CONFIG||{});
  const root = document.getElementById('pm-root');
  const dialog = document.getElementById('pm-image-dialog');
  const dataUrl = new URL(config.dataUrl,location.href);
  const assetBase = config.assetBase ? new URL(config.assetBase,location.href) : dataUrl;
  let data, selectedTeam = 0, archiveScroll = 0, lastDialogFocus, zoomIndex = 0;
  const zoomLevels = [1,1.5,2,3,4];
  const icon = (name) => {
    const paths = {back:'<path d="m14 6-6 6 6 6M8 12h12"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',expand:'<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>'};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
  };
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset = path => new URL(path,assetBase).href;
  const teamName = t => t.name || t.fallbackLabel || '팀 SWOT 분석';
  const footer = () => '<footer class="pm-footer"><b>PRESENCE MANAGER ARCHIVE</b><span>팀의 생각과, 함께 정한 다음 행동을 기록합니다.</span></footer>'+ (config.navigation.length?'<nav class="pm-global-nav" aria-label="프레젠스 주요 메뉴">'+config.navigation.map(n=>'<a href="'+esc(n.href)+'">'+esc(n.label)+'</a>').join('')+'</nav>':'');
  function topbar(detail){
    return '<header class="pm-topbar"><a class="pm-back" href="'+esc(detail?'#archive':config.backUrl)+'">'+icon('back')+'<span>'+(detail?'회의 저장소':'배움과 아카이브로')+'</span></a><a class="pm-back" href="'+esc(config.presenceUrl)+'"><span>프레젠스로 돌아가기 ↗</span></a></header>';
  }
  function archive(){
    document.title = data.archive.title+' · Presence';
    root.innerHTML = topbar(false)+'<main><section class="pm-archive-hero" aria-labelledby="pm-archive-title"><div><p class="pm-kicker">LEARNING & ARCHIVE</p><h1 class="pm-heading" id="pm-archive-title">'+esc(data.archive.title)+'</h1><p class="pm-intro">'+esc(data.archive.subtitle)+'</p></div><div class="pm-folder" aria-hidden="true"><span class="pm-folder-tab"></span><span class="pm-folder-sheet"><b>OUR NEXT CHAPTER</b><i></i><i></i><i></i></span><span class="pm-folder-label">MANAGER MEETINGS</span><span class="pm-folder-ring">01</span></div></section><section aria-labelledby="pm-meetings-title"><div class="pm-section-heading"><h2 id="pm-meetings-title">회의 기록</h2><p>첫 번째 이야기</p></div><a class="pm-meeting-card" href="#meeting/first-team-swot"><div class="pm-meeting-cover" aria-hidden="true"><div class="pm-paper-stack">'+data.meeting.teams.map(t=>'<img src="'+esc(asset(t.image))+'" alt="" loading="eager">').join('')+'</div></div><div class="pm-meeting-copy"><p class="pm-number">MEETING 01</p><h3>'+esc(data.meeting.title)+'</h3><p>'+esc(data.meeting.intro)+'</p><div class="pm-meeting-tags"><span class="pm-tag">팀별 SWOT 자료</span><span class="pm-tag">공동 액션플랜</span></div><span class="pm-open">회의 내용 보기 '+icon('arrow')+'</span></div></a><p class="pm-archive-note"><span class="pm-note-mark" aria-hidden="true">i</span><span>각 팀이 나눈 SWOT 자료와 회의에서 정한 액션플랜을 한곳에서 다시 볼 수 있어요.</span></p></section></main>'+footer();
    root.querySelector('.pm-meeting-card').addEventListener('click',()=>{archiveScroll=scrollY;});
  }
  function teamPanel(){
    const team = data.meeting.teams[selectedTeam];
    return '<div class="pm-team-panel" id="pm-team-panel" role="tabpanel" aria-labelledby="pm-team-tab-'+selectedTeam+'" tabindex="0"><div class="pm-panel-toolbar"><div class="pm-panel-heading"><h3>'+esc(teamName(team))+'</h3>'+(team.name?'':'<span class="pm-pending">팀 이름 확인 중</span>')+'</div><div class="pm-tools"><button class="pm-tool" id="pm-expand" type="button">'+icon('expand')+'크게 보기</button><a class="pm-tool" href="'+esc(asset(team.original))+'" download="'+esc((team.name||'team')+'-SWOT.png')+'">'+icon('download')+'원본 다운로드</a></div></div><figure class="pm-team-figure"><button type="button" class="pm-image-button" id="pm-open-image" aria-label="'+esc(teamName(team))+' 자료 크게 보기"><img src="'+esc(asset(team.image))+'" alt="'+esc(team.alt)+'" decoding="async"></button><figcaption class="pm-image-caption"><strong>'+esc(teamName(team))+'</strong><span>이미지를 누르면 크게 볼 수 있어요.</span></figcaption></figure></div>';
  }
  function actions(){
    const plan=data.meeting.actionPlan, room=plan.sectorLeaderChat, site=room.siteDevelopment, topic=room.topicTraining;
    return '<section class="pm-actions" aria-labelledby="pm-actions-title"><div class="pm-section-heading"><h2 id="pm-actions-title">함께 정한 액션플랜</h2><p class="pm-action-intro">회의에서 나눈 실행 방향을 그대로 모았습니다.</p></div><div class="pm-action-grid"><article class="pm-action-card"><p class="pm-card-eyebrow">01 · PEOPLE & GROWTH</p><h3>'+esc(plan.managerDevelopment.title)+'</h3><p>다음 매니저로 성장할 두 사람을 함께 지원합니다.</p>'+plan.managerDevelopment.members.map(m=>'<div class="pm-person"><span class="pm-person-initial" aria-hidden="true">'+esc(m.name.slice(-2))+'</span><div><strong>'+esc(m.name)+'</strong><p>'+esc(m.focus)+'</p>'+(m.detail!==m.focus?'<small>'+esc(m.detail)+'</small>':'')+'</div></div>').join('')+'</article><article class="pm-action-card"><p class="pm-card-eyebrow">02 · SECTOR LEADERS</p><h3>'+esc(room.title)+'</h3><p>'+esc(room.purpose)+'</p><div class="pm-invitees"><span class="pm-invitees-label">초대 대상자</span>'+room.invitees.map(n=>'<span class="pm-person-chip">'+esc(n)+'</span>').join('')+'</div><h4 class="pm-subheading">유지 기준</h4><ul class="pm-criteria">'+room.maintenanceCriteria.map(c=>'<li><strong>'+esc(c.label)+'</strong>'+(c.status==='needs-context-confirmation'?'<span class="pm-inline-note">세부 기준 확인 중</span>':'')+'</li>').join('')+'</ul></article><article class="pm-action-card"><p class="pm-card-eyebrow">03 · SITE DEVELOPMENT</p><h3>'+esc(site.title)+'</h3><p>'+esc(site.timing)+', <strong>'+esc(site.channel)+'</strong>에 사이트 개발 계획을 함께 적어 올립니다.</p><ul class="pm-site-types">'+site.siteTypes.map(s=>'<li><span class="pm-site-count">'+esc(s.count)+'곳</span><span>'+esc(s.label)+'</span></li>').join('')+'</ul>'+(site.countStatus==='pending-confirmation'?'<p class="pm-source-note">원문에 적힌 유형별 개수를 보관했습니다.<br>인원별 전체 사이트 개수는 확인 후 반영합니다.</p>':'')+'</article><article class="pm-action-card"><p class="pm-card-eyebrow">04 · TOPIC & TRAINING</p><h3>'+esc(topic.title)+'</h3><span class="pm-frequency">'+esc(topic.frequency)+'</span><ol class="pm-training-steps"><li><span class="pm-step-num" aria-hidden="true">1</span><span>'+esc(topic.firstSpeakers)+'</span></li><li><span class="pm-step-num" aria-hidden="true">2</span><span>'+esc(topic.nextSpeakers)+'</span></li></ol><p class="pm-participation">'+esc(topic.participation)+'</p></article></div></section>';
  }
  function detail(){
    document.title = data.meeting.title+' · Presence Manager';
    root.innerHTML=topbar(true)+'<main><section class="pm-detail-hero" aria-labelledby="pm-meeting-title"><p class="pm-kicker">PRESENCE MANAGER MEETINGS</p><h1 class="pm-heading" id="pm-meeting-title">'+esc(data.meeting.title)+'</h1><p class="pm-intro">'+esc(data.meeting.intro)+'</p><div class="pm-detail-labels"><span>팀별 자료</span><span>공동 액션플랜</span></div></section><section class="pm-content" aria-labelledby="pm-swot-title"><div class="pm-section-heading"><h2 id="pm-swot-title">각 팀 SWOT 분석</h2><p>팀을 선택해 자료를 확인하세요.</p></div><div class="pm-team-tabs" role="tablist" aria-label="팀별 SWOT 자료">'+data.meeting.teams.map((t,i)=>'<button type="button" class="pm-team-tab" id="pm-team-tab-'+i+'" role="tab" aria-selected="'+(i===selectedTeam)+'" aria-controls="pm-team-panel" tabindex="'+(i===selectedTeam?'0':'-1')+'" data-team="'+i+'">'+esc(teamName(t))+'</button>').join('')+'</div><div id="pm-team-container">'+teamPanel()+'</div></section>'+actions()+'</main>'+footer();
    root.querySelectorAll('[data-team]').forEach(b=>{
      b.addEventListener('click',()=>selectTeam(Number(b.dataset.team)));
      b.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();let i=selectedTeam;if(e.key==='Home')i=0;else if(e.key==='End')i=data.meeting.teams.length-1;else i=(i+(e.key==='ArrowRight'?1:-1)+data.meeting.teams.length)%data.meeting.teams.length;selectTeam(i);document.getElementById('pm-team-tab-'+i).focus();}});
    });
    wirePanel();
    const site = data.meeting.actionPlan.sectorLeaderChat.siteDevelopment;
    if(site.perPersonTotal != null){
      const siteCard = root.querySelector('.pm-site-types').closest('.pm-action-card');
      siteCard.querySelector('.pm-source-note')?.remove();
      const total = document.createElement('p');
      total.className = 'pm-site-total';
      total.textContent = '1인당 총 '+site.perPersonTotal+'곳';
      siteCard.append(total);
    }
  }
  function selectTeam(index){
    selectedTeam=index;
    root.querySelectorAll('[data-team]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});
    document.getElementById('pm-team-container').innerHTML=teamPanel();
    wirePanel();
  }
  function wirePanel(){['pm-expand','pm-open-image'].forEach(id=>document.getElementById(id).addEventListener('click',openImage));}
  function openImage(){
    const team=data.meeting.teams[selectedTeam];
    lastDialogFocus=document.activeElement;
    document.getElementById('pm-dialog-title').textContent=teamName(team)+' · SWOT 분석';
    const img=document.getElementById('pm-dialog-image');img.src=asset(team.original);img.alt=team.alt;
    const download=document.getElementById('pm-dialog-download');download.href=asset(team.original);download.download=(team.name||'team')+'-SWOT.png';
    document.getElementById('pm-dialog-open-original').href=asset(team.original);
    document.body.classList.add('pm-dialog-open');dialog.showModal();zoomIndex=0;applyZoom();document.getElementById('pm-dialog-scroll').scrollTo(0,0);document.getElementById('pm-dialog-close').focus();
  }
  function applyZoom(){
    const scroller=document.getElementById('pm-dialog-scroll');
    const padding=parseFloat(getComputedStyle(scroller).paddingLeft)+parseFloat(getComputedStyle(scroller).paddingRight);
    const image=document.getElementById('pm-dialog-image');
    image.style.width=Math.max(1,scroller.clientWidth-padding)*zoomLevels[zoomIndex]+'px';image.style.maxWidth='none';
    document.getElementById('pm-zoom-label').textContent=Math.round(zoomLevels[zoomIndex]*100)+'%';
    document.getElementById('pm-zoom-out').disabled=zoomIndex===0;
    document.getElementById('pm-zoom-in').disabled=zoomIndex===zoomLevels.length-1;
  }
  document.getElementById('pm-zoom-out').addEventListener('click',()=>{zoomIndex=Math.max(0,zoomIndex-1);applyZoom();});
  document.getElementById('pm-zoom-in').addEventListener('click',()=>{zoomIndex=Math.min(zoomLevels.length-1,zoomIndex+1);applyZoom();});
  window.addEventListener('resize',()=>{if(dialog.open)applyZoom();});
  function closeImage(){dialog.close();}
  document.getElementById('pm-dialog-close').addEventListener('click',closeImage);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeImage();}});
  dialog.addEventListener('close',()=>{document.body.classList.remove('pm-dialog-open');if(lastDialogFocus&&lastDialogFocus.isConnected)lastDialogFocus.focus();});
  function route(){
    if(!data)return;
    const inMeeting=location.hash.startsWith('#meeting');
    if(inMeeting){detail();window.scrollTo(0,0);}else{archive();requestAnimationFrame(()=>window.scrollTo(0,archiveScroll));}
  }
  window.addEventListener('hashchange',route);
  async function load(){
    try{const response=await fetch(dataUrl,{credentials:'same-origin',cache:'no-cache'});if(!response.ok)throw new Error('회의 자료 응답 '+response.status);data=await response.json();if(!data.archive||!data.meeting||!data.meeting.teams?.length)throw new Error('회의 자료 형식을 확인해 주세요.');route();}
    catch(error){root.innerHTML='<main class="pm-state"><h1>회의 자료를 불러오지 못했어요</h1><p>연결을 확인한 뒤 다시 불러와 주세요.</p><button class="pm-tool" id="pm-retry" type="button">다시 불러오기</button></main>';document.getElementById('pm-retry').addEventListener('click',load);console.warn('Presence Manager archive:',error.message);}
  }
  load();
})();
