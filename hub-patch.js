/* ============================================================
   PRESENCE HUB PATCH — 관리자 잠금 + 사진 추가 → 필름 릴 반영
   (index.html 끝 </body> 직전에 <script src="hub-patch.js"></script>)
   ============================================================ */
(function(){
  'use strict';
  var FB   = 'https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app/hub_photos';
  var PASS = '5178';                    // 관리자 비밀번호 (변경 원하면 클비서에게)
  var KEY  = 'presence_hub_admin';      // localStorage 관리자 플래그

  function isAdmin(){ try{ return localStorage.getItem(KEY)==='1'; }catch(e){ return false; } }
  function setAdmin(v){ try{ v?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY); }catch(e){} }

  /* ---------- 1) ⋯ 버튼 관리자 잠금 ---------- */
  var moreBtn = document.getElementById('moreBtn');
  if(moreBtn){
    moreBtn.addEventListener('click', function(e){
      if(isAdmin()) return;                       // 관리자면 그대로 통과
      e.preventDefault(); e.stopImmediatePropagation();
      var p = prompt('관리자 비밀번호를 입력하세요');
      if(p===null) return;
      if(p===PASS){ setAdmin(true); setTimeout(function(){ moreBtn.click(); },50); }
      else alert('비밀번호가 올바르지 않습니다');
    }, true);                                     // capture: 기존 핸들러보다 먼저
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
  addMenuItem('LOCK','🔒 관리자 잠금', function(){
    setAdmin(false); alert('잠금 완료 — 다음에 ⋯ 누르면 비밀번호를 다시 묻습니다');
  });

  /* ---------- 3) 관리자 사진 패널 ---------- */
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
    '.hp-msg{font-family:"Courier New",monospace;font-size:11px;color:#38a37a;min-height:1em;}'+
    '.hp-prev{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}'+
    '.hp-prev img{height:74px;border-radius:3px;border:1px solid #2a2722;}'+
    '.hp-sect{font-family:"Courier New",monospace;font-size:10px;letter-spacing:.3em;color:#9a7a44;margin:26px 0 10px;}'+
    '.hp-list{display:flex;gap:10px;flex-wrap:wrap;}'+
    '.hp-item{position:relative;}'+
    '.hp-item img{height:86px;border-radius:3px;border:1px solid #2a2722;display:block;}'+
    '.hp-item button{position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:50%;border:none;background:#c05b4d;color:#fff;font-size:11px;cursor:pointer;line-height:1;}';
  document.head.appendChild(css);

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
      '<button class="hp-x" id="hpClose">닫기</button><span class="hp-msg" id="hpMsg"></span></div>'+
      '<div class="hp-sect">추가된 사진 (필름 반영분)</div>'+
      '<div class="hp-list" id="hpList"><span style="color:#6f6a60;font-size:12px">불러오는 중…</span></div>'+
    '</div>';
  document.body.appendChild(panel);

  var picked = [];
  function $(id){ return document.getElementById(id); }
  function openPanel(){ panel.classList.add('open'); drawList(); }
  $('hpClose').onclick = function(){ panel.classList.remove('open'); };
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

  $('hpUp').onclick = function(){
    if(!picked.length){ $('hpMsg').textContent='사진을 먼저 선택해 주세요'; return; }
    var cap=$('hpCap').value.trim()||autoCap(), done=0, total=picked.length;
    $('hpMsg').textContent='압축·업로드 중… 0/'+total;
    picked.reduce(function(p,f){
      return p.then(function(){ return compress(f); }).then(function(r){
        return fetch(FB+'.json',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({b64:r.b64,land:r.land,cap:cap,t:Date.now()})})
          .then(function(){ done++; $('hpMsg').textContent='압축·업로드 중… '+done+'/'+total; });
      });
    }, Promise.resolve()).then(function(){
      $('hpMsg').textContent='완료! 필름에 반영됐습니다 (새로고침 시 모든 기기 표시)';
      picked=[]; $('hpPrev').innerHTML=''; $('hpFile').value=''; $('hpCap').value='';
      loadPhotos(true); drawList();
    }).catch(function(){ $('hpMsg').textContent='업로드 실패 — 네트워크 확인'; });
  };

  function autoCap(){
    var M=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    var d=new Date(); return M[d.getMonth()]+' '+d.getFullYear();
  }

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

  /* ---------- 4) 필름 릴에 사진 주입 ---------- */
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
      // 이미 주입된 프레임 제거(중복 방지)
      document.querySelectorAll('.frame[data-hub]').forEach(function(n){ n.remove(); });
      keys.forEach(function(k,i){
        var reel=reels[i%reels.length];
        var kids=reel.children, half=Math.floor(kids.length/2);
        var f1=makeFrame(d[k], 92+i); f1.setAttribute('data-hub','1');
        var f2=f1.cloneNode(true);   f2.setAttribute('data-hub','1');
        // 릴은 앞/뒤 동일 세트 복제로 무한루프 — 양쪽 절반에 하나씩 넣어 대칭 유지
        reel.insertBefore(f1, kids[half]||null);
        reel.appendChild(f2);
      });
    }).catch(function(){});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ loadPhotos(); });
  else loadPhotos();
})();
