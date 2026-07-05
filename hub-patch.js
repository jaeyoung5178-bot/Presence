/* ============================================================
   PRESENCE HUB PATCH — 관리자/팀원 잠금 + 사진 추가 + 다운로드
   (index.html 끝 </body> 직전에 <script src="hub-patch.js"></script>)
   관리자 0001 → ⋯ 전체 메뉴 · 팀원 1004 → 팀원 전용 사진 공간
   ============================================================ */
(function(){
  'use strict';
  var FB    = 'https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app/hub_photos';
  var PASS  = '0001';                    // 관리자 비밀번호
  var TPASS = '1004';                    // 팀원 비밀번호
  var KEY   = 'presence_hub_admin';      // localStorage 관리자 플래그
  var TKEY  = 'presence_hub_team';       // localStorage 팀원 플래그

  function isAdmin(){ try{ return localStorage.getItem(KEY)==='1'; }catch(e){ return false; } }
  function setAdmin(v){ try{ v?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY); }catch(e){} }
  function isTeam(){ try{ return localStorage.getItem(TKEY)==='1'; }catch(e){ return false; } }
  function setTeam(v){ try{ v?localStorage.setItem(TKEY,'1'):localStorage.removeItem(TKEY); }catch(e){} }
  function canDL(){ return isAdmin()||isTeam(); }

  /* ---------- 1) ⋯ 버튼 잠금 — 관리자는 메뉴, 팀원은 팀 공간 ---------- */
  var moreBtn = document.getElementById('moreBtn');
  if(moreBtn){
    moreBtn.addEventListener('click', function(e){
      if(isAdmin()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if(isTeam()){ openTeam(); return; }
      var p = prompt('비밀번호를 입력하세요');
      if(p===null) return;
      if(p===PASS){ setAdmin(true); setTimeout(function(){ moreBtn.click(); },50); }
      else if(p===TPASS){ setTeam(true); syncDLState(); openTeam(); }
      else alert('비밀번호가 올바르지 않습니다');
    }, true);
  }

  /* ---------- 2) 메뉴에 관리자 항목 추가 ---------- */
  var menu = document.getElementById('menu');
  function addMenuItem(tag, label, fn){
    if(!menu) return;
    var b = document.createElement('button');
    b.innerHTML = '<span class="m-tag">'+tag+'</span>'+label;
    b.addEventListener('click', fn);
    menu.appendChild(b);
  }
  addMenuItem('PHOTO','📸 필름 사진 추가', openPanel);
  addMenuItem('TEAM','👥 팀원 사진 공간', openTeam);
  addMenuItem('LOCK','🔒 관리자 잠금', function(){
    setAdmin(false); setTeam(false); syncDLState();
    alert('잠금 완료 — 다음에 ⋯ 누르면 비밀번호를 다시 묻습니다');
  });

  /* ---------- 3) 패널 공통 스타일 ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.hp-wrap{position:fixed;inset:0;z-index:200;background:rgba(10,10,12,.94);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:none;flex-direction:column;align-items:center;overflow:auto;padding:6vh 5vw;}'+
    '.hp-wrap.open{display:flex;}'+
    '.hp-box{width:100%;max-width:640px;}'+
    '.hp-title{font-family:"Courier New",monospace;font-size:11px;letter-spacing:.4em;color:#e8b466;margin-bottom:18px;}'+
    '.hp-drop{border:1px dashed #9a7a44;border-radius:8px;padding:26px;text-align:center;color:#efe7d6;cursor:pointer;font-size:14px;transition:.25s;background:rgba(22,20,15,.8);}'+
    '.hp-drop:hover{border-color:#e8b466;background:rgba(232,180,102,.06);}'+
    '.hp-cap{width:100%;margin-top:12px;background:#16140f;border:1px solid #2a2722;border-radius:6px;color:#efe7d6;padding:11px 13px;font-family:inherit;font-size:14px;}'+
    '.hp-cap:focus{outline:none;border-color:#38a37a;}'+
    '.hp-bar{display:flex;gap:10px;margin-top:12px;align-items:center;flex-wrap:wrap;}'+
    '.hp-up{background:#38a37a;color:#0d0d0f;border:none;border-radius:6px;padding:11px 24px;font-family:"Courier New",monospace;font-size:12px;letter-spacing:.12em;cursor:pointer;}'+
    '.hp-x{background:none;border:1px solid #2a2722;color:#6f6a60;border-radius:6px;padding:11px 18px;font-family:"Courier New",monospace;font-size:12px;cursor:pointer;}'+
    '.hp-x:hover{color:#efe7d6;border-color:#9a7a44;}'+
    '.hp-msg{font-family:"Courier New",monospace;font-size:11px;color:#38a37a;min-height:1em;}'+
    '.hp-prev{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}'+
    '.hp-prev img{height:74px;border-radius:3px;border:1px solid #2a2722;}'+
    '.hp-sect{font-family:"Courier New",monospace;font-size:10px;letter-spacing:.3em;color:#9a7a44;margin:26px 0 10px;}'+
    '.hp-list{display:flex;gap:10px;flex-wrap:wrap;}'+
    '.hp-item{position:relative;}'+
    '.hp-item img{height:86px;border-radius:3px;border:1px solid #2a2722;display:block;}'+
    '.hp-item button{position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:50%;border:none;background:#c05b4d;color:#fff;font-size:11px;cursor:pointer;line-height:1;}'+
    'html.pdl-on .frame img{cursor:zoom-in;}'+
    '#pdl-lb{position:fixed;inset:0;z-index:300;background:rgba(8,8,10,.94);display:none;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:4vw;}'+
    '#pdl-lb.on{display:flex;}'+
    '#pdl-lb img{max-width:92vw;max-height:74vh;border:5px solid #fff;box-shadow:0 24px 90px rgba(0,0,0,.8);border-radius:2px;}'+
    '#pdl-bar{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}'+
    '.pdl-btn{font-family:"Courier New",monospace;font-size:12px;letter-spacing:.18em;color:#efe7d6;background:rgba(22,20,15,.9);border:1px solid rgba(232,180,102,.5);border-radius:22px;padding:11px 20px;cursor:pointer;text-decoration:none;transition:.25s;display:inline-block;}'+
    '.pdl-btn:hover{color:#fff;border-color:#38a37a;}'+
    '.pdl-btn.main{background:linear-gradient(160deg,#3fb98a,#2b8a66);color:#0d0d0f;border-color:transparent;font-weight:700;}';
  document.head.appendChild(css);

  function $(id){ return document.getElementById(id); }

  /* ---------- 4) 관리자 사진 패널 ---------- */
  var panel = document.createElement('div');
  panel.className='hp-wrap';
  panel.innerHTML =
    '<div class="hp-box">'+
      '<div class="hp-title">ADMIN — 필름 사진 추가</div>'+
      '<div class="hp-drop" id="hpDrop">탭해서 사진 선택 (여러 장 가능)<br><span style="font-size:11px;color:#6f6a60">자동 압축 후 팀 DB에 저장 — 모든 기기 필름에 반영</span></div>'+
      '<input type="file" id="hpFile" accept="image/*" multiple style="display:none">'+
      '<input class="hp-cap" id="hpCap" placeholder="캡션 (예: JULY 2026 · 부평 부스) — 비우면 자동">'+
      '<div class="hp-prev" id="hpPrev"></div>'+
      '<div class="hp-bar"><button class="hp-up" id="hpUp">필름에 올리기</button>'+
      '<button class="hp-x" id="hpZip">📦 사진 전체 저장</button>'+
      '<button class="hp-x" id="hpClose">닫기</button><span class="hp-msg" id="hpMsg"></span></div>'+
      '<div class="hp-sect">추가된 사진 (필름 반영분)</div>'+
      '<div class="hp-list" id="hpList"><span style="color:#6f6a60;font-size:12px">불러오는 중…</span></div>'+
    '</div>';
  document.body.appendChild(panel);

  var picked = [];
  function openPanel(){ panel.classList.add('open'); drawList(); }
  $('hpClose').onclick = function(){ panel.classList.remove('open'); };
  $('hpZip').onclick   = function(){ zipAll($('hpMsg')); };
  $('hpDrop').onclick  = function(){ $('hpFile').click(); };
  $('hpFile').onchange = function(){
    picked = Array.prototype.slice.call(this.files);
    $('hpPrev').innerHTML='';
    picked.forEach(function(f){
      var img=document.createElement('img');
      img.src=URL.createObjectURL(f); $('hpPrev').appendChild(img);
    });
  };

  function compress(file){
    return new Promise(function(res,rej){
      var img=new Image();
      img.onload=function(){
        var M=900, w=img.width, h=img.height, s=Math.min(1, M/Math.max(w,h));
        var c=document.createElement('canvas'); c.width=Math.round(w*s); c.height=Math.round(h*s);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        res({b64:c.toDataURL('image/jpeg',.72), land:c.width>=c.height});
      };
      img.onerror=rej; img.src=URL.createObjectURL(file);
    });
  }
  function autoCap(){
    var M=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    var d=new Date(); return M[d.getMonth()]+' '+d.getFullYear();
  }
  function uploadFiles(files, capEl, msgEl, after){
    if(!files.length){ msgEl.textContent='사진을 먼저 선택해 주세요'; return; }
    var cap=capEl.value.trim()||autoCap(), done=0, total=files.length;
    msgEl.textContent='압축·업로드 중… 0/'+total;
    files.reduce(function(p,f){
      return p.then(function(){ return compress(f); }).then(function(r){
        return fetch(FB+'.json',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({b64:r.b64,land:r.land,cap:cap,t:Date.now()})})
          .then(function(){ done++; msgEl.textContent='압축·업로드 중… '+done+'/'+total; });
      });
    }, Promise.resolve()).then(function(){
      msgEl.textContent='완료! 필름에 반영됐습니다 (새로고침 시 모든 기기 표시)';
      capEl.value=''; loadPhotos(true); after&&after();
    }).catch(function(){ msgEl.textContent='업로드 실패 — 네트워크 확인'; });
  }

  $('hpUp').onclick = function(){
    uploadFiles(picked, $('hpCap'), $('hpMsg'), function(){
      picked=[]; $('hpPrev').innerHTML=''; $('hpFile').value=''; drawList();
    });
  };

  var cache={};
  function drawList(){
    fetch(FB+'.json?t='+Date.now()).then(function(r){return r.json();}).then(function(d){
      cache=d||{};
      var keys=Object.keys(cache).sort(function(a,b){return (cache[b].t||0)-(cache[a].t||0);});
      var L=$('hpList'); L.innerHTML= keys.length?'':'<span style="color:#6f6a60;font-size:12px">아직 추가된 사진이 없습니다</span>';
      keys.forEach(function(k){
        var it=document.createElement('div'); it.className='hp-item';
        var im=document.createElement('img'); im.src=cache[k].b64;
        var x=document.createElement('button'); x.textContent='✕';
        x.onclick=function(){ if(!confirm('필름에서 이 사진을 뺄까요?'))return;
          fetch(FB+'/'+k+'.json',{method:'DELETE'}).then(function(){ drawList(); }); };
        it.appendChild(im); it.appendChild(x); L.appendChild(it);
      });
    });
  }

  /* ---------- 5) 팀원 전용 사진 공간 (비번 1004) ---------- */
  var tpanel = document.createElement('div');
  tpanel.className='hp-wrap';
  tpanel.innerHTML =
    '<div class="hp-box">'+
      '<div class="hp-title">TEAM — 프레젠스 필름 사진 공간</div>'+
      '<div class="hp-drop" id="tpDrop">탭해서 사진 선택 (여러 장 가능)<br><span style="font-size:11px;color:#6f6a60">우리 팀의 순간을 필름에 올려요 — 자동 압축 후 모든 기기에 반영</span></div>'+
      '<input type="file" id="tpFile" accept="image/*" multiple style="display:none">'+
      '<input class="hp-cap" id="tpCap" placeholder="캡션 (예: JULY 2026 · 부평 부스) — 비우면 자동">'+
      '<div class="hp-prev" id="tpPrev"></div>'+
      '<div class="hp-bar"><button class="hp-up" id="tpUp">필름에 올리기</button>'+
      '<button class="hp-x" id="tpZip">📦 사진 전체 저장</button>'+
      '<button class="hp-x" id="tpLock">🔒 잠그기</button>'+
      '<button class="hp-x" id="tpClose">닫기</button><span class="hp-msg" id="tpMsg"></span></div>'+
      '<div class="hp-sect">TIP — 인증된 상태에선 필름의 사진을 눌러 한 장씩 저장할 수 있어요</div>'+
    '</div>';
  document.body.appendChild(tpanel);

  var tpicked=[];
  function openTeam(){
    if(!canDL()){ return; }
    tpanel.classList.add('open');
  }
  $('tpClose').onclick=function(){ tpanel.classList.remove('open'); };
  $('tpLock').onclick=function(){ setTeam(false); tpanel.classList.remove('open'); syncDLState();
    alert('잠금 완료 — 다음에 ⋯ 누르면 비밀번호를 다시 묻습니다'); };
  $('tpZip').onclick=function(){ zipAll($('tpMsg')); };
  $('tpDrop').onclick=function(){ $('tpFile').click(); };
  $('tpFile').onchange=function(){
    tpicked=Array.prototype.slice.call(this.files);
    $('tpPrev').innerHTML='';
    tpicked.forEach(function(f){
      var img=document.createElement('img');
      img.src=URL.createObjectURL(f); $('tpPrev').appendChild(img);
    });
  };
  $('tpUp').onclick=function(){
    uploadFiles(tpicked, $('tpCap'), $('tpMsg'), function(){
      tpicked=[]; $('tpPrev').innerHTML=''; $('tpFile').value='';
    });
  };

  /* ---------- 6) 사진 라이트박스 — 인증된 사람만 다운로드 ---------- */
  var lb=document.createElement('div'); lb.id='pdl-lb';
  lb.innerHTML='<img alt="presence photo"><div id="pdl-bar">'
    +'<a class="pdl-btn main" id="pdl-save" download>⬇ 이 사진 저장</a>'
    +'<button class="pdl-btn" id="pdl-close" type="button">✕ 닫기</button></div>';
  document.body.appendChild(lb);
  var lbImg=lb.querySelector('img'), saveA=$('pdl-save');

  function stamp(){ var d=new Date(); return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); }
  function extOf(src){ var m=/^data:image\/(\w+)/.exec(src); var e=m?m[1]:'jpeg'; return e==='jpeg'?'jpg':e; }
  function allImgs(){
    var seen=[],out=[];
    document.querySelectorAll('.frame img').forEach(function(im){
      if(im.closest('#pdl-lb'))return;
      if(seen.indexOf(im.src)===-1){ seen.push(im.src); out.push(im.src); }
    });
    return out;
  }
  function syncDLState(){ document.documentElement.classList.toggle('pdl-on', canDL()); }
  syncDLState(); setInterval(syncDLState, 2000);

  document.addEventListener('click', function(e){
    var img=e.target;
    if(!(img&&img.tagName==='IMG'&&img.closest('.frame')))return;
    if(img.closest('#pdl-lb'))return;
    if(!canDL())return;
    e.preventDefault(); e.stopPropagation();
    lbImg.src=img.src;
    var idx=allImgs().indexOf(img.src);
    saveA.href=img.src;
    saveA.setAttribute('download','presence-'+stamp()+'-'+String((idx<0?0:idx)+1).padStart(3,'0')+'.'+extOf(img.src));
    lb.classList.add('on');
  }, true);
  lb.addEventListener('click', function(e){ if(e.target===lb) lb.classList.remove('on'); });
  $('pdl-close').onclick=function(){ lb.classList.remove('on'); };
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') lb.classList.remove('on'); });

  /* ---------- 7) 전체 저장 (ZIP) ---------- */
  function loadJSZip(){
    return new Promise(function(res,rej){
      if(window.JSZip)return res(window.JSZip);
      var s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload=function(){ res(window.JSZip); }; s.onerror=rej;
      document.head.appendChild(s);
    });
  }
  function b64ToU8(b64){ var bin=atob(b64); var u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i); return u; }
  var zipBusy=false;
  function zipAll(msgEl){
    if(zipBusy)return; if(!canDL())return;
    zipBusy=true;
    var srcs=allImgs();
    msgEl.textContent='사진 모으는 중… ('+srcs.length+'장)';
    loadJSZip().then(function(JSZip){
      var zip=new JSZip(); var n=0;
      var jobs=srcs.map(function(src,i){
        var name='presence-'+String(i+1).padStart(3,'0');
        if(src.indexOf('data:')===0){
          var m=/^data:image\/(\w+);base64,(.*)$/.exec(src);
          if(m){ zip.file(name+'.'+(m[1]==='jpeg'?'jpg':m[1]), b64ToU8(m[2])); n++; }
          return Promise.resolve();
        }
        return fetch(src).then(function(r){return r.blob();}).then(function(b){
          var ext=((b.type.split('/')[1])||'jpg').replace('jpeg','jpg');
          zip.file(name+'.'+ext,b); n++;
        }).catch(function(){});
      });
      return Promise.all(jobs).then(function(){
        msgEl.textContent='압축 중… ('+n+'장)';
        return zip.generateAsync({type:'blob'});
      });
    }).then(function(blob){
      var u=URL.createObjectURL(blob);
      var l=document.createElement('a');
      l.href=u; l.download='presence-photos-'+stamp()+'.zip';
      document.body.appendChild(l); l.click(); l.remove();
      setTimeout(function(){ URL.revokeObjectURL(u); },60000);
      msgEl.textContent='저장 완료 ✓ ('+Math.round(blob.size/1048576*10)/10+'MB)';
      zipBusy=false;
    }).catch(function(){
      msgEl.textContent='전체 저장 실패 — 다시 시도해 주세요';
      zipBusy=false;
    });
  }

  /* ---------- 8) 필름 릴에 사진 주입 ---------- */
  function makeFrame(p, idx){
    var fig=document.createElement('figure');
    fig.className='frame '+(p.land?'land':'port');
    fig.innerHTML='<div class="img"><img decoding="async" alt=""></div>'+
      '<figcaption><span class="fc-n">'+String(idx).padStart(2,'0')+'</span><span class="fc-l"></span></figcaption>';
    fig.querySelector('img').src=p.b64;
    fig.querySelector('.fc-l').textContent=p.cap||'PRESENCE';
    return fig;
  }
  function loadPhotos(force){
    fetch(FB+'.json?t='+(force?Date.now():'0')).then(function(r){return r.json();}).then(function(d){
      if(!d) return;
      var keys=Object.keys(d).sort(function(a,b){return (d[a].t||0)-(d[b].t||0);});
      if(!keys.length) return;
      var reels=document.querySelectorAll('.reel');
      if(!reels.length) return;
      document.querySelectorAll('.frame[data-hub]').forEach(function(n){ n.remove(); });
      keys.forEach(function(k,i){
        var reel=reels[i%reels.length];
        var kids=reel.children, half=Math.floor(kids.length/2);
        var f1=makeFrame(d[k], 92+i); f1.setAttribute('data-hub','1');
        var f2=f1.cloneNode(true);   f2.setAttribute('data-hub','1');
        reel.insertBefore(f1, kids[half]||null);
        reel.appendChild(f2);
      });
    }).catch(function(){});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ loadPhotos(); });
  else loadPhotos();
})();
