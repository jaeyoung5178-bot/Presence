/*!
 * Presence Hub · update-check.js
 * 새 배포가 감지되면 화면 하단에 "지금 업데이트" 팝업을 띄웁니다.
 * 동작 원리: 현재 페이지 파일의 ETag(내용 지문)를 주기적으로 확인해,
 *            배포로 내용이 바뀌면(=지문이 달라지면) 팝업을 표시합니다. 별도 설정/유지보수 불필요.
 */
(function () {
  if (window.__pvUpdateCheck) return;         // 중복 로드 방지
  window.__pvUpdateCheck = true;

  var SELF = location.pathname.split("#")[0].split("?")[0] || "./";
  var baseline = null;
  var shown = false;
  var POLL_MS = 60000;                          // 60초마다 확인

  function sig(res) {
    return res.headers.get("ETag") || res.headers.get("Last-Modified") || "";
  }

  function check(initial) {
    fetch(SELF + "?_pv=" + Date.now(), { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) return;
        var s = sig(res);
        if (!s) return;                          // 지문을 못 읽으면 조용히 패스
        if (initial) { baseline = s; return; }   // 최초 1회: 기준값 저장
        if (baseline && s !== baseline) show();   // 내용이 바뀌었으면 팝업
      })
      .catch(function () { /* 오프라인 등은 무시 */ });
  }

  function injectStyle() {
    if (document.getElementById("pv-update-style")) return;
    var css =
      "#pv-update{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(24px);" +
      "z-index:99999;display:flex;align-items:center;gap:14px;max-width:calc(100vw - 32px);" +
      "padding:13px 16px 13px 18px;border-radius:16px;opacity:0;transition:.35s cubic-bezier(.16,.84,.44,1);" +
      "background:rgba(20,22,28,.96);border:1px solid #3a4150;color:#f3efe6;" +
      "box-shadow:0 18px 50px rgba(0,0,0,.5);backdrop-filter:blur(8px);" +
      "font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;}" +
      "#pv-update.on{opacity:1;transform:translateX(-50%) translateY(0);}" +
      "#pv-update .pv-dot{width:9px;height:9px;border-radius:50%;flex:none;" +
      "background:#8fd14f;box-shadow:0 0 0 4px rgba(143,209,79,.18);}" +
      "#pv-update .pv-txt{font-size:14px;line-height:1.35;font-weight:600;}" +
      "#pv-update .pv-txt small{display:block;font-size:12px;color:#a7a294;font-weight:500;margin-top:1px;}" +
      "#pv-update .pv-go{flex:none;border:none;cursor:pointer;font:inherit;font-size:13px;font-weight:800;" +
      "padding:9px 15px;border-radius:999px;color:#0d0e12;" +
      "background:linear-gradient(135deg,#8fd14f,#5c8f2e);}" +
      "#pv-update .pv-go:hover{filter:brightness(1.06);}" +
      "#pv-update .pv-x{flex:none;border:none;background:transparent;color:#a7a294;cursor:pointer;" +
      "font-size:18px;line-height:1;padding:4px 6px;border-radius:8px;}" +
      "#pv-update .pv-x:hover{color:#f3efe6;}" +
      "@media(max-width:420px){#pv-update{left:16px;right:16px;transform:translateY(24px);width:auto;}" +
      "#pv-update.on{transform:translateY(0);}}";
    var st = document.createElement("style");
    st.id = "pv-update-style";
    st.textContent = css;
    document.head.appendChild(st);
  }

  function show() {
    if (shown) return;
    shown = true;
    injectStyle();
    var box = document.createElement("div");
    box.id = "pv-update";
    box.setAttribute("role", "status");
    box.innerHTML =
      '<span class="pv-dot"></span>' +
      '<span class="pv-txt">새 버전이 준비됐어요<small>지금 업데이트하면 최신 화면으로 바뀝니다</small></span>' +
      '<button class="pv-go" type="button">지금 업데이트</button>' +
      '<button class="pv-x" type="button" aria-label="닫기">×</button>';
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add("on"); });

    box.querySelector(".pv-go").addEventListener("click", function () {
      // 캐시 무시하고 새로 불러오기
      location.reload();
    });
    box.querySelector(".pv-x").addEventListener("click", function () {
      box.classList.remove("on");
      setTimeout(function () { box.remove(); }, 350);
      // 닫아도 다음 배포가 또 감지되면 다시 뜨도록 상태 갱신
      shown = false;
      baseline = null;
      setTimeout(function () { check(true); }, 400);
    });
  }

  function start() {
    check(true);
    setInterval(function () { if (!shown) check(false); }, POLL_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && !shown) check(false);
    });
    window.addEventListener("focus", function () { if (!shown) check(false); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
