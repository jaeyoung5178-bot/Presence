(function(){
  'use strict';
  var STORE='fcos_personal_launch_v2',deferred=null;
  function valid(v){return !!(v&&v.u&&v.n&&v.k);}
  function fromQuery(){var q=new URLSearchParams(location.search),v={u:q.get('u')||'',n:q.get('n')||'',k:q.get('k')||''};return valid(v)?v:null;}
  function read(){try{return JSON.parse(localStorage.getItem(STORE)||'null');}catch(e){return null;}}
  function save(v){if(!valid(v))return;try{localStorage.setItem(STORE,JSON.stringify(Object.assign({},v,{savedAt:Date.now()})));localStorage.setItem('fcos_personal_launch',personalUrl(v));}catch(e){}}
  function personalUrl(v){var u=new URL('./index.html',location.href);u.searchParams.set('u',v.u);u.searchParams.set('n',v.n);u.searchParams.set('k',v.k);return u.href;}
  function connected(){try{return JSON.parse(localStorage.getItem('fcos_hub_identity')||'null');}catch(e){return null;}}
  var identity=fromQuery();
  if(identity)save(identity);
  else{
    identity=read();
    /* ★ 2026-07-21 계정 전환이 되돌아가던 원인.
       예전에는 저장된 개인 링크(u·n·k)를 무조건 주소에 다시 넣었다.
       관리자가 피커에서 다른 팀원을 고른 뒤 새로고침되면 주소에는 여전히
       관리자 링크가 살아나고 → script.js 가 "다른 사람으로 전환하시겠습니까"
       비밀번호 창을 띄워 → 결국 임재영으로 되돌아갔다.
       지금 연결된 계정과 어긋나는 옛 링크는 무시한다. */
    var cur=connected();
    if(valid(identity)&&cur&&cur.uid&&identity.u!==cur.uid)identity=null;
    if(valid(identity)){var restored=new URL(personalUrl(identity));history.replaceState(null,'',restored.pathname+restored.search);}
  }
  var manifestHref='';
  function manifest(){if(!valid(identity))return;var m={name:(identity.n||'나')+'의 Field Callback OS',short_name:(identity.n||'나')+' 콜백싯',description:'내 전용 Presence 콜백싯',id:'./index.html?u='+encodeURIComponent(identity.u),start_url:'./index.html?u='+encodeURIComponent(identity.u)+'&n='+encodeURIComponent(identity.n)+'&k='+encodeURIComponent(identity.k),scope:'./',display:'standalone',background_color:'#F7F8FA',theme_color:'#2563EB',icons:[{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]};var blob=new Blob([JSON.stringify(m)],{type:'application/manifest+json'}),href=URL.createObjectURL(blob),link=document.querySelector('link[rel="manifest"]');if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link);}if(manifestHref)URL.revokeObjectURL(manifestHref);manifestHref=href;link.href=href;}
  manifest();
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;draw();});
  window.addEventListener('appinstalled',function(){deferred=null;try{localStorage.setItem('fcos_installed_'+(identity&&identity.u),'1');}catch(e){}draw();});
  function standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
  function copy(){if(!valid(identity))return Promise.reject();var url=personalUrl(identity);if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(url);var t=document.createElement('textarea');t.value=url;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();return Promise.resolve();}
  function guide(){var old=document.getElementById('personalInstallGuide');if(old)old.remove();var d=document.createElement('div');d.id='personalInstallGuide';d.className='personal-install-guide';d.innerHTML='<div class="pig-card"><button class="pig-x" aria-label="닫기">×</button><div class="pig-ic">📲</div><h3>내 콜백싯을 홈 화면에 고정</h3><p><b>'+((identity&&identity.n)||'나')+'님 전용 연결</b>이 포함된 주소로 설치됩니다. 다음부터 관리자 연결 없이 바로 내 데이터가 동기화돼요.</p><ol><li>iPhone·iPad: 브라우저 <b>공유</b> → <b>홈 화면에 추가</b></li><li>Android·PC: 아래 <b>앱 설치</b> 또는 브라우저 메뉴 → 설치</li></ol><div class="pig-actions"><button id="pigInstall">앱 설치</button><button id="pigCopy">개인 링크 복사</button></div></div>';document.body.appendChild(d);d.querySelector('.pig-x').onclick=function(){d.remove();};d.querySelector('#pigCopy').onclick=function(){copy().then(function(){if(window.toast)toast('개인 링크를 복사했어요');});};d.querySelector('#pigInstall').onclick=async function(){if(deferred){deferred.prompt();try{await deferred.userChoice;}catch(e){}deferred=null;d.remove();}else{copy().then(function(){if(window.toast)toast('개인 링크 복사 ✓ · 공유 메뉴에서 홈 화면에 추가해 주세요');});}};}
  function draw(){var meta=document.querySelector('.header-meta');if(!meta||document.getElementById('personalInstallBtn')||!valid(identity)||standalone())return;var b=document.createElement('button');b.id='personalInstallBtn';b.className='personal-install-btn';b.innerHTML='<span>＋</span> 홈에 설치';b.onclick=guide;meta.appendChild(b);}
  var css=document.createElement('style');css.textContent='.personal-install-btn{border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#334155;padding:8px 12px;font:800 11px/1 inherit;cursor:pointer;box-shadow:0 5px 16px rgba(15,23,42,.08)}.personal-install-btn span{color:#2563eb}.personal-install-guide{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.62);backdrop-filter:blur(10px)}.pig-card{position:relative;width:min(440px,100%);border-radius:24px;background:#fff;padding:27px;box-shadow:0 30px 90px rgba(15,23,42,.36);color:#1e293b}.pig-x{position:absolute;right:14px;top:12px;border:0;background:#f1f5f9;border-radius:50%;width:34px;height:34px;font-size:20px}.pig-ic{font-size:34px}.pig-card h3{margin:10px 0 8px;font-size:21px}.pig-card p,.pig-card li{font-size:13px;line-height:1.65;color:#64748b}.pig-card ol{padding-left:20px}.pig-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px}.pig-actions button{border:0;border-radius:13px;padding:13px 10px;font-weight:900}.pig-actions button:first-child{background:#2563eb;color:#fff}.pig-actions button:last-child{background:#eff6ff;color:#1d4ed8}@media(max-width:520px){.personal-install-btn{padding:7px 9px;font-size:10px}.pig-actions{grid-template-columns:1fr}}';document.head.appendChild(css);
  function refresh(v){if(!valid(v))return;identity={u:v.u,n:v.n,k:v.k};save(identity);manifest();var b=document.getElementById('personalInstallBtn');if(b)b.remove();draw();}
  window.FcosPersonalInstall={read:read,url:function(){return valid(identity)?personalUrl(identity):'';},guide:guide,copy:copy,refresh:refresh};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',draw);else draw();setTimeout(draw,900);
})();
