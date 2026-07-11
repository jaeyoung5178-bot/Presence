/* ============================================================
   PRESENCE HUB PATCH — 관리자/팀원 잠금 + 사진 추가 + 다운로드
   (index.html 끝 </body> 직전에 <script src="hub-patch.js"></script>)
   관리자 0001 → ⋯ 전체 메뉴 · 팀원 1004 → 팀원 전용 사진 공간
   2026-07-11 모바일 안정판: 사진 주입 릴 대칭 유지 + 최근 60장 제한 + 재시도
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
  if(menu){
    menu.addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('a,button');
      if(!a||!menu.contains(a))return;
      if(a.classList.contains('join'))return;
      if(a.__hubGated)return;
      if(isAdmin())return;
      e.preventDefault(); e.stopImmediatePropagation();
      if(isTeam()){ alert('이 바로가기는 관리자 전용이에요 · 팀원은 사진 공간만 이용할 수 있어요'); return; }
      var p=prompt('바로가기는 관리자 전용이에요 · 비밀번호를 입력하세요');
      if(p===null)return;
      if(p===PASS){setAdmin(true);try{syncDLState();}catch(_){} a.__hubGated=1;setTimeout(function(){a.click();a.__hubGated=0;},40);}
      else if(p===TPASS){ alert('이 바로가기는 관리자 전용이에요 · 팀원은 사진 공간만 이용할 수 있어요'); }
      else alert('비밀번호가 올바르지 않습니다');
    },true);
  }
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
      var img=new Image(), u=URL.createObjectURL(file);
      img.onload=function(){
        try{URL.revokeObjectURL(u);}catch(e){}
        var M=900, w=img.width, h=img.height, s=Math.min(1, M/Math.max(w,h));
        var c=document.createElement('canvas'); c.width=Math.round(w*s); c.height=Math.round(h*s);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        res({b64:c.toDataURL('image/jpeg',.72), land:c.width>=c.height});
      };
      img.onerror=function(){ try{URL.revokeObjectURL(u);}catch(e){} rej(); };
      img.src=u;
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
          .then(function(res){
            if(!res||!res.ok) throw new Error('upload http '+(res&&res.status));
            done++; msgEl.textContent='압축·업로드 중… '+done+'/'+total;
          });
      });
    }, Promise.resolve()).then(function(){
      msgEl.textContent='완료! 필름에 반영됐습니다 (새로고침 시 모든 기기 표시)';
      capEl.value=''; loadPhotos(true); after&&after();
    }).catch(function(){ msgEl.textContent='업로드 실패 — 네트워크 확인 후 다시 시도해 주세요'; });
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
      var keys=Object.keys(cache).filter(function(k){ return cache[k]&&cache[k].b64; })
        .sort(function(a,b){return (cache[b].t||0)-(cache[a].t||0);});
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
    +'<button class="pdl-btn" id="pdl-del" type="button" style="display:none">🗑 필름에서 빼기</button>'
    +'<button class="pdl-btn" id="pdl-close" type="button">✕ 닫기</button></div>';
  document.body.appendChild(lb);
  var lbImg=lb.querySelector('img'), saveA=$('pdl-save');
  var delBtn=$('pdl-del'), curSrc=null, HIDDEN={};
  var FBH=FB.replace('hub_photos','hub_hidden');
  function h32(x){var h=5381;for(var i=0;i<x.length;i++){h=((h<<5)+h+x.charCodeAt(i))|0;}return (h>>>0).toString(36);}
  function applyHidden(){
    document.querySelectorAll('.frame img').forEach(function(im){
      if(im.closest('#pdl-lb'))return;
      if(HIDDEN[h32(im.src)]){var f=im.closest('.frame'); if(f)f.remove();}
    });
  }
  fetch(FBH+'.json').then(function(r){return r.json();}).then(function(d){HIDDEN=d||{};applyHidden();setInterval(applyHidden,2500);}).catch(function(){});
  delBtn.onclick=function(){
    if(!isAdmin()||!curSrc)return;
    if(!confirm('이 사진을 필름에서 뺄까요? (모든 기기에서 사라져요)'))return;
    var k=h32(curSrc);
    HIDDEN[k]={t:Date.now()};
    fetch(FBH+'/'+k+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:Date.now()})}).catch(function(){});
    fetch(FB+'.json').then(function(r){return r.json();}).then(function(d){
      d=d||{};
      Object.keys(d).forEach(function(key){ if(d[key]&&d[key].b64===curSrc){ fetch(FB+'/'+key+'.json',{method:'DELETE'}); } });
    }).catch(function(){});
    applyHidden(); lb.classList.remove('on');
  };

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
    curSrc=img.src; delBtn.style.display=isAdmin()?'inline-block':'none';
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

  /* ---------- 8) 필름 릴에 사진 주입 — 모바일 안정판 (2026-07-11) ----------
     · 최근 60장만 요청 → 사진이 쌓여도 페이로드 고정, 모바일에서 안 끊김
     · b64 손상 항목 건너뜀 → 깨진 프레임 방지
     · 릴 앞/뒤 절반 '대칭' 유지: 두 번째 절반의 시작점을 원본 상태에서 한 번만
       계산해 두고 그 앞에 몰아넣음. (기존 방식은 한 장 넣을 때마다 중간 위치가
       밀려 릴 루프가 어긋나 빈 구간이 생기고 프레임이 넘어가 보였음)
     · 로딩 실패 시 5초 후 1회 자동 재시도                                   */
  function makeFrame(p, idx){
    var fig=document.createElement('figure');
    fig.className='frame '+(p.land?'land':'port');
    fig.innerHTML='<div class="img"><img decoding="async" loading="lazy" alt=""></div>'+
      '<figcaption><span class="fc-n">'+String(idx).padStart(2,'0')+'</span><span class="fc-l"></span></figcaption>';
    fig.querySelector('img').src=p.b64;
    fig.querySelector('.fc-l').textContent=p.cap||'PRESENCE';
    return fig;
  }
  var _plRetried=false;
  function loadPhotos(force){
    fetch(FB+'.json?orderBy="$key"&limitToLast=60&t='+Date.now()).then(function(r){
      if(!r.ok) throw new Error('http '+r.status);
      return r.json();
    }).then(function(d){
      if(!d) return;
      var keys=Object.keys(d).filter(function(k){
        return d[k]&&typeof d[k].b64==='string'&&d[k].b64.indexOf('data:image')===0;
      }).sort(function(a,b){return (d[a].t||0)-(d[b].t||0);});
      if(!keys.length) return;
      var reels=document.querySelectorAll('.reel');
      if(!reels.length) return;
      /* 이미 주입된 프레임 제거 (중복 방지) */
      document.querySelectorAll('.frame[data-hub]').forEach(function(n){ n.remove(); });
      /* 각 릴의 '두 번째 절반 시작' 지점을 원본 상태에서 한 번만 계산 */
      var mids=[];
      Array.prototype.forEach.call(reels, function(reel){
        var orig=reel.children, half=Math.floor(orig.length/2);
        mids.push(orig[half]||null);
      });
      keys.forEach(function(k,i){
        var ri=i%reels.length, reel=reels[ri];
        var f1=makeFrame(d[k], 92+i); f1.setAttribute('data-hub','1');
        var f2=f1.cloneNode(true);   f2.setAttribute('data-hub','1');
        reel.insertBefore(f1, mids[ri]);  /* 첫 절반의 끝 */
        reel.appendChild(f2);             /* 두 번째 절반의 끝 — 항상 대칭 */
      });
    }).catch(function(){
      if(!_plRetried){ _plRetried=true; setTimeout(function(){ loadPhotos(true); }, 5000); }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ loadPhotos(); });
  else loadPhotos();
})();


/* ═══ 허브 검색 — 토픽·발표자료·리캡·페이지 바로 찾기 ═══ */
(function(){
  if(window.__hubSearch)return; window.__hubSearch=true;
  var css=document.createElement('style');
  css.textContent=
    '#hsBtn{position:fixed;right:18px;bottom:76px;z-index:99998;width:46px;height:46px;border-radius:50%;border:1px solid rgba(150,140,120,.5);cursor:pointer;font-size:18px;line-height:1;background:rgba(22,20,15,.85);color:#efe7d6;box-shadow:0 4px 18px rgba(0,0,0,.4);transition:.25s}'+
    '#hsBtn:hover{transform:scale(1.1);border-color:#38a37a}'+
    '#hsOv{position:fixed;inset:0;z-index:400;background:rgba(8,8,10,.9);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:none;align-items:flex-start;justify-content:center;padding:12vh 5vw 5vh}'+
    '#hsOv.on{display:flex}'+
    '#hsBox{width:100%;max-width:560px}'+
    '#hsKick{font-family:"Courier New",monospace;font-size:10px;letter-spacing:.4em;color:#e8b466;margin-bottom:10px}'+
    '#hsIn{width:100%;background:#16140f;border:1px solid rgba(232,180,102,.45);border-radius:10px;color:#efe7d6;font-size:16px;padding:15px 17px;outline:none;font-family:inherit}'+
    '#hsIn:focus{border-color:#e8b466;box-shadow:0 0 24px rgba(232,180,102,.15)}'+
    '#hsList{margin-top:12px;display:flex;flex-direction:column;gap:7px;max-height:52vh;overflow:auto}'+
    '.hs-it{display:flex;align-items:center;gap:12px;background:rgba(22,20,15,.92);border:1px solid #2a2722;border-radius:10px;padding:12px 14px;cursor:pointer;transition:.2s;text-decoration:none;color:#efe7d6}'+
    '.hs-it:hover,.hs-it.sel{border-color:#38a37a;transform:translateX(3px)}'+
    '.hs-emo{font-size:19px;flex:none}'+
    '.hs-t{flex:1;font-size:14.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.hs-tag{font-family:"Courier New",monospace;font-size:8.5px;letter-spacing:.22em;color:#9a7a44;border:1px solid #2a2722;border-radius:10px;padding:3px 8px;flex:none}'+
    '.hs-none{color:#6f6a60;font-family:"Courier New",monospace;font-size:12px;letter-spacing:.1em;text-align:center;padding:22px 0}';
  document.head.appendChild(css);

  var btn=document.createElement('button'); btn.id='hsBtn'; btn.title='검색 — 토픽·발표자료 바로 찾기'; btn.textContent='🔍';
  document.body.appendChild(btn);
  function hsAdmin(){try{return localStorage.getItem('presence_hub_admin')==='1';}catch(e){return false;}}
  btn.style.display=hsAdmin()?'':'none';
  setInterval(function(){var on=hsAdmin();btn.style.display=on?'':'none';if(!on){var o=document.getElementById('hsOv');if(o)o.classList.remove('on');}},1200);
  var ov=document.createElement('div'); ov.id='hsOv';
  ov.innerHTML='<div id="hsBox"><div id="hsKick">SEARCH — 토픽 · 발표자료 · 페이지</div>'+
    '<input id="hsIn" placeholder="검색어 입력 (예: 노제로, 오브젝션, 리캡, 메모…)" autocomplete="off">'+
    '<div id="hsList"><div class="hs-none">입력하면 바로 찾아드려요 🎬</div></div></div>';
  document.body.appendChild(ov);
  var IN=document.getElementById('hsIn'), LIST=document.getElementById('hsList');

  var CORE=[
    {t:'메모 · 기록노트 · 액션플랜',u:'memo.html',e:'📝',g:'PAGE',k:'메모 노트 일기 저널 액션플랜 플랜 할일 계획'},
    {t:'액션플랜 보드',u:'memo.html#plan',e:'✅',g:'PAGE',k:'액션 플랜 계획 할일 투두'},
    {t:'개인 세일즈 기록 (필드 레코드)',u:'presence-record.html',e:'📊',g:'PAGE',k:'레코드 기록 세일즈 노제로 후원자 리젝'},
    {t:'팀 리캡 아카이브',u:'recaps.html',e:'🎞️',g:'PAGE',k:'리캡 아카이브 발표 월간'},
    {t:'재영의 서재',u:'library.html',e:'📚',g:'PAGE',k:'서재 책 라이브러리 독서'},
    {t:'PRESENCE 워크북',u:'https://presence.co.kr',e:'🌳',g:'LINK',k:'워크북 팀 먹이 컴페티션'},
    {t:'맛도사 · MATDOSA',u:'https://jaeyoung5178-bot.github.io/matdosa.github.io/',e:'🍜',g:'LINK',k:'맛도사 맛집'},
    {t:'위페어 지도 (WePair Map)',u:'https://jaeyoung5178-bot.github.io/wepair-map/',e:'🚗',g:'LINK',k:'위페어 wepair 지도 맵 공업사 정착 필드 동선 테스터'},
    {t:'섹터리더 스탠다드 가이드 (SSG)',u:'https://jaeyoung5178-bot.github.io/Pesentation/',e:'🧭',g:'LINK',k:'ssg 섹터리더 스탠다드 가이드 sector leader standard guide 리더 육성 리더십 팀 키우기'},
    {t:'옥스팜 피치카드',u:'https://jaeyoung5178-bot.github.io/oxfam-pitch/',e:'🎤',g:'PITCH',k:'옥스팜 피치 피치카드 oxfam pitch 세일즈 클로징 스크립트 후원'},
    {t:'위페어 피치카드',u:'https://jaeyoung5178-bot.github.io/wepair-pitch/',e:'🎤',g:'PITCH',k:'위페어 피치 피치카드 wepair pitch 세일즈 공업사 스크립트'}
  ];
  var ALIAS={'topic-grasp':'그랩 grasp 잡기 스타핑 스타퍼','topic-objection':'오브젝션 거절 반론 objection','topic-training':'트레이닝 교육 training','topic-howwerun':'운영 팀운영 how we run','topic-nozero200':'노제로 200 nozero','topic-nozero300':'노제로 300 nozero','topic-onboarding':'온보딩 신입 onboarding','topic-steady':'꾸준 스테디 steady 유지','recap-2026-04':'리캡 4월 recap'};
  var topics=null, recaps=null, loading=false;

  function nrm(x){return (x||'').toLowerCase().replace(/\s+/g,'');}
  function loadIdx(){
    if(loading)return; loading=true;
    try{
      var c=localStorage.getItem('hs_idx_v2');
      if(c){var o=JSON.parse(c); if(Date.now()-o.t<86400000){topics=o.topics;recaps=o.recaps;render(IN.value);return;}}
    }catch(e){}
    Promise.all([
      fetch('https://api.github.com/repos/jaeyoung5178-bot/Presence/contents/'+encodeURIComponent('토픽')).then(function(r){return r.json();}).catch(function(){return [];}),
      fetch('https://api.github.com/repos/jaeyoung5178-bot/Presence/contents/'+encodeURIComponent('리캡')).then(function(r){return r.json();}).catch(function(){return [];})
    ]).then(function(res){
      var tfiles=(Array.isArray(res[0])?res[0]:[]).filter(function(f){return f.type==='file'&&/\.html?$/i.test(f.name);});
      var rfiles=(Array.isArray(res[1])?res[1]:[]).filter(function(f){return f.type==='file'&&/\.(pdf|pptx?)$/i.test(f.name);});
      recaps=rfiles.map(function(f){return {t:f.name.replace(/\.[^.]+$/,''),u:f.download_url,e:'🎬',g:'RECAP',k:'리캡 recap 발표'};});
      return Promise.all(tfiles.map(function(f){
        return fetch('토픽/'+f.name).then(function(r){return r.text();}).then(function(html){
          var m=/<title>([^<]*)<\/title>/i.exec(html);
          var base=f.name.replace(/\.html?$/i,'');
          var body=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/gi,' ').replace(/\s+/g,' ').trim().slice(0,1500);
          return {t:(m?m[1].trim():base),u:'토픽/'+f.name,e:'🎙️',g:'TOPIC',k:(ALIAS[base]||'')+' 토픽 발표 '+body};
        }).catch(function(){return null;});
      }));
    }).then(function(list){
      topics=(list||[]).filter(Boolean);
      try{localStorage.setItem('hs_idx_v2',JSON.stringify({t:Date.now(),topics:topics,recaps:recaps}));}catch(e){}
      render(IN.value);
    }).catch(function(){topics=topics||[];recaps=recaps||[];render(IN.value);});
  }

  function items(){ return CORE.concat(topics||[],recaps||[]); }
  function score(it,q){
    var hay=nrm(it.t+' '+(it.k||''));
    if(!q)return 1;
    var i=hay.indexOf(q);
    if(i<0)return 0;
    return i===0?100:(50-Math.min(40,i));
  }
  function render(qraw){
    var q=nrm(qraw);
    var rs=items().map(function(it){return [score(it,q),it];}).filter(function(x){return x[0]>0;});
    rs.sort(function(a,b){return b[0]-a[0];});
    rs=rs.slice(0,10);
    LIST.innerHTML='';
    if(!rs.length){LIST.innerHTML='<div class="hs-none">'+(topics===null?'토픽 목록 불러오는 중…':'검색 결과가 없어요 — 다른 말로 해볼까요?')+'</div>';return;}
    rs.forEach(function(x,i){
      var it=x[1];
      var a=document.createElement('a'); a.className='hs-it'+(i===0?' sel':''); a.href=it.u;
      if(it.g==='LINK'||it.g==='RECAP'||it.g==='PITCH'){a.target='_blank';a.rel='noopener';}
      a.innerHTML='<span class="hs-emo">'+it.e+'</span><span class="hs-t"></span><span class="hs-tag">'+it.g+'</span>';
      a.querySelector('.hs-t').textContent=it.t;
      LIST.appendChild(a);
    });
  }
  function open(){ ov.classList.add('on'); IN.value=''; render(''); loadIdx(); setTimeout(function(){IN.focus();},60); }
  function close(){ ov.classList.remove('on'); }
  btn.onclick=open;
  ov.addEventListener('click',function(e){ if(e.target===ov)close(); });
  IN.addEventListener('input',function(){render(IN.value);});
  IN.addEventListener('keydown',function(e){
    if(e.key==='Escape')close();
    if(e.key==='Enter'){var f=LIST.querySelector('.hs-it'); if(f)f.click();}
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')close();
    if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();open();}
  });
})();

/* REEL SEAM FIX v2 — 원래 방식 보존형 (추가만, 제거/재배열 없음)
   원리: 줄 전체를 통째로 1벌 복제해 붙이면 translateX(-50%) 루프 지점이
   항상 "복제 경계"가 되어, 내부 구성이 어떻든 이음새가 수학적으로 매끈해진다.
   화면 폭보다 짧으면 다시 2배(전체 복제)로 늘려 빈 구간도 차단. */
(function () {
  'use strict';
  function padReel(reel) {
    if (reel.getAttribute('data-seamfix')) return;
    var kids = Array.prototype.slice.call(reel.children);
    if (!kids.length || kids.length > 400) return;
    var W = Math.max(window.innerWidth, 320);
    var guard = 0;
    /* 전체를 통째로 복제(2배) — 폭이 화면의 2.2배 될 때까지, 최대 3회 */
    while (reel.scrollWidth < W * 2.2 && guard < 3) {
      var frag = document.createDocumentFragment();
      Array.prototype.slice.call(reel.children).forEach(function (f) { frag.appendChild(f.cloneNode(true)); });
      reel.appendChild(frag);
      guard++;
    }
    if (!guard) { /* 이미 충분히 길어도 이음새 보정을 위해 1회 복제 */
      var frag2 = document.createDocumentFragment();
      kids.forEach(function (f) { frag2.appendChild(f.cloneNode(true)); });
      reel.appendChild(frag2);
    }
    reel.setAttribute('data-seamfix', '1');
  }
  function run() {
    document.querySelectorAll('.reel').forEach(function (r) { try { padReel(r); } catch (e) {} });
  }
  /* 숨김/추가 패치가 끝난 뒤 시점에 1회 (멱등: data-seamfix로 재실행 방지) */
  window.addEventListener('load', function () { setTimeout(run, 2500); });
  setTimeout(run, 5000);
})();
