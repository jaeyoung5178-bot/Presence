/* ============================================================
   Field Callback OS — Plan · Do · See
   Vanilla JS + LocalStorage. Storage layer is isolated so it
   can be swapped for Supabase/Firebase later.
   2026-07-11: PDF 항상 A4 1장 · 홈 전체누적(KPI 비율) · 계정 교차오염
   차단(Cloud.shutdown + uid 캡처 + 세션 tombstone) · 팀명단 임재영 고정.
============================================================ */
"use strict";

/* ==================== Constants ==================== */
const STAGES = ["contact", "stop", "presentation", "close", "rehash"];
const STAGE_LABEL = { contact: "Contact", stop: "Stop", presentation: "Presentation", close: "Close", rehash: "Rehash" };
const STAGE_COLOR = { contact: "#3B82F6", stop: "#14B8A6", presentation: "#8B5CF6", close: "#22C55E", rehash: "#F59E0B", fail: "#EF4444" };
const OBJECTIONS = ["다른단체후원", "일시희망", "금전부담", "개인정보", "단체불신", "바빠서 나중에", "국내만희망", "배우자와상의", "관심없음"];

/* ==================== Storage Adapter ====================
   All persistence goes through this object only.
   Swap implementation for Supabase/Firebase later.        */
const Store = {
  /* 계정(uid)별 저장소 분리 — 같은 기기에서 팀원 계정으로 바꿔도
     서로의 데이터가 절대 보이지 않음. 임재영(admin)은 기존 키 유지. */
  KEY_BASE: "fcos_sessions_v1",
  get KEY() {
    try {
      const w = JSON.parse(localStorage.getItem("fcos_hub_identity"));
      if (w && w.uid && w.uid !== "admin") return this.KEY_BASE + "__" + w.uid;
    } catch (e) {}
    return this.KEY_BASE;
  },
  _read() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch { return {}; }
  },
  _write(all) { localStorage.setItem(this.KEY, JSON.stringify(all)); },
  getAll() { return this._read(); },
  /* deleted(=tombstone) 세션은 없는 것으로 취급 → null 반환 */
  getSession(date) { const s = this._read()[date]; return s && !s.deleted ? s : null; },
  saveSession(session) {
    const all = this._read();
    all[session.info.date] = session;
    this._write(all);
  },
  importAll(data) { this._write(data); },
};

/* ==================== Session Model ==================== */
function newSession(date) {
  return {
    info: { name: "", date, site: "", weather: "맑음", theme: "", team: "" },
    goals: { start: "13:00", hours: 6, contact: 40, stop: 20, presentation: 15, close: 6, rehash: 3 },
    logs: [],        // {t: ISO string, type: stage|'fail'}
    objections: [],  // {t, type, reasons: []}
    rehashes: [],    // {t, date, site, name, age, gender, amount, pay, code, place, note, memory, next, remark}
    retro: { number: { good: "", bad: "" }, skill: { good: "", bad: "" }, attitude: { good: "", bad: "" } },
    tomb: {},        // 삭제 표식 — 기기 간 병합 시 지운 기록이 되살아나지 않게
    up: 0,           // 마지막 수정 시각 (동기화 비교용)
  };
}

let S = null; // current day session
/* 한국 시간 기준 오늘 날짜 (기존 UTC 기준 버그 수정 — 오전 9시 이전에 어제 세션이 열리던 문제) */
const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function loadToday() {
  S = Store.getSession(todayStr()) || newSession(todayStr());
}
function save() {
  S.up = Date.now();
  Store.saveSession(S);
  try { Cloud.queue(S.info.date); } catch (e) {}  // 클라우드 실시간 동기화
}

/* 날짜 전환 — 지난 날짜도 뒤늦게 작성 가능 */
function switchDate(date) {
  if (!date || date === S.info.date) return;
  save();
  let next = Store.getSession(date);
  if (!next) {
    next = newSession(date);
    // 최근 세션에서 이름/팀/목표를 이어받는다
    const prev = Object.values(Store.getAll()).filter((s) => s && !s.deleted).sort((a, b) => b.info.date.localeCompare(a.info.date))[0];
    if (prev) {
      next.info.name = prev.info.name;
      next.info.team = prev.info.team;
      next.goals = { ...prev.goals };
    }
  }
  S = next;
  logMode = "now";
  save();
  renderHeader();
  /* 지금 보고 있는 화면 그대로 새 날짜 데이터로 갱신 */
  const vis = document.querySelector(".view:not(.hidden)");
  const cur = vis ? vis.id.replace("view-", "") : "plan";
  if (cur === "do") renderDo();
  else if (cur === "see") renderSee();
  else if (cur === "dashboard") renderDashboard();
  else renderPlan();
  toast(`${date} 세션으로 이동`);
}

/* 세션 날짜 + 시:분 → 타임스탬프 (뒤늦게 기록해도 그 날짜로 저장) */
function tsAt(hhmm, offsetSec = 0) {
  const d = new Date(`${S.info.date}T${hhmm}:00`);
  d.setSeconds(d.getSeconds() + offsetSec);
  return d.toISOString();
}

/* ==================== Helpers ==================== */
const fmtTime = (iso) => new Date(iso).toTimeString().slice(0, 5);
const countType = (type) => S.logs.filter((l) => l.type === type).length;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => t.classList.add("hidden"), 1800);
}

function startHour() { return parseInt((S.goals.start || "13:00").split(":")[0], 10); }

/* elapsed working-hours fraction (0..hours) */
function elapsedHours() {
  const now = new Date();
  const [h, m] = (S.goals.start || "13:00").split(":").map(Number);
  const start = new Date(); start.setHours(h, m, 0, 0);
  const diff = (now - start) / 3600000;
  return Math.max(0, Math.min(diff, S.goals.hours));
}

/* ==================== Navigation ==================== */
function nav(view) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $("view-" + view).classList.remove("hidden");
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.nav === view));
  window.scrollTo({ top: 0 });
  if (view === "dashboard") renderDashboard();
  if (view === "plan") renderPlan();
  if (view === "do") renderDo();
  if (view === "see") renderSee();
  if (view === "team") { try { Team.render(); } catch (e) {} }
}

/* ==================== Header ==================== */
function renderHeader() {
  const hd = $("header-date");
  if (hd) {
    const d = new Date(S.info.date + "T00:00:00");
    const isToday = S.info.date === todayStr();
    hd.textContent = `${d.getMonth() + 1}/${d.getDate()} (${"일월화수목금토"[d.getDay()]})${isToday ? "" : " · 과거 세션"}`;
  }
  const site = $("header-site");
  if (site) {
    site.textContent = (S.info.site || "사이트 미설정") + " ✎";
    site.classList.toggle("chip-blue", !!S.info.site);
    site.style.cursor = "pointer";
    site.title = "누르면 이 날짜의 사이트를 수정할 수 있어요 (지난 날짜도 소급 가능)";
  }
}

/* ==================== PLAN ==================== */
function renderPlan() {
  $("p-name").value = S.info.name;
  $("p-date").value = S.info.date;
  $("p-site").value = S.info.site;
  $("p-weather").value = S.info.weather;
  $("p-theme").value = S.info.theme;
  $("p-team").value = S.info.team;
  $("p-start").value = S.goals.start;
  $("p-hours").value = S.goals.hours;
  STAGES.forEach((s) => { $("p-g-" + s).value = S.goals[s]; });
  // site autocomplete from history
  const sites = new Set(Object.values(Store.getAll()).filter((x) => x && !x.deleted).map((x) => x.info.site).filter(Boolean));
  $("site-list").innerHTML = [...sites].map((s) => `<option value="${esc(s)}">`).join("");
  renderHourlyGoals();
}

function readPlanInputs() {
  S.info.name = $("p-name").value.trim();
  S.info.site = $("p-site").value.trim();
  S.info.weather = $("p-weather").value;
  S.info.theme = $("p-theme").value.trim();
  S.info.team = $("p-team").value.trim();
  S.goals.start = $("p-start").value || "13:00";
  S.goals.hours = Math.max(1, parseInt($("p-hours").value, 10) || 6);
  STAGES.forEach((s) => { S.goals[s] = Math.max(0, parseInt($("p-g-" + s).value, 10) || 0); });
}

function renderHourlyGoals() {
  const hours = Math.max(1, parseInt($("p-hours").value, 10) || 6);
  const sh = parseInt(($("p-start").value || "13:00").split(":")[0], 10);
  const goals = {};
  STAGES.forEach((s) => (goals[s] = Math.max(0, parseInt($("p-g-" + s).value, 10) || 0)));
  let html = `<tr><th>시간</th>${STAGES.map((s) => `<th>${STAGE_LABEL[s]}</th>`).join("")}</tr>`;
  for (let i = 1; i <= hours; i++) {
    const hour = (sh + i - 1) % 24;
    html += `<tr><td>${hour}시</td>${STAGES.map((s) => `<td>${Math.round((goals[s] * i) / hours)}</td>`).join("")}</tr>`;
  }
  $("hourly-goal-table").innerHTML = html;
}

/* ==================== DO ==================== */
/* 기록 시간 모드: "now" = 현재 시간, 숫자 = 해당 시간대로 계속 기록 */
let logMode = "now";

/* 시간대 칩 범위 — 세션에 저장, 기본값은 PLAN의 시작시간~근무시간 */
function doRange() {
  if (S.range && Number.isInteger(S.range.from) && Number.isInteger(S.range.to)) return S.range;
  const sh = startHour();
  return { from: sh, to: Math.min(23, sh + S.goals.hours - 1) };
}

function rangeHours() {
  const { from, to } = doRange();
  const hoursSet = [];
  for (let h = from; h <= to; h++) hoursSet.push(h);
  return hoursSet;
}

function renderRangeSelects() {
  const { from, to } = doRange();
  const opts = (sel) => Array.from({ length: 24 }, (_, h) =>
    `<option value="${h}" ${h === sel ? "selected" : ""}>${h}시</option>`).join("");
  $("range-from").innerHTML = opts(from);
  $("range-to").innerHTML = opts(to);
}

function renderTimeMode() {
  let chips = `<button class="tm-chip ${logMode === "now" ? "on" : ""}" data-tm="now">⏱ 지금</button>`;
  rangeHours().forEach((h) => {
    chips += `<button class="tm-chip ${logMode === h ? "on" : ""}" data-tm="${h}">${h}시</button>`;
  });
  $("time-mode").innerHTML = chips;
  const hint = $("tm-hint");
  if (logMode === "now") hint.classList.add("hidden");
  else {
    hint.textContent = `${logMode}시 기록 모드 — 지금 누르는 버튼은 모두 ${logMode}시로 기록됩니다. "⏱ 지금"을 누르면 해제.`;
    hint.classList.remove("hidden");
  }
}

function renderDo() {
  const dd = $("do-date");
  if (dd) dd.value = S.info.date;
  const db = $("do-today-btn");
  if (db) db.style.display = S.info.date === todayStr() ? "none" : "";
  renderRangeSelects();
  renderTimeMode();
  STAGES.forEach((s) => { $("cnt-" + s).textContent = countType(s); });
  // mini status
  $("do-status").innerHTML = STAGES.map((s) =>
    `<div class="status-pill">${STAGE_LABEL[s]}<b>${countType(s)}<span style="color:var(--ink-3);font-size:11px;font-weight:600">/${S.goals[s]}</span></b></div>`
  ).join("");
  renderTimeline($("do-timeline"), S.logs, true);
}

function renderTimeline(el, logs, deletable, limit) {
  let items = [...logs].reverse();
  if (limit) items = items.slice(0, limit);
  if (!items.length) { el.innerHTML = `<div class="empty">아직 기록이 없습니다</div>`; return; }
  el.innerHTML = items.map((l) => {
    const idx = S.logs.indexOf(l);
    const label = l.type === "fail" ? "실패" : STAGE_LABEL[l.type];
    const extra = extraFor(l);
    const time = deletable
      ? `<button class="tl-time tl-time-edit" data-edit="${idx}" title="시간 수정">${fmtTime(l.t)}</button>`
      : `<span class="tl-time">${fmtTime(l.t)}</span>`;
    return `<div class="tl-item">
      ${time}
      <span class="tl-dot d-${l.type}"></span>
      <span class="tl-type">${label}</span>
      ${extra ? `<span class="tl-extra">${esc(extra)}</span>` : ""}
      ${deletable && l.type === "rehash" ? `<button class="tl-rh" data-rh="${idx}" title="후원자 정보 입력/수정" style="border:1.5px solid #F59E0B;background:#FFFBEB;color:#B45309;border-radius:8px;padding:2px 9px;font-size:12px;font-weight:700;cursor:pointer;margin-left:6px">✎ 정보</button>` : ""}
      ${deletable ? `<button class="tl-del" data-del="${idx}" aria-label="삭제">×</button>` : ""}
    </div>`;
  }).join("");
}

function extraFor(log) {
  if (log.type === "fail" || log.type === "close") {
    const o = S.objections.find((x) => x.t === log.t);
    return o ? o.reasons.join(", ") : "";
  }
  if (log.type === "rehash") {
    const r = S.rehashes.find((x) => x.t === log.t);
    return r ? `${r.name || ""} ${r.amount ? Number(r.amount).toLocaleString() + "원" : ""}`.trim() : "";
  }
  return "";
}

function addLog(type) {
  // 실시간 기록도 항상 "세션 날짜" 기준으로 저장 (지난 날짜 세션 편집 대응)
  let log;
  if (logMode === "now") {
    const now = new Date();
    log = { t: tsAt(now.toTimeString().slice(0, 5), now.getSeconds()), type };
  } else {
    // 선택한 시간대 안에서 순서 유지: 그 시간대 기존 기록 수만큼 분을 증가
    const inHour = S.logs.filter((l) => new Date(l.t).getHours() === logMode).length;
    const mm = String(Math.min(59, inHour)).padStart(2, "0");
    log = { t: tsAt(`${String(logMode).padStart(2, "0")}:${mm}`), type };
  }
  S.logs.push(log);
  S.logs.sort((a, b) => a.t.localeCompare(b.t));
  save();
  renderDo();
  renderHeader();
  const btn = document.querySelector(`[data-log="${type}"]`);
  if (btn) { btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump"); }
  if (navigator.vibrate) navigator.vibrate(15);
  return log;
}

/* Firebase 키 금지문자( . $ # [ ] / ) 제거 — tomb(삭제표식) 키가 타임스탬프의
   점(.000Z) 때문에 저장 400 에러가 나던 문제 해결. 삭제표식 만드는 곳과
   병합에서 조회하는 곳 모두 이 함수로 키를 만들어야 일치함. */
function fbKey(s) { return String(s).replace(/[.$#\[\]\/]/g, "_"); }

/* 헤더 배지용 짧은 이름 — 3글자 한글 성명은 성을 떼고 이름만 (민병준→병준) */
function shortName(n) {
  n = String(n || "").trim();
  if (/^[가-힣]{3}$/.test(n)) return n.slice(1);
  return n;
}

function deleteLog(idx) {
  const log = S.logs[idx];
  if (!log) return;
  S.tomb = S.tomb || {};
  S.tomb[fbKey("l:" + log.t + "|" + log.type)] = 1;
  if (S.objections.some((o) => o.t === log.t)) S.tomb[fbKey("o:" + log.t)] = 1;
  if (S.rehashes.some((r) => r.t === log.t)) S.tomb[fbKey("r:" + log.t)] = 1;
  S.objections = S.objections.filter((o) => o.t !== log.t);
  S.rehashes = S.rehashes.filter((r) => r.t !== log.t);
  S.logs.splice(idx, 1);
  save(); renderDo();
  toast("삭제했습니다");
}

/* ==================== Objection Modal ====================
   Close를 누를 때마다 오브젝션(거절·우려 사유)을 선택하거나
   기타에 직접 입력한다. 후원 성사(후원자 정보)는 Rehash.   */
let pendingObjLog = null;

function openObjection() {
  pendingObjLog = addLog("close");
  $("obj-grid").innerHTML = OBJECTIONS.map((o, i) =>
    `<label class="obj-check"><input type="checkbox" value="${esc(o)}" id="obj-${i}">${esc(o)}</label>`
  ).join("");
  $("obj-etc").value = "";
  $$("#obj-grid input").forEach((cb) =>
    cb.addEventListener("change", () => cb.closest(".obj-check").classList.toggle("on", cb.checked))
  );
  $("modal-objection").classList.remove("hidden");
}

function saveObjection() {
  const reasons = [...$$("#obj-grid input:checked")].map((c) => c.value);
  const etc = $("obj-etc").value.trim();
  if (etc) reasons.push(etc);
  if (!reasons.length) { toast("항목을 선택해주세요"); return; }
  S.objections.push({ t: pendingObjLog.t, type: "close", reasons });
  save();
  closeModals();
  renderDo();
  toast("오브젝션 저장 ✓");
}

/* ==================== Rehash Modal (후원자 정보) ==================== */
let pendingRehashLog = null;
let editingRehashT = null;   // 타임라인에서 "✎ 정보"로 연 경우: 해당 로그의 t

const RH_FIELDS = ["name", "age", "amount", "code", "place", "note", "memory", "next", "remark"];

function openRehash() {
  editingRehashT = null;
  pendingRehashLog = addLog("rehash");
  RH_FIELDS.forEach((f) => ($("rh-f-" + f).value = ""));
  $("rh-f-gender").value = "여";
  $("rh-f-place").value = S.info.site || "";   /* 활동장소 — PLAN의 사이트(테리코드 포함)를 기본값으로 */
  $$("#modal-rehash .seg-btn").forEach((b, i) => b.classList.toggle("active", i === 0));
  $("modal-rehash").classList.remove("hidden");
  setTimeout(() => $("rh-f-name").focus(), 250);
}

/* 타임라인의 Rehash 항목에서 후원자 정보 입력/수정 */
function openRehashEdit(log) {
  if (!log || log.type !== "rehash") return;
  editingRehashT = log.t;
  pendingRehashLog = null;
  const r = S.rehashes.find((x) => x.t === log.t) || {};
  RH_FIELDS.forEach((f) => ($("rh-f-" + f).value = r[f] != null ? r[f] : ""));
  $("rh-f-code").value = String(r.code || "").replace(/^C26/, "");   /* 입력칸엔 뒷자리만 */
  if (!$("rh-f-place").value) $("rh-f-place").value = r.place || r.site || S.info.site || "";
  $("rh-f-gender").value = r.gender || "여";
  const pay = r.pay || "계좌";
  $$("#modal-rehash .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.pay === pay));
  if (!document.querySelector("#modal-rehash .seg-btn.active"))
    $$("#modal-rehash .seg-btn").forEach((b, i) => b.classList.toggle("active", i === 0));
  $("modal-rehash").classList.remove("hidden");
  setTimeout(() => $("rh-f-name").focus(), 250);
}

function saveRehash() {
  const pay = document.querySelector("#modal-rehash .seg-btn.active")?.dataset.pay || "계좌";
  const codeDigits = $("rh-f-code").value.replace(/[^0-9]/g, "");
  const data = {
    name: $("rh-f-name").value.trim(),
    age: $("rh-f-age").value,
    gender: $("rh-f-gender").value,
    amount: $("rh-f-amount").value,
    pay,
    code: codeDigits ? "C26" + codeDigits : "",
    place: $("rh-f-place").value.trim(),
    note: $("rh-f-note").value.trim(),
    memory: $("rh-f-memory").value.trim(),
    next: $("rh-f-next").value.trim(),
    remark: $("rh-f-remark").value.trim(),
  };
  if (editingRehashT != null) {
    /* 수정 모드: 기존 후원자 갱신 (기록이 없던 로그면 새로 채움) */
    let r = S.rehashes.find((x) => x.t === editingRehashT);
    if (!r) { r = { t: editingRehashT, source: "rehash", date: S.info.date, site: S.info.site }; S.rehashes.push(r); }
    Object.assign(r, data);
    /* 허브 리젝노트에도 수정분 재반영 (동기화 마킹 해제 → 재전송) */
    try {
      const k = "fcos_hub_synced"; const m = JSON.parse(localStorage.getItem(k)) || {};
      delete m["rn_cb_" + editingRehashT]; localStorage.setItem(k, JSON.stringify(m));
      if (typeof Hub !== "undefined") setTimeout(() => Hub.syncAll(false), 300);
    } catch (e) {}
    editingRehashT = null;
    save(); closeModals(); renderDo(); toast("후원자 정보 수정 완료 ✓");
    return;
  }
  S.rehashes.push({
    t: pendingRehashLog.t,
    source: pendingRehashLog.type,
    date: S.info.date,
    site: S.info.site,
    ...data,
  });
  save();
  closeModals();
  renderDo();
  toast("저장 완료 ✓");
}

function closeModals() {
  $$(".modal-backdrop").forEach((m) => m.classList.add("hidden"));
}

/* ==================== Manual Log (거꾸로 기록 / 시간 수정) ==================== */
let manualEdit = null; // 수정 대상 로그 (null이면 추가 모드)

function openManual(editLog) {
  manualEdit = editLog || null;
  $("manual-title").textContent = manualEdit ? "시간 수정" : "수동 기록 추가";
  $("mn-type").disabled = !!manualEdit;
  $("mn-count-wrap").style.display = manualEdit ? "none" : "";
  if (manualEdit) {
    $("mn-type").value = manualEdit.type === "fail" ? "close" : manualEdit.type;
    $("mn-time").value = fmtTime(manualEdit.t);
  } else {
    $("mn-type").value = "contact";
    $("mn-time").value = new Date().toTimeString().slice(0, 5);
    $("mn-count").value = 1;
  }
  $("modal-manual").classList.remove("hidden");
}

function saveManual() {
  const hhmm = $("mn-time").value;
  if (!hhmm) { toast("시간을 입력해주세요"); return; }
  if (manualEdit) {
    const oldT = manualEdit.t, newT = tsAt(hhmm);
    // 이동 전 시각은 삭제 표식 (동기화 병합 시 옛 기록이 되살아나지 않게)
    S.tomb = S.tomb || {};
    S.tomb[fbKey("l:" + oldT + "|" + manualEdit.type)] = 1;
    if (S.objections.some((o) => o.t === oldT)) S.tomb[fbKey("o:" + oldT)] = 1;
    if (S.rehashes.some((r) => r.t === oldT)) S.tomb[fbKey("r:" + oldT)] = 1;
    // 연결된 오브젝션/리해쉬 기록도 함께 이동
    S.objections.forEach((o) => { if (o.t === oldT) o.t = newT; });
    S.rehashes.forEach((r) => { if (r.t === oldT) r.t = newT; });
    manualEdit.t = newT;
    toast("시간 수정 완료 ✓");
  } else {
    const type = $("mn-type").value;
    const n = Math.max(1, Math.min(99, parseInt($("mn-count").value, 10) || 1));
    for (let i = 0; i < n; i++) S.logs.push({ t: tsAt(hhmm, i), type });
    toast(`${hhmm} · ${STAGE_LABEL[type]} ${n}건 추가 ✓`);
  }
  S.logs.sort((a, b) => a.t.localeCompare(b.t));
  save();
  closeModals();
  renderDo();
}

/* ==================== DASHBOARD ==================== */
function renderDashboard() {
  $("dash-greeting").textContent = S.info.name
    ? `${S.info.name}님, ${S.info.theme ? `오늘의 테마: "${S.info.theme}"` : "오늘도 화이팅!"}`
    : "PLAN에서 오늘 계획을 세워보세요";

  renderAllTime();

  // rings
  $("rings-grid").innerHTML = STAGES.map((s) => {
    const cur = countType(s), goal = S.goals[s];
    const p = Math.min(100, pct(cur, goal));
    const R = 30, C = 2 * Math.PI * R;
    return `<div class="ring-card">
      <svg class="ring-svg" viewBox="0 0 76 76">
        <circle class="ring-track" cx="38" cy="38" r="${R}" fill="none" stroke-width="6"/>
        <circle class="ring-val" cx="38" cy="38" r="${R}" fill="none" stroke-width="6"
          stroke="${STAGE_COLOR[s]}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p / 100)}"
          transform="rotate(-90 38 38)"/>
        <text class="ring-num" x="38" y="37" text-anchor="middle">${cur}</text>
        <text class="ring-pct" x="38" y="49" text-anchor="middle">${p}%</text>
      </svg>
      <div class="ring-label">${STAGE_LABEL[s].toUpperCase()}</div>
      <div class="ring-goal">목표 ${goal}</div>
    </div>`;
  }).join("");

  // pace vs hourly goal
  const eh = elapsedHours();
  const badge = $("pace-badge");
  if (eh <= 0) { badge.textContent = "근무 전"; badge.className = "chip"; }
  else if (eh >= S.goals.hours) { badge.textContent = "근무 종료"; badge.className = "chip"; }
  else { badge.textContent = `${eh.toFixed(1)}h 경과`; badge.className = "chip chip-blue"; }

  $("pace-list").innerHTML = STAGES.map((s) => {
    const expected = S.goals[s] * (eh / S.goals.hours);
    const cur = countType(s);
    const p = expected > 0 ? Math.round((cur / expected) * 100) : (cur > 0 ? 100 : 0);
    const cls = p >= 100 ? "over" : p < 70 ? "behind" : "";
    return `<div class="pace-row">
      <span class="lbl">${STAGE_LABEL[s]}</span>
      <div class="pace-bar"><div class="pace-fill ${cls}" style="width:${Math.min(100, p)}%"></div></div>
      <span class="pace-pct">${cur}/${expected.toFixed(1)} · ${p}%</span>
    </div>`;
  }).join("");

  renderTimeline($("dash-recent"), S.logs, false, 5);
  renderWeek();
}

/* ==================== 최근 7일 요약 (홈) ==================== */
function localDateStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/* 프레젠스 웹앱(워크북) 세일즈 기록 — 내 이름 기준으로 가져와서
   콜백싯 기록이 없는 날도 최근 결과가 보이게 (계정별 자기 데이터만) */
let _wkSales = null, _wkSalesAt = 0, _wkSalesLoading = false;
/* Hub가 아직 정의되기 전에 호출돼도 절대 죽지 않게 */
function hubWho() { try { return Hub.identity(); } catch (e) { return null; } }
function fetchWeekSales(days) {
  const who = hubWho();
  if (!who || !who.name) return;
  if (_wkSalesLoading || (Date.now() - _wkSalesAt < 60000 && _wkSales)) return;
  _wkSalesLoading = true;
  const nrm = (s) => String(s || "").replace(/\s+/g, "");
  Promise.all(days.map((d) =>
    fetch(HUB_DB + "/sales/" + d + ".json").then((r) => r.json()).catch(() => null)
  )).then((arr) => {
    const out = {};
    arr.forEach((day, i) => {
      if (!day) return;
      for (const k in day) {
        const e = day[k];
        if (e && nrm(e.name) === nrm(who.name) && !e.na && !e.rally) { out[days[i]] = +e.count || 0; break; }
      }
    });
    _wkSales = out; _wkSalesAt = Date.now(); _wkSalesLoading = false;
    renderWeek();   // 데이터 도착 → 다시 그림
  }).catch(() => { _wkSalesLoading = false; });
}

function renderWeek() {
  const el = $("dash-week");
  if (!el) return;
  const all = Store.getAll();
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(localDateStr(-i));
  fetchWeekSales(days);
  const sales = _wkSales || {};
  const tot = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0 };
  let rows = "", any = false, donorTot = 0;
  days.forEach((d) => {
    const s = all[d] && !all[d].deleted ? all[d] : null;
    const c = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0 };
    ((s && s.logs) || []).forEach((l) => { if (c[l.type] !== undefined) c[l.type]++; });
    STAGES.forEach((k) => (tot[k] += c[k]));
    /* 후원자 수: 콜백싯 후원자 기록 우선, 없으면 웹앱(워크북) 세일즈 기록 */
    const cbDonors = (s && s.rehashes && s.rehashes.length) || 0;
    const donors = Math.max(cbDonors, sales[d] || 0);
    donorTot += donors;
    if ((s && s.logs && s.logs.length) || donors) any = true;
    const dd = new Date(d + "T00:00:00");
    const src = donors ? (cbDonors >= (sales[d] || 0) ? "" : " <span style='color:var(--ink-3);font-size:9px'>웹앱</span>") : "";
    rows += `<tr><td>${dd.getMonth() + 1}/${dd.getDate()} (${"일월화수목금토"[dd.getDay()]})</td>`
      + STAGES.map((k) => `<td>${c[k] || ""}</td>`).join("")
      + `<td><b>${donors || ""}</b>${src}</td>`
      + `<td style="font-size:11px">${s && s.info.site ? esc(s.info.site.split("/")[0]) : ""}</td></tr>`;
  });
  if (!any) {
    el.innerHTML = `<div class="empty">최근 7일 기록이 없습니다${hubWho() ? "" : " · 허브 연결하면 웹앱 세일즈 기록도 가져와요"}</div>`;
    return;
  }
  const kpi = pct(tot.rehash, tot.close);          // Close 대비 Rehash
  const closeRate = pct(tot.close, tot.contact);   // Contact 대비 Close
  /* 사이트별 (최근 7일) */
  const siteMap = {};
  days.forEach((d) => {
    const s = all[d] && !all[d].deleted ? all[d] : null; if (!s || !s.logs || !s.logs.length) return;
    const key = (s.info.site || "미설정").split("/")[0];
    if (!siteMap[key]) siteMap[key] = { contact: 0, close: 0, rehash: 0 };
    s.logs.forEach((l) => { if (siteMap[key][l.type] !== undefined) siteMap[key][l.type]++; });
  });
  const siteRows = Object.entries(siteMap).sort((a, b) => b[1].close - a[1].close).map(([k, v]) =>
    `<tr><td>${esc(k)}</td><td>${v.contact}</td><td>${v.close}</td><td>${v.rehash}</td><td><b style="color:var(--blue)">${pct(v.close, v.contact)}%</b></td></tr>`).join("");
  el.innerHTML =
    `<div class="result-cards" style="grid-template-columns:repeat(2,1fr)">
      <div class="result-card"><div class="k">7일 후원자</div><div class="v" style="color:${STAGE_COLOR.rehash}">${donorTot}</div><div class="g">콜백싯+웹앱 세일즈</div></div>
      <div class="result-card"><div class="k">7일 CLOSE</div><div class="v" style="color:${STAGE_COLOR.close}">${tot.close}</div><div class="g">Contact ${tot.contact} · ${closeRate}%</div></div>
      <div class="result-card"><div class="k">7일 REHASH 기록</div><div class="v" style="color:${STAGE_COLOR.presentation}">${tot.rehash}</div><div class="g">후원자 정보 입력</div></div>
      <div class="result-card"><div class="k">KPI</div><div class="v" style="color:var(--blue)">${kpi}%</div><div class="g">Close 대비 Rehash</div></div>
    </div>
    <div class="table-wrap"><table class="mini-table"><tr><th>날짜</th><th>C</th><th>S</th><th>PT</th><th>Cl</th><th>Rh</th><th>후원</th><th>사이트</th></tr>${rows}</table></div>`
    + (siteRows ? `<p class="hint" style="margin:12px 0 4px;font-weight:800">사이트별 (7일)</p><div class="table-wrap"><table class="mini-table"><tr><th>사이트</th><th>Contact</th><th>Close</th><th>Rehash</th><th>Close율</th></tr>${siteRows}</table></div>` : "");
}

/* ==================== 전체 누적 (All-Time) ====================
   콜백싯 모든 세션(삭제 제외) + 워크북 웹앱 세일즈를 합산.
   KPI 비율은 "Close N개당 후원 1명" = N : 1 형식으로 표시.
   ★ 누적 기준일(사람별): 그 이전 날짜의 콜백싯 세션·웹앱 세일즈는
     누적(후원자·활동일수 포함)에 넣지 않음. 화면에 기준일 표시.
     - 임재영(admin): 2026-07-09(목) 고정 — 콜백싯 사용 시작일
     - 그 외 팀원: 본인 콜백싯에 데이터가 처음 기록된 날짜 자동 기준 */
function alltimeStart() {
  const who = hubWho();
  const nrm = (s) => String(s || "").replace(/\s+/g, "");
  if (who && (who.uid === "admin" || nrm(who.name) === "임재영")) return "2026-07-09";
  const all = Store.getAll();
  const ds = Object.keys(all).filter((d) => all[d] && !all[d].deleted && all[d].info).sort();
  return ds[0] || todayStr();   // 기록이 아직 없으면 오늘부터
}
let _atSales = null, _atSalesAt = 0, _atSalesLoading = false;
/* 워크북 웹앱 세일즈 전체를 1회 fetch(5분 캐시) → 날짜별 내 후원 수 */
function fetchAllTimeSales() {
  const who = hubWho();
  if (!who || !who.name) return;
  if (_atSalesLoading || (Date.now() - _atSalesAt < 300000 && _atSales)) return;
  _atSalesLoading = true;
  const nrm = (s) => String(s || "").replace(/\s+/g, "");
  fetch(HUB_DB + "/sales.json").then((r) => r.json()).then((all) => {
    const out = {};
    for (const d in (all || {})) {
      const day = all[d]; if (!day) continue;
      for (const k in day) {
        const e = day[k];
        if (e && nrm(e.name) === nrm(who.name) && !e.na && !e.rally) { out[d] = +e.count || 0; break; }
      }
    }
    _atSales = out; _atSalesAt = Date.now(); _atSalesLoading = false;
    renderAllTime();   // 데이터 도착 → 다시 그림
  }).catch(() => { _atSalesLoading = false; });
}

function renderAllTime() {
  const el = $("dash-alltime");
  if (!el) return;
  const all = Store.getAll();
  fetchAllTimeSales();
  const sales = _atSales || {};
  const tot = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0 };
  let donorTot = 0, activeDays = 0, firstDate = null, lastDate = null;
  /* 콜백싯 세션(삭제 제외) + 세일즈만 있는 날짜까지 모두 순회 */
  const start = alltimeStart();   // 사람별 누적 기준일
  const today = todayStr();
  const dates = new Set([
    ...Object.keys(all).filter((d) => all[d] && !all[d].deleted),
    ...Object.keys(sales),
  ].filter((d) => d >= start && d <= today));   // 기준일 이전(콜백싯 시작 전) 및 오늘 이후(미래 날짜) 기록 제외 — 후원자·활동일수 포함
  dates.forEach((d) => {
    const s = all[d] && !all[d].deleted ? all[d] : null;
    const c = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0 };
    ((s && s.logs) || []).forEach((l) => { if (c[l.type] !== undefined) c[l.type]++; });
    STAGES.forEach((k) => (tot[k] += c[k]));
    /* 날짜별 후원자 = max(콜백싯 후원자 수, 웹앱 세일즈 수) */
    const cbDonors = (s && s.rehashes && s.rehashes.length) || 0;
    const donors = Math.max(cbDonors, sales[d] || 0);
    donorTot += donors;
    if ((s && s.logs && s.logs.length) || donors) {
      activeDays++;
      if (!firstDate || d < firstDate) firstDate = d;
      if (!lastDate || d > lastDate) lastDate = d;
    }
  });
  if (!activeDays) {
    el.innerHTML = `<div class="empty">아직 누적 기록이 없습니다 — 기록을 시작하면 여기에 쌓입니다</div>`;
    return;
  }
  const closeRate = pct(tot.close, tot.contact);
  /* KPI 비율: Close N개당 후원 1명 → "N : 1" (소수 1자리 반올림, 후원 0이면 "－") */
  const perDonor = donorTot > 0 ? Math.round((tot.close / donorTot) * 10) / 10 : null;
  const kpiRatio = perDonor != null ? perDonor + " : 1" : "－";
  const period = firstDate === lastDate ? firstDate : `${firstDate} ~ ${lastDate}`;
  const wd = "일월화수목금토"[new Date(start + "T00:00:00").getDay()];
  el.innerHTML =
    `<div class="hint" style="margin:0 0 8px;font-weight:700">📅 ${start}(${wd}) 콜백싯 시작일부터 누적</div>
    <div class="result-cards" style="grid-template-columns:repeat(2,1fr)">
      <div class="result-card"><div class="k">누적 후원자</div><div class="v" style="color:${STAGE_COLOR.rehash}">${donorTot}</div><div class="g">콜백싯+웹앱 세일즈 · ${start}부터</div></div>
      <div class="result-card"><div class="k">누적 CLOSE</div><div class="v" style="color:${STAGE_COLOR.close}">${tot.close}</div><div class="g">Contact ${tot.contact}</div></div>
      <div class="result-card"><div class="k">KPI 비율</div><div class="v" style="color:var(--blue)">${kpiRatio}</div><div class="g">Close ${perDonor != null ? perDonor : "-"}개당 후원 1명</div></div>
      <div class="result-card"><div class="k">Close율</div><div class="v" style="color:${STAGE_COLOR.presentation}">${closeRate}%</div><div class="g">Contact 대비</div></div>
      <div class="result-card"><div class="k">활동일수</div><div class="v">${activeDays}</div><div class="g">${esc(period)}</div></div>
      <div class="result-card"><div class="k">누적 CONTACT</div><div class="v" style="color:${STAGE_COLOR.contact}">${tot.contact}</div><div class="g">전체 만남</div></div>
    </div>
    <div class="table-wrap"><table class="mini-table"><tr><th>Contact</th><th>Stop</th><th>PT</th><th>Close</th><th>Rehash</th></tr>
      <tr><td>${tot.contact}</td><td>${tot.stop}</td><td>${tot.presentation}</td><td>${tot.close}</td><td>${tot.rehash}</td></tr></table></div>`;
}

/* ==================== SEE ==================== */
let hourlyChart = null, objChart = null, objChartType = "pie";

function renderSee() {
  $("see-sub").textContent = `${S.info.date} · ${S.info.site || "사이트 미설정"} · ${S.info.weather}`;
  const sd = $("see-date");
  if (sd) sd.value = S.info.date;
  const sb = $("see-today-btn");
  if (sb) sb.style.display = S.info.date === todayStr() ? "none" : "";
  renderResultCards();
  renderFunnel();
  renderHourlyChart();
  renderHeatmap();
  renderObjChart();
  renderRehashList();
  renderSiteStats();
  renderWeatherStats();
  loadRetro();
}

function renderResultCards() {
  $("result-cards").innerHTML = STAGES.map((s) => {
    const cur = countType(s), goal = S.goals[s], d = cur - goal;
    return `<div class="result-card">
      <div class="k">${STAGE_LABEL[s].toUpperCase()}</div>
      <div class="v" style="color:${STAGE_COLOR[s]}">${cur}</div>
      <div class="g">목표 ${goal}</div>
      <div class="diff ${d >= 0 ? "ok" : "no"}">${d >= 0 ? "+" + d : d}</div>
    </div>`;
  }).join("");
}

function renderFunnel() {
  const counts = STAGES.map((s) => countType(s));
  const max = Math.max(...counts, 1);
  let html = "";
  STAGES.forEach((s, i) => {
    const c = counts[i];
    const w = 35 + (c / max) * 65; // 35%..100%
    html += `<div class="fn-stage">
      <div class="fn-bar" style="width:${w}%;background:${STAGE_COLOR[s]}">
        <span>${STAGE_LABEL[s]}</span><span>${c}</span>
      </div>`;
    html += `</div>`;
    if (i < STAGES.length - 1) {
      const next = counts[i + 1];
      const conv = pct(next, c);
      const loss = Math.max(0, c - next);
      html += `<div class="fn-arrow">↓ <span class="fn-conv">전환 ${conv}%</span> · <span class="fn-loss">유실 ${loss}명</span></div>`;
    }
  });
  $("funnel").innerHTML = html;
}

function hourlyBuckets() {
  const sh = startHour();
  const hours = [];
  for (let i = 0; i < S.goals.hours; i++) hours.push((sh + i) % 24);
  // include any log hours outside range
  S.logs.forEach((l) => {
    const h = new Date(l.t).getHours();
    if (!hours.includes(h)) hours.push(h);
  });
  hours.sort((a, b) => a - b);
  const data = {};
  hours.forEach((h) => (data[h] = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0, fail: 0 }));
  S.logs.forEach((l) => {
    const h = new Date(l.t).getHours();
    if (data[h] && data[h][l.type] !== undefined) data[h][l.type]++;
  });
  return { hours, data };
}

function renderHourlyChart() {
  const { hours, data } = hourlyBuckets();
  const ctx = $("chart-hourly").getContext("2d");
  if (hourlyChart) hourlyChart.destroy();
  hourlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: hours.map((h) => h + "시"),
      datasets: STAGES.map((s) => ({
        label: STAGE_LABEL[s],
        data: hours.map((h) => data[h][s]),
        backgroundColor: STAGE_COLOR[s],
        borderRadius: 4,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderHeatmap() {
  const { hours, data } = hourlyBuckets();
  const scores = hours.map((h) => {
    const d = data[h];
    return d.close * 5 + d.rehash * 4 + d.presentation * 2 + d.stop * 1 + d.contact * 0.5;
  });
  const max = Math.max(...scores, 1);
  $("heatmap").innerHTML = hours.map((h, i) => {
    const ratio = scores[i] / max;
    const bg = `rgba(37,99,235,${(ratio * 0.85).toFixed(2)})`;
    const color = ratio > 0.55 ? "#fff" : "var(--ink-2)";
    return `<div class="hm-cell" style="background:${bg};color:${color};border-color:${ratio > 0 ? "transparent" : "var(--line)"}">
      ${h}시<b>${data[h].close}C</b></div>`;
  }).join("");
}

function objCounts() {
  const map = {};
  S.objections.forEach((o) => o.reasons.forEach((r) => (map[r] = (map[r] || 0) + 1)));
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

const OBJ_PALETTE = ["#2563EB","#7C3AED","#0D9488","#D97706","#DC2626","#DB2777","#059669","#6366F1","#A16207","#475569","#0EA5E9","#9333EA"];

function renderObjChart() {
  const entries = objCounts();
  const ctx = $("chart-objection").getContext("2d");
  if (objChart) objChart.destroy();
  if (!entries.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    objChart = new Chart(ctx, { type: "pie", data: { labels: ["기록 없음"], datasets: [{ data: [1], backgroundColor: ["#ECECEE"] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    return;
  }
  objChart = new Chart(ctx, {
    type: objChartType,
    data: {
      labels: entries.map((e) => e[0]),
      datasets: [{
        label: "건수",
        data: entries.map((e) => e[1]),
        backgroundColor: entries.map((_, i) => OBJ_PALETTE[i % OBJ_PALETTE.length]),
        borderRadius: objChartType === "bar" ? 5 : 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: objChartType === "bar" ? "y" : "x",
      plugins: { legend: { display: objChartType === "pie", position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: objChartType === "bar" ? { x: { beginAtZero: true, ticks: { precision: 0 } } } : {},
    },
  });
}

/* rehash list (all sessions, filterable) */
function allRehashes() {
  return Object.values(Store.getAll()).filter((s) => s && !s.deleted).flatMap((s) => s.rehashes || []);
}

function renderRehashList() {
  const q = $("rh-search").value.trim().toLowerCase();
  const date = $("rh-date").value;
  const site = $("rh-site").value.trim().toLowerCase();
  const pay = $("rh-pay").value;
  const items = allRehashes().filter((r) =>
    (!q || (r.name || "").toLowerCase().includes(q)) &&
    (!date || r.date === date) &&
    (!site || ((r.place || r.site || "")).toLowerCase().includes(site)) &&
    (!pay || r.pay === pay)
  ).sort((a, b) => b.t.localeCompare(a.t));

  $("rehash-list").innerHTML = items.length ? items.map((r) => `
    <div class="rh-item">
      <div class="rh-top">
        <span>${esc(r.name) || "이름 없음"}</span>
        <span class="chip chip-blue">Rehash</span>
        <span class="chip">${esc(r.pay)}</span>
        ${r.code ? `<span class="chip">${esc(r.code)}</span>` : ""}
        <span class="rh-amount">${r.amount ? Number(r.amount).toLocaleString() + "원" : "-"}</span>
      </div>
      <div class="rh-sub">${r.date} · ${esc(r.place || r.site) || "-"} · ${r.age ? r.age + "세" : ""} ${esc(r.gender || "")}</div>
      ${r.memory ? `<div class="rh-note">💭 ${esc(r.memory)}</div>` : ""}
      ${r.next ? `<div class="rh-note">💬 다음: ${esc(r.next)}</div>` : ""}
      ${r.note || r.remark ? `<div class="rh-note">${esc([r.note, r.remark].filter(Boolean).join(" · "))}</div>` : ""}
    </div>`).join("")
    : `<div class="empty" style="color:var(--ink-3);font-size:13px;text-align:center;padding:14px">결과가 없습니다</div>`;
}

/* site / weather stats across all sessions */
function aggregateBy(keyFn) {
  const map = {};
  Object.values(Store.getAll()).filter((s) => s && !s.deleted).forEach((s) => {
    const key = keyFn(s) || "미설정";
    if (!map[key]) map[key] = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0, days: 0 };
    map[key].days++;
    (s.logs || []).forEach((l) => { if (map[key][l.type] !== undefined) map[key][l.type]++; });
  });
  return map;
}

function statsTable(map) {
  const rows = Object.entries(map).sort((a, b) => b[1].close - a[1].close);
  if (!rows.length) return `<tr><td>데이터 없음</td></tr>`;
  let html = `<tr><th></th><th>일수</th><th>Contact</th><th>Close</th><th>Close율</th></tr>`;
  rows.forEach(([k, v]) => {
    html += `<tr><td>${esc(k)}</td><td>${v.days}</td><td>${v.contact}</td><td>${v.close}</td>
      <td><b style="color:var(--blue)">${pct(v.close, v.contact)}%</b></td></tr>`;
  });
  return html;
}

function renderSiteStats() { $("site-stats").innerHTML = statsTable(aggregateBy((s) => s.info.site)); }
function renderWeatherStats() { $("weather-stats").innerHTML = statsTable(aggregateBy((s) => s.info.weather)); }

/* retro */
function loadRetro() {
  ["number", "skill", "attitude"].forEach((k) => {
    $(`retro-${k}-good`).value = S.retro[k].good;
    $(`retro-${k}-bad`).value = S.retro[k].bad;
  });
}
function saveRetro() {
  ["number", "skill", "attitude"].forEach((k) => {
    S.retro[k].good = $(`retro-${k}-good`).value.trim();
    S.retro[k].bad = $(`retro-${k}-bad`).value.trim();
  });
  save();
  toast("회고 저장 ✓");
}

/* replay */
let replayTimer = null;
function replay() {
  clearInterval(replayTimer);
  const box = $("replay-box");
  box.innerHTML = "";
  const logs = [...S.logs];
  if (!logs.length) { box.innerHTML = `<div class="empty">기록이 없습니다</div>`; return; }
  let i = 0;
  replayTimer = setInterval(() => {
    const l = logs[i];
    const label = l.type === "fail" ? "실패" : STAGE_LABEL[l.type];
    box.insertAdjacentHTML("beforeend",
      `<div class="tl-item"><span class="tl-time">${fmtTime(l.t)}</span><span class="tl-dot d-${l.type}"></span><span class="tl-type">${label}</span></div>`);
    box.lastElementChild.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (++i >= logs.length) clearInterval(replayTimer);
  }, 180);
}

/* ==================== Export / Import ==================== */
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function exportLogsCsv() {
  let rows = [["날짜", "시간", "유형", "사이트", "날씨", "비고"]];
  Object.values(Store.getAll()).filter((s) => s && !s.deleted).forEach((s) => {
    (s.logs || []).forEach((l) => {
      let extra = "";
      if (l.type === "fail" || l.type === "close") extra = (s.objections.find((o) => o.t === l.t)?.reasons || []).join(", ");
      rows.push([s.info.date, fmtTime(l.t), l.type === "fail" ? "실패" : STAGE_LABEL[l.type], s.info.site, s.info.weather, extra]);
    });
  });
  download(`fcos_logs_${todayStr()}.csv`, "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
  toast("로그 CSV 다운로드 ✓");
}

function exportRehashCsv() {
  let rows = [["날짜", "시간", "이름", "나이", "성별", "후원금액", "결제수단", "약정코드", "활동장소", "사이트", "특이사항", "기억할 내용", "다음 이야기", "Remark"]];
  allRehashes().forEach((r) => {
    rows.push([r.date, fmtTime(r.t), r.name, r.age, r.gender, r.amount, r.pay, r.code, r.place, r.site, r.note, r.memory, r.next, r.remark]);
  });
  download(`fcos_rehash_${todayStr()}.csv`, "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
  toast("리해쉬 CSV 다운로드 ✓");
}

function exportJson() {
  download(`fcos_backup_${todayStr()}.json`, JSON.stringify(Store.getAll(), null, 2), "application/json");
  toast("JSON 백업 다운로드 ✓");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (typeof data !== "object" || data === null) throw new Error();
      Store.importAll(data);
      loadToday();
      renderHeader(); renderDashboard();
      try { Object.keys(data).forEach((d) => Cloud.queue(d)); } catch (e) {}
      toast("복원 완료 ✓");
    } catch { toast("잘못된 백업 파일입니다"); }
  };
  reader.readAsText(file);
}

/* ==================== PDF Report (Call Back Sheet) ====================
   브라우저 인쇄 대화상자에서 "PDF로 저장"을 누르면 PDF가 생성된다.
   어떤 데이터가 와도 자동 축소로 항상 A4 한 페이지.               */
function buildReportHTML() {
  const { hours, data } = hourlyBuckets();
  const counts = STAGES.map((s) => countType(s));
  const dayNames = ["일","월","화","수","목","금","토"];
  const dObj = new Date(S.info.date + "T00:00:00");
  const dateLabel = `${S.info.date} (${dayNames[dObj.getDay()]})`;

  /* 목표 & 결과 카드 */
  const statCards = STAGES.map((s, i) => {
    const a = counts[i], g = S.goals[s], p = pct(a, g), ok = a >= g;
    return `<div class="stat">
      <div class="stat-label" style="color:${STAGE_COLOR[s]}">${STAGE_LABEL[s]}</div>
      <div class="stat-num">${a}<span class="stat-goal">/ ${g}</span></div>
      <div class="stat-rate ${ok ? "ok" : ""}">${ok ? "달성 " : ""}${p}%</div>
    </div>`;
  }).join("");

  /* 퍼널 전환 */
  const funnel = STAGES.slice(0, -1).map((s, i) => {
    const from = counts[i], to = counts[i + 1];
    return `<div class="fun">
      <div class="fun-top"><b style="color:${STAGE_COLOR[s]}">${STAGE_LABEL[s]} ${from}</b><span class="fun-arrow">→</span><b style="color:${STAGE_COLOR[STAGES[i+1]]}">${STAGE_LABEL[STAGES[i+1]]} ${to}</b></div>
      <div class="fun-pct">${pct(to, from)}%</div>
    </div>`;
  }).join("");

  /* 시간대 표 (기록된 시간대만) */
  const hourRows = hours.map((h) => {
    const d = data[h];
    return `<tr><td class="hr">${h}시</td><td>${d.contact || ""}</td><td>${d.stop || ""}</td><td>${d.presentation || ""}</td><td>${d.close || ""}</td><td>${d.rehash || ""}</td></tr>`;
  }).join("");

  /* 후원자 */
  const donorRows = S.rehashes.map((r) =>
    `<div class="donor">
      <div class="donor-line"><b class="donor-time">${fmtTime(r.t)}</b><b class="donor-name">${esc(r.name) || "이름없음"}</b><span class="donor-meta">${r.age ? r.age + "세" : ""} ${esc(r.gender || "")} · ${r.amount ? Number(r.amount).toLocaleString() + "원" : "-"} · ${esc(r.pay || "")}${r.code ? " · " + esc(r.code) : ""}</span></div>
      ${r.place ? `<div class="donor-memo">장소 · ${esc(r.place)}</div>` : ""}
      ${r.note ? `<div class="donor-memo">특이사항 · ${esc(r.note)}</div>` : ""}
      ${r.memory ? `<div class="donor-memo">기억 · ${esc(r.memory)}</div>` : ""}
      ${r.next ? `<div class="donor-memo">다음 · ${esc(r.next)}</div>` : ""}
      ${r.remark ? `<div class="donor-memo">Remark · ${esc(r.remark)}</div>` : ""}
    </div>`).join("") || `<div class="none-block">기록 없음</div>`;

  /* 오브젝션 */
  const objItems = S.objections.map((o) =>
    `<li>${o.type === "fail" ? `<span class="tag-f">실패</span> ` : ""}<b>${fmtTime(o.t)}</b> · ${esc(o.reasons.join(", "))}</li>`
  ).join("") || `<li class="none">기록 없음</li>`;

  const retroRow = (sign) => ["number", "skill", "attitude"].map((k) =>
    `<td class="retro-cell">${esc(S.retro[k][sign === "+" ? "good" : "bad"]) || "<span class='none'>-</span>"}</td>`).join("");

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>Call Back Sheet — ${S.info.date}</title>
<style>
  @page { size: A4; margin: 9mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif; color:#18181B; font-size:13px; line-height:1.45; padding:24px; }
  #sheet { width:730px; margin:0 auto; }

  .head { display:flex; align-items:flex-end; justify-content:space-between; padding-bottom:10px; border-bottom:3px solid #18181B; margin-bottom:12px; }
  h1 { font-size:27px; font-weight:900; letter-spacing:-.02em; }
  .brand { text-align:right; color:#71717A; font-size:12px; line-height:1.5; }
  .brand b { color:#2563EB; }

  .info { display:flex; flex-wrap:wrap; gap:7px 8px; margin-bottom:14px; }
  .info div { background:#F4F4F5; border-radius:9px; padding:7px 13px; font-size:12.5px; font-weight:600; }
  .info b { color:#2563EB; margin-right:7px; font-weight:800; }

  .stats { display:grid; grid-template-columns:repeat(5,1fr); gap:9px; margin-bottom:12px; }
  .stat { border:1.5px solid #E4E4E7; border-radius:13px; padding:11px 12px 9px; text-align:center; }
  .stat-label { font-size:11.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; margin-bottom:2px; }
  .stat-num { font-size:27px; font-weight:900; letter-spacing:-.02em; }
  .stat-goal { font-size:13px; font-weight:700; color:#A1A1AA; margin-left:4px; }
  .stat-rate { font-size:11.5px; font-weight:800; color:#A1A1AA; margin-top:1px; }
  .stat-rate.ok { color:#16A34A; }

  .funnel { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-bottom:14px; }
  .fun { background:#FAFAFA; border:1px solid #E4E4E7; border-radius:11px; padding:8px 10px; text-align:center; }
  .fun-top { font-size:11.5px; font-weight:700; }
  .fun-arrow { color:#A1A1AA; margin:0 5px; }
  .fun-pct { font-size:17px; font-weight:900; color:#2563EB; margin-top:1px; }

  .sec { font-size:13px; font-weight:900; border-left:5px solid #2563EB; padding-left:9px; margin:0 0 8px; letter-spacing:-.01em; }
  .cols { display:grid; grid-template-columns:300px 1fr; gap:13px; margin-bottom:14px; align-items:start; }

  table { width:100%; border-collapse:collapse; }
  th,td { border:1px solid #E4E4E7; padding:7px 6px; text-align:center; font-size:12.5px; }
  th { background:#F4F4F5; font-size:11.5px; font-weight:800; }
  .hr { font-weight:800; background:#FAFAFA; width:52px; }
  .sum td { background:#F8FAFF; font-weight:800; }

  .panel { border:1.5px solid #E4E4E7; border-radius:12px; overflow:hidden; }
  .panel h3 { background:#F4F4F5; font-size:12px; font-weight:800; padding:7px 12px; border-bottom:1px solid #E4E4E7; }
  .donor { padding:8px 13px; border-bottom:1px solid #F1F1F3; }
  .donor:last-child { border-bottom:none; }
  .donor-line { display:flex; align-items:baseline; gap:9px; }
  .donor-time { color:#2563EB; font-size:12px; }
  .donor-name { font-size:14px; font-weight:800; }
  .donor-meta { color:#52525B; font-size:12px; }
  .donor-memo { color:#71717A; font-size:11.5px; margin-top:2px; padding-left:2px; }
  .none-block { padding:12px; color:#A1A1AA; text-align:center; }

  .obj-panel ol { padding:8px 13px 9px 30px; }
  .obj-panel li { margin-bottom:4px; font-size:12.5px; }
  .obj-panel.two-col ol { columns:2; column-gap:18px; }
  .obj-panel li b { color:#2563EB; font-weight:700; }
  .tag-f { font-size:10.5px; font-weight:800; border-radius:5px; padding:1px 6px; background:#FEE2E2; color:#DC2626; }
  .none { color:#A1A1AA; }

  .retro-table th { padding:8px; }
  .retro-cell { text-align:left; vertical-align:top; white-space:pre-wrap; width:31%; padding:10px 12px; font-size:12.5px; line-height:1.5; }
  .pm { width:92px; font-weight:800; background:#F4F4F5; color:#52525B; font-size:11.5px; white-space:nowrap; }

  .footer { display:flex; justify-content:space-between; color:#A1A1AA; font-size:10.5px; margin-top:12px; padding-top:8px; border-top:1px solid #E4E4E7; }
  .noprint { text-align:center; margin-bottom:14px; }
  .noprint button { background:#2563EB; color:#fff; border:none; border-radius:8px; padding:10px 22px; font-size:14px; font-weight:700; cursor:pointer; }
  @media print { .noprint { display:none; } body { padding:0; } html, body { height:auto; } }
</style></head><body>
<div class="noprint"><button onclick="window.print()">📑 PDF로 저장 / 인쇄</button></div>
<div id="sheet">

<div class="head">
  <h1>CALL BACK SHEET</h1>
  <div class="brand"><b>Presence</b> · Field Callback OS<br>${dateLabel}</div>
</div>

<div class="info">
  <div><b>Name</b>${esc(S.info.name) || "-"}</div>
  <div><b>Team</b>${esc(S.info.team) || "-"}</div>
  <div><b>Site</b>${esc(S.info.site) || "-"}</div>
  <div><b>Weather</b>${esc(S.info.weather) || "-"}</div>
  ${S.info.theme ? `<div><b>Theme</b>${esc(S.info.theme)}</div>` : ""}
</div>

<div class="sec">오늘의 목표 &amp; 결과</div>
<div class="stats">${statCards}</div>
<div class="funnel">${funnel}</div>

<div class="cols">
  <div>
    <div class="sec">시간대별 활동</div>
    <table>
      <tr><th>시간</th><th>C</th><th>S</th><th>PT</th><th>Cl</th><th>Rh</th></tr>
      ${hourRows}
      <tr class="sum"><td class="hr">합계</td>${counts.map((c) => `<td>${c}</td>`).join("")}</tr>
    </table>
  </div>
  <div>
    <div class="sec">후원자 — Rehash ${S.rehashes.length}건</div>
    <div class="panel">${donorRows}</div>
  </div>
</div>

<div class="sec">오브젝션 핸들링 ${S.objections.length}건</div>
<div class="panel obj-panel ${S.objections.length > 5 ? "two-col" : ""}"><ol>${objItems}</ol></div>

<div class="sec" style="margin-top:14px">Analysis &amp; Evaluation — 내일을 위한 복기</div>
<table class="retro-table">
  <tr><th class="pm"></th><th>Number</th><th>Pitch (Skill)</th><th>Attitude (Mental)</th></tr>
  <tr><td class="pm">잘한 점 ＋</td>${retroRow("+")}</tr>
  <tr><td class="pm">아쉬운 점 －</td>${retroRow("-")}</tr>
</table>

<div class="footer"><span>환경을 탓하지 말고 나의 노력을 탓하라</span><span>Field Callback OS · ${new Date().toLocaleString("ko-KR")}</span></div>
</div><!-- /#sheet -->
<script>
/* 어떤 데이터가 와도 A4 한 장에 담기게 — 내용은 절대 자르지 않고 글자만 작아진다.
   (1) 회고 셀 글자 12.5px→8px 단계 축소 (2) 그래도 넘치면 전체 zoom을 0.3까지 허용 */
window.addEventListener("load", () => {
  const sheet = document.getElementById("sheet");
  const PAGE_H = 1035;
  const fit = () => {
    sheet.style.zoom = "";
    const cells = sheet.querySelectorAll(".retro-cell");
    const sizes = [12.5, 11.5, 10.5, 9.5, 9, 8.5, 8];
    for (const fs of sizes) {
      cells.forEach((c) => { c.style.fontSize = fs + "px"; c.style.lineHeight = "1.35"; });
      if (sheet.scrollHeight <= PAGE_H) break;
    }
    const h = sheet.scrollHeight;
    if (h > PAGE_H) sheet.style.zoom = Math.max(0.3, PAGE_H / h).toFixed(3);
  };
  const done = () => { fit(); setTimeout(() => window.print(), 300); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(done); else done();
});
<\/script>
</body></html>`;
}

function openPdfReport() {
  const w = window.open("", "_blank");
  if (!w) { toast("팝업을 허용해주세요"); return; }
  w.document.write(buildReportHTML());
  w.document.close();
}

/* ==================== Utils ==================== */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ==================== Events ==================== */
function bind() {
  // nav
  document.body.addEventListener("click", (e) => {
    const navBtn = e.target.closest("[data-nav]");
    if (navBtn) nav(navBtn.dataset.nav);
  });

  // plan
  ["p-hours", "p-start", ...STAGES.map((s) => "p-g-" + s)].forEach((id) =>
    $(id).addEventListener("input", renderHourlyGoals));
  $("p-date").addEventListener("change", (e) => switchDate(e.target.value));
  $("btn-save-plan").addEventListener("click", () => {
    readPlanInputs(); save(); renderHeader();
    toast("계획 저장 ✓"); nav("do");
  });

  // 헤더 사이트 칩 클릭 → 이 날짜의 사이트 소급 수정 (헤더에서 칩을 뺐으면 없음 — Plan 탭에서 수정)
  const _siteChip = $("header-site");
  if (_siteChip) _siteChip.addEventListener("click", () => {
    const v = prompt(`${S.info.date} 세션의 사이트를 입력하세요.\n(달력으로 지난 날짜로 이동한 뒤 누르면 소급 수정됩니다)\n예: 롯데마트시화점 E/C/22470`, S.info.site || "");
    if (v === null) return;
    S.info.site = v.trim();
    save();
    renderHeader();
    const vis = document.querySelector(".view:not(.hidden)");
    const cur = vis ? vis.id.replace("view-", "") : "";
    if (cur === "see") renderSee();
    else if (cur === "plan") renderPlan();
    else if (cur === "do") renderDo();
    else if (cur === "dashboard") renderDashboard();
    toast(S.info.site ? `사이트 수정 ✓ — ${S.info.date} 통계에 반영` : "사이트를 비웠어요");
  });

  // 세션 날짜 달력 (Do·See) — 과거 날짜 선택해 열람·수정
  const dateJump = (val, needConfirm) => {
    if (!val) return;
    if (val === S.info.date) return;
    if (needConfirm) {
      const ex = Store.getSession(val);
      const has = ex && ((ex.logs && ex.logs.length) || (ex.rehashes && ex.rehashes.length));
      const msg = has
        ? `${val} 세션에는 완료된 기록이 있습니다.\n이 날짜의 데이터를 수정하시겠습니까?`
        : `${val} 날짜의 세션을 새로 작성/수정할까요?`;
      if (val !== todayStr() && !confirm(msg)) { renderDo(); renderSee(); return; }
    }
    switchDate(val);
  };
  const dd = $("do-date"), sd = $("see-date");
  if (dd) dd.addEventListener("change", (e) => dateJump(e.target.value, true));
  if (sd) sd.addEventListener("change", (e) => dateJump(e.target.value, false));
  const backToday = () => { if (S.info.date !== todayStr()) switchDate(todayStr()); };
  const dtb = $("do-today-btn"), stb = $("see-today-btn");
  if (dtb) dtb.addEventListener("click", backToday);
  if (stb) stb.addEventListener("click", backToday);

  // do buttons
  // CLOSE → 오브젝션 선택창, REHASH → 후원자 정보 작성창
  $$("[data-log]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const type = btn.dataset.log;
      if (type === "close") openObjection();
      else if (type === "rehash") openRehash();
      else addLog(type);
    }));
  $("btn-undo").addEventListener("click", () => {
    if (S.logs.length) deleteLog(S.logs.length - 1);
  });
  $("btn-manual").addEventListener("click", () => openManual());
  $("btn-save-manual").addEventListener("click", saveManual);
  $("time-mode").addEventListener("click", (e) => {
    const c = e.target.closest("[data-tm]");
    if (!c) return;
    logMode = c.dataset.tm === "now" ? "now" : parseInt(c.dataset.tm, 10);
    renderDo();
    toast(logMode === "now" ? "현재 시간으로 기록합니다" : `${logMode}시 기록 모드 ON`);
  });
  ["range-from", "range-to"].forEach((id) =>
    $(id).addEventListener("change", () => {
      let from = parseInt($("range-from").value, 10);
      let to = parseInt($("range-to").value, 10);
      if (to < from) [from, to] = [to, from];
      S.range = { from, to };
      if (logMode !== "now" && (logMode < from || logMode > to)) logMode = "now";
      save();
      renderDo();
      toast(`기록 범위: ${from}시 ~ ${to}시`);
    }));
  $("do-timeline").addEventListener("click", (e) => {
    const rh = e.target.closest("[data-rh]");
    if (rh) { openRehashEdit(S.logs[parseInt(rh.dataset.rh, 10)]); return; }
    const del = e.target.closest("[data-del]");
    if (del) { deleteLog(parseInt(del.dataset.del, 10)); return; }
    const edit = e.target.closest("[data-edit]");
    if (edit) openManual(S.logs[parseInt(edit.dataset.edit, 10)]);
  });

  // modals
  $("btn-save-objection").addEventListener("click", saveObjection);
  $("btn-save-rehash").addEventListener("click", saveRehash);
  $$("#modal-rehash .seg-btn").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#modal-rehash .seg-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    }));
  $$("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModals));
  $$(".modal-backdrop").forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target === m) closeModals(); }));

  // see
  $$("#obj-chart-toggle .seg-btn").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#obj-chart-toggle .seg-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      objChartType = b.dataset.objchart;
      renderObjChart();
    }));
  ["rh-search", "rh-date", "rh-site", "rh-pay"].forEach((id) =>
    $(id).addEventListener("input", renderRehashList));
  $("btn-replay").addEventListener("click", replay);
  $("btn-save-retro").addEventListener("click", saveRetro);

  // export
  $("btn-pdf-report").addEventListener("click", openPdfReport);
  $("btn-csv-logs").addEventListener("click", exportLogsCsv);
  $("btn-csv-rehash").addEventListener("click", exportRehashCsv);
  $("btn-json-export").addEventListener("click", exportJson);
  $("json-import").addEventListener("change", (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = "";
  });

  // live dashboard refresh
  setInterval(() => {
    if (!$("view-dashboard").classList.contains("hidden")) renderDashboard();
  }, 30000);
}

/* ==================== PWA ==================== */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      reg.update();
      setInterval(() => reg.update(), 60000);   // 1분마다 새 버전 확인 → 모든 기기 자동 최신화
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) nw.postMessage("skipWaiting");
        });
      });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return; reloaded = true; location.reload();   // 새 버전 적용되면 1회 새로고침
    });
  });
}

/* ==================== Init ====================
   (실제 초기화 실행은 파일 맨 끝 — 모든 모듈 정의 이후) */

/* ════════════════════════════════════════════════════════════════════
   HUB SYNC — 프레젠스 허브 리젝노트 자동 연동 (v1)
   Close→Rehash(후원자)가 저장되면 presence.co.kr 허브의
   rejectnotes/{uid}/{id} 에 '관찰중(open)' 상태로 자동 등록됩니다.
   - REST 방식(PUT)이라 SDK 불필요 · 오프라인이면 다음 접속 때 재시도
   - id가 rehash 타임스탬프로 고정(rn_cb_{t}) → 몇 번 돌려도 중복 0
   ════════════════════════════════════════════════════════════════════ */
const HUB_DB = "https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app";
const HUB_ID_KEY = "fcos_hub_identity";   // {uid,name}
const HUB_SYNCED_KEY = "fcos_hub_synced"; // {rn_cb_t:1,...}

const Hub = {
  _activeCache: { uid: "", ok: false, at: 0 },
  identity() { try { return JSON.parse(localStorage.getItem(HUB_ID_KEY)); } catch (e) { return null; } },
  setIdentity(v) {
    let prev = null; try { prev = JSON.parse(localStorage.getItem(HUB_ID_KEY)); } catch (e) {}
    const uidChanged = !prev || prev.uid !== (v && v.uid);
    localStorage.setItem(HUB_ID_KEY, JSON.stringify(v)); this.badge();
    /* 관리자로 연결된 적 있는 기기 표시 — 이후 팀원 계정을 열어봐도 잠기지 않음 */
    if (v && (v.uid === "admin" || v.name === "임재영")) localStorage.setItem("fcos_was_admin", "1");
    /* 계정이 바뀌면 새 계정 전용 저장소로 다시 시작 (데이터 섞임 방지).
       ★ localStorage 쓰기 직후 동기적으로 Cloud를 끊어, 이전 uid로 열린
       SSE 스트림·진행 중 fetch 응답이 새 계정 저장소에 이전 데이터를 쓰거나
       새 uid 클라우드로 재업로드하는 교차 오염을 원천 차단 */
    if (uidChanged) {
      try { Cloud.shutdown(); } catch (e) {}
      setTimeout(() => location.reload(), 700);
    }
  },
  synced() { try { return JSON.parse(localStorage.getItem(HUB_SYNCED_KEY)) || {}; } catch (e) { return {}; } },
  markSynced(id) { const m = this.synced(); m[id] = 1; localStorage.setItem(HUB_SYNCED_KEY, JSON.stringify(m)); },

  /* rehash {t,date,site,name,age,gender,amount,pay,code,place,note,memory,next,remark}
     → 허브 rejectnotes 레코드 (허브 폼과 동일 스키마) */
  toRN(r, who) {
    const yr = new Date().getFullYear();
    const amt = r.amount ? (Math.round(Number(r.amount) / 10000) + "만") : "3만";
    const memoBits = [r.name ? (r.name + (r.age ? "(" + r.age + "세)" : "")) : "", r.note || "", r.memory || "", r.next || "", r.remark || ""]
      .filter(Boolean).join(" · ");
    return {
      id: "rn_cb_" + r.t, t: r.t, date: r.date || new Date().toISOString().slice(0, 10),
      client: "옥스팜", city: "시티", chan: "스트릿", code: r.code || "",
      amount: amt, pay: (r.pay === "카드" ? "카드" : "계좌"), cycle: "매월",
      birth: r.age ? String(yr - Number(r.age)) : "", gender: (r.gender === "남" ? "남" : "여"),
      name: r.name || "",
      owner: who.name, place: r.place || r.site || "", obj: [], memo: memoBits + " · 콜백싯 연동",
      status: "open", rejReason: "", rejProb: "", by: who.name, byUid: who.uid
    };
  },

  async put(uid, rec) {
    const res = await fetch(HUB_DB + "/rejectnotes/" + uid + "/" + rec.id + ".json", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec)
    });
    if (!res.ok) throw new Error("hub " + res.status);
    return rec.id;
  },

  allRehashes() { return Object.values(Store.getAll()).filter((s) => s && !s.deleted).flatMap((s) => s.rehashes || []); },

  async activeIdentity(who) {
    if (!who || !who.uid) return false;
    if (who.uid === "admin" || who.name === "임재영") return true;
    if (this._activeCache.uid === who.uid && Date.now() - this._activeCache.at < 60000) return this._activeCache.ok;
    let profile = null, removed = [];
    try {
      [profile, removed] = await Promise.all([
        fetch(HUB_DB + "/users/" + encodeURIComponent(who.uid) + ".json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json()),
        fetch(HUB_DB + "/removedMembers.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      ]);
    } catch (e) { return true; }
    const nrm = (s) => String(s || "").replace(/\s+/g, "");
    const removedSet = new Set((Array.isArray(removed) ? removed : Object.values(removed || {})).map(nrm));
    const ok = !!(profile && profile.name && profile.status === "active" && nrm(profile.name) === nrm(who.name) && !removedSet.has(nrm(who.name)));
    this._activeCache = { uid: who.uid, ok, at: Date.now() };
    return ok;
  },

  revokeIdentity(who) {
    const localKey = Store.KEY;
    try { Cloud.shutdown(); } catch (e) {}
    localStorage.removeItem(HUB_ID_KEY);
    localStorage.removeItem(localKey);
    localStorage.removeItem(HUB_SYNCED_KEY);
    localStorage.removeItem("fcos_locked");
    this.badge();
    this.toast((who && who.name ? who.name + "님은 " : "") + "활성 팀원 명단에서 제외되어 콜백 연결을 종료했습니다");
  },

  async syncAll(showToast) {
    const who = this.identity(); if (!who) return 0;
    if (!(await this.activeIdentity(who))) { this.revokeIdentity(who); return 0; }
    const done = this.synced(); let n = 0;
    for (const r of this.allRehashes()) {
      const id = "rn_cb_" + r.t;
      if (done[id]) continue;
      try { await this.put(who.uid, this.toRN(r, who)); this.markSynced(id); n++; }
      catch (e) { console.warn("[HubSync]", e.message); break; }
    }
    if (n && showToast !== false) this.toast("허브 리젝노트에 " + n + "건 연동 ✓");
    this.badge();
    return n;
  },

  /* ---- 계정 연결 피커 ---- */
  async openPicker() {
    let users = {}, removed = [];
    try {
      [users, removed] = await Promise.all([
        fetch(HUB_DB + "/users.json").then((r) => r.json()).then((v) => v || {}),
        fetch(HUB_DB + "/removedMembers.json").then((r) => r.json()).then((v) => v || []).catch(() => []),
      ]);
    }
    catch (e) { this.toast("허브 연결 실패 — 인터넷 확인"); return; }
    const nrm = (s) => String(s || "").replace(/\s+/g, "");
    const rmSet = new Set((removed || []).map(nrm));
    const isAdminU = (u) => u.uid === "admin" || u.name === "임재영";
    const list = Object.values(users).filter((u) => u && u.name && u.status !== "retired" && !u.test && !rmSet.has(nrm(u.name)));
    const old = document.getElementById("hub-picker"); if (old) old.remove();
    const ov = document.createElement("div"); ov.id = "hub-picker";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(15,18,24,.55);z-index:99;display:flex;align-items:center;justify-content:center;padding:20px";
    const box = document.createElement("div");
    box.style.cssText = "background:#fff;border-radius:18px;padding:20px;max-width:420px;width:100%;max-height:70vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.3)";
    box.innerHTML = "<div style='font-weight:800;font-size:16px;margin-bottom:4px'>허브 계정 연결</div>" +
      "<div style='font-size:13px;color:#6b7482;margin-bottom:14px'>후원자 정보가 이 계정의 리젝노트로 들어갑니다</div>";
    /* 임재영(AOP)을 항상 맨 위에 고정, 나머지는 이름순 */
    list.sort((a, b) => {
      const aa = isAdminU(a), bb = isAdminU(b);
      if (aa !== bb) return aa ? -1 : 1;
      return a.name > b.name ? 1 : -1;
    }).forEach((u) => {
      const b = document.createElement("button");
      const admin = isAdminU(u);
      const role = u.role || (admin ? "AOP" : "");
      b.textContent = (admin ? "👑 " : "") + u.name + (role ? " · " + role : "");
      b.style.cssText = "display:block;width:100%;text-align:left;padding:12px 14px;margin:6px 0;border:1.5px solid #e5e9f0;border-radius:12px;background:#f8fafc;font-weight:700;font-size:14px;cursor:pointer";
      b.onclick = () => { this.setIdentity({ uid: u.uid, name: u.name }); ov.remove(); this.toast(u.name + "님으로 연결 ✓"); this.syncAll(); };
      box.appendChild(b);
    });
    const x = document.createElement("button"); x.textContent = "닫기";
    x.style.cssText = "margin-top:10px;padding:10px 14px;border:0;border-radius:10px;background:#eef1f6;font-weight:700;cursor:pointer;width:100%";
    x.onclick = () => ov.remove(); box.appendChild(x);
    ov.appendChild(box); document.body.appendChild(ov);
  },

  toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#0f1218;color:#fff;padding:10px 16px;border-radius:12px;font-size:13.5px;font-weight:700;z-index:120;box-shadow:0 8px 24px rgba(0,0,0,.35)";
    document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
  },

  badge() {
    let b = document.getElementById("hub-badge");
    if (!b) {
      b = document.createElement("button"); b.id = "hub-badge";
      b.style.cssText = "border:0;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;line-height:1;display:inline-flex;align-items:center;gap:2px";
      const meta = document.querySelector(".header-meta"); if (meta) meta.appendChild(b); else document.body.appendChild(b);
      b.onclick = () => this.openPicker();
    }
    const who = this.identity();
    b.textContent = who ? "✓ " + shortName(who.name) : "허브 연결";
    b.title = who ? "허브 계정: " + who.name + " (탭하면 계정 변경)" : "허브 연결";
    b.style.background = who ? "#DCFCE7" : "#FEE2E2";
    b.style.color = who ? "#166534" : "#991B1B";
  },

  init() {
    this.badge();
    // 후원자 저장 버튼 뒤에 동기화 (원본 리스너 다음 순서로 실행됨)
    const btn = document.getElementById("btn-save-rehash");
    if (btn) btn.addEventListener("click", () => setTimeout(() => this.syncAll(false).then((n) => { if (n) this.toast("리젝노트 등록 ✓ (관찰중)"); }), 400));
    // 진입 시 + 온라인 복귀 시 미전송분 재시도
    setTimeout(() => this.syncAll(false), 2000);
    window.addEventListener("online", () => this.syncAll(false));
  }
};
Hub.init();

/* ════════════════════════════════════════════════════════════════════
   CLOUD SYNC v2 — 콜백싯 세션 "전체" 실시간 동기화 (아이폰 ↔ 아이패드)
   지금까지는 각 기기의 localStorage에만 저장돼 기기 간 데이터가 달랐음.
   이제 모든 세션(타임라인·후원자·회고·목표)이 허브 Firebase의
   callbacksheets/{uid}/{날짜} 에 저장되고, 다른 기기의 변경은
   SSE 스트림으로 실시간 수신됩니다.
   - 병합은 기록 합집합 방식 → 두 기기에 나뉜 기록도 합쳐짐 (유실 0)
   - 삭제는 tombstone 표식 → 지운 기록이 되살아나지 않음
   - 상단 ☁ 배지로 상태 확인, "허브 연결"로 계정을 잡아야 작동
   ════════════════════════════════════════════════════════════════════ */
const Cloud = {
  started: false, es: null, pushT: {}, pullT: null, status: "off", _tt: null,

  uid() { const w = Hub.identity(); return w && w.uid; },

  /* 계정 전환 시 이전 uid로 열린 모든 연결/타이머 즉시 정리 (교차 오염 차단) */
  shutdown() {
    try { if (this.es) this.es.close(); } catch (e) {}
    this.es = null;
    Object.keys(this.pushT).forEach((k) => clearTimeout(this.pushT[k]));
    this.pushT = {};
    clearTimeout(this.pullT); this.pullT = null;
    this.started = false;
  },

  /* ---- 두 세션 병합: 합집합 + tombstone + 최신 정보 우선 ---- */
  merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    /* 세션 레벨 tombstone — 한쪽이 삭제 표식이면 up이 큰 쪽을 따른다.
       (팀원이 이후 그 날짜에 새로 기록하면 up이 더 커져 자연 부활 — 정상) */
    if (a.deleted || b.deleted) {
      const nwd = (b.up || 0) >= (a.up || 0) ? b : a;
      if (nwd.deleted) {
        const date = (nwd.info && nwd.info.date) || (a.info && a.info.date) || (b.info && b.info.date) || "";
        return { deleted: true, info: { date }, up: Math.max(a.up || 0, b.up || 0) };
      }
      return nwd;
    }
    const rawTomb = Object.assign({}, a.tomb || {}, b.tomb || {});
    const tomb = {}; for (const tk in rawTomb) tomb[fbKey(tk)] = rawTomb[tk];   // 키 안전화(점 등 제거) — PUT 400 방지
    const nw = (b.up || 0) >= (a.up || 0) ? b : a;
    const od = nw === a ? b : a;
    const filled = (n, o) => {
      const out = {}; const keys = new Set([...Object.keys(n || {}), ...Object.keys(o || {})]);
      keys.forEach((k) => { const v = (n || {})[k]; out[k] = (v === "" || v == null) ? (o || {})[k] : v; });
      return out;
    };
    /* ── 로그 병합: 정확히 같은 기록은 1개로, 시간대(시)+유형별로는
       "두 기기 중 많은 쪽" 개수만 유지 → 같은 날을 두 기기에 넣어도 2배가 되지 않음 ── */
    const clean = (arr, keyEx) => (arr || []).filter((it) => it && !tomb[keyEx(it)]);
    const exK = (l) => fbKey("l:" + l.t + "|" + l.type);
    const hrK = (l) => String(l.t).slice(0, 13) + "|" + l.type;
    const nLogs = clean(nw.logs, exK), oLogs = clean(od.logs, exK);
    const seen = {}, nCnt = {}, oCnt = {};
    nLogs.forEach((l) => { seen[exK(l)] = 1; nCnt[hrK(l)] = (nCnt[hrK(l)] || 0) + 1; });
    oLogs.forEach((l) => { oCnt[hrK(l)] = (oCnt[hrK(l)] || 0) + 1; });
    const extra = {};
    Object.keys(oCnt).forEach((k) => { extra[k] = Math.max(0, oCnt[k] - (nCnt[k] || 0)); });
    const logs = [...nLogs];
    oLogs.forEach((l) => {
      const k = exK(l); if (seen[k]) return;
      const h = hrK(l); if ((extra[h] || 0) <= 0) return;
      extra[h]--; seen[k] = 1; logs.push(l);
    });
    logs.sort((p, q) => String(p.t).localeCompare(String(q.t)));
    /* 오브젝션: 같은 방식 (시간대별 max) */
    const exO = (o) => fbKey("o:" + o.t);
    const hrO = (o) => "o" + String(o.t).slice(0, 13);
    const nObj = clean(nw.objections, exO), oObj = clean(od.objections, exO);
    const oSeen = {}, onCnt = {}, ooCnt = {};
    nObj.forEach((o) => { oSeen[exO(o)] = 1; onCnt[hrO(o)] = (onCnt[hrO(o)] || 0) + 1; });
    oObj.forEach((o) => { ooCnt[hrO(o)] = (ooCnt[hrO(o)] || 0) + 1; });
    const oExtra = {};
    Object.keys(ooCnt).forEach((k) => { oExtra[k] = Math.max(0, ooCnt[k] - (onCnt[k] || 0)); });
    const objections = [...nObj];
    oObj.forEach((o) => {
      const k = exO(o); if (oSeen[k]) return;
      const h = hrO(o); if ((oExtra[h] || 0) <= 0) return;
      oExtra[h]--; oSeen[k] = 1; objections.push(o);
    });
    /* 후원자: 날짜+이름 기준 1건 (같은 후원자가 두 기기에 있어도 중복 없음) */
    const rk = (r) => (r.name ? "r:" + (r.date || "") + "|" + String(r.name).replace(/\s+/g, "") : "rt:" + r.t);
    const rMap = {};
    clean(nw.rehashes, (r) => fbKey("r:" + r.t)).forEach((r) => { rMap[rk(r)] = r; });
    clean(od.rehashes, (r) => fbKey("r:" + r.t)).forEach((r) => { if (!rMap[rk(r)]) rMap[rk(r)] = r; });
    const rehashes = Object.values(rMap);
    const retro = {};
    ["number", "skill", "attitude"].forEach((k) => { retro[k] = filled((nw.retro || {})[k] || {}, (od.retro || {})[k] || {}); });
    const out = {
      info: filled(nw.info, od.info),
      goals: Object.assign({}, od.goals || {}, nw.goals || {}),
      logs, objections, rehashes, retro, tomb,
      up: Math.max(a.up || 0, b.up || 0),
    };
    if (nw.range || od.range) out.range = nw.range || od.range;
    return out;
  },

  /* Firebase는 빈 배열을 지워버리므로 복원 */
  normalize(r) {
    if (r && r.deleted) return r;   // tombstone 세션은 배열 복원 없이 그대로
    ["logs", "objections", "rehashes"].forEach((k) => {
      if (!Array.isArray(r[k])) r[k] = r[k] ? Object.values(r[k]) : [];
    });
    if (!r.retro) r.retro = { number: { good: "", bad: "" }, skill: { good: "", bad: "" }, attitude: { good: "", bad: "" } };
    if (!r.tomb) r.tomb = {};
    /* 옛 삭제표식 키(점 포함)를 Firebase 안전 키로 마이그레이션 — 예전 삭제도 그대로 유지 */
    { const t2 = {}; for (const k in r.tomb) t2[fbKey(k)] = r.tomb[k]; r.tomb = t2; }
    return r;
  },

  /* ---- 원격 데이터 반영 ---- */
  applyRemote(remote) {
    if (!remote || typeof remote !== "object") return;
    const all = Store.getAll();
    let changed = false, curChanged = false;
    Object.keys(remote).forEach((d) => {
      const r = remote[d];
      if (!r || !r.info) return;
      this.normalize(r);
      const loc = all[d];
      const m = this.merge(loc, r);
      if (JSON.stringify(m) !== JSON.stringify(loc || null)) {
        all[d] = m; changed = true;
        if (S && S.info.date === d) curChanged = true;
      }
      // 병합 결과가 원격과 다르면 (로컬에만 있던 기록 존재) 재업로드
      if (JSON.stringify(m) !== JSON.stringify(r)) this.queue(d);
    });
    if (changed) {
      Store.importAll(all);
      S = Store.getSession(S.info.date) || S;
      /* 어떤 날짜든 새 데이터가 오면 화면 갱신 (최근 7일·사이트 통계 포함) */
      this.rerender();
      this.toastOnce("☁️ 서버 기록을 불러왔어요");
    }
  },

  rerender() {
    try {
      renderHeader();
      const vis = document.querySelector(".view:not(.hidden)");
      if (!vis) return;
      const id = vis.id.replace("view-", "");
      if (id === "dashboard") renderDashboard();
      else if (id === "plan") renderPlan();
      else if (id === "do") renderDo();
      else if (id === "see") renderSee();
    } catch (e) {}
  },

  /* ---- 업로드 (저장할 때마다 자동, 0.7초 디바운스) ---- */
  queue(date) {
    const uid = this.uid(); if (!uid || !date) return;
    clearTimeout(this.pushT[date]);
    this.pushT[date] = setTimeout(() => this.push(date), 700);
  },
  async push(date) {
    const uid = this.uid(); if (!uid) return;
    let s = Store.getSession(date); if (!s) return;
    try {
      /* ★ 업로드 전 서버 데이터와 병합 — 빈/부분 세션이 서버 기록을
         통째로 덮어쓰는 사고를 원천 차단 */
      try {
        const remote = await fetch(HUB_DB + "/callbacksheets/" + uid + "/" + date + ".json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
        if (this.uid() !== uid) return;   // 요청 중 계정 전환 → 폐기
        if (remote && remote.info) {
          this.normalize(remote);
          const m = this.merge(s, remote);
          if (JSON.stringify(m) !== JSON.stringify(s)) {
            const all = Store.getAll(); all[date] = m; Store.importAll(all);
            if (S && S.info.date === date) { if (!m.deleted) S = m; this.rerender(); }
            s = m;
          }
        }
      } catch (e) {}
      if (this.uid() !== uid) return;   // PUT 직전 재확인 → 새 계정 데이터가 이전 uid로 새지 않게
      const res = await fetch(HUB_DB + "/callbacksheets/" + uid + "/" + date + ".json", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error("push " + res.status);
      this.setStatus("on");
      return true;
    } catch (e) {
      this.setStatus("err");
      setTimeout(() => this.queue(date), 8000);   // 오프라인 → 자동 재시도
      return false;
    }
  },

  /* 강제 동기화 — 로컬 모든 세션을 허브로 즉시 밀어올리고 다시 내려받음.
     실시간 스트림이 안 붙어도 이 버튼으로 바로 올릴 수 있음. */
  async forceSync() {
    const uid = this.uid(); if (!uid) { Hub.openPicker(); return; }
    Hub.toast("☁️ 강제 동기화 중…");
    const all = Store.getAll();
    const dates = Object.keys(all).filter((d) => all[d] && !all[d].deleted);
    let ok = 0, fail = 0;
    for (const d of dates) { (await this.push(d)) ? ok++ : fail++; }
    try { await this.pullAll(); } catch (e) {}
    Hub.toast(fail ? `⚠️ 업로드 ${ok}건 성공 · ${fail}건 실패 — 인터넷/네트워크 확인` : `✓ ${ok}건 허브에 올렸어요`);
  },

  /* ---- 전체 내려받기 + 로컬에만 있는 세션 업로드 ---- */
  async pullAll() {
    const uid = this.uid(); if (!uid) return;
    try {
      const v = await fetch(HUB_DB + "/callbacksheets/" + uid + ".json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
      if (this.uid() !== uid) return;   // 응답 도착 전 계정 전환 → 폐기 (교차 오염 차단)
      this.applyRemote(v || {});
      const all = Store.getAll();
      Object.keys(all).forEach((d) => { if (!v || !v[d]) this.queue(d); });
      this.setStatus("on");
    } catch (e) { this.setStatus("err"); }
  },

  /* ---- 실시간 수신 (Firebase SSE 스트림) ---- */
  stream() {
    const uid = this.uid(); if (!uid || this.es) return;
    try {
      this.es = new EventSource(HUB_DB + "/callbacksheets/" + uid + ".json");
      const onEv = (e) => {
        if (this.uid() !== uid) return;   // 계정 전환 후 잔여 이벤트 무시
        try {
          const d = JSON.parse(e.data);
          if (!d || d.data === null) return;
          const parts = (d.path || "/").split("/").filter(Boolean);
          if (parts.length === 0) this.applyRemote(d.data || {});
          else if (parts.length === 1) this.applyRemote({ [parts[0]]: d.data });
          else { clearTimeout(this.pullT); this.pullT = setTimeout(() => this.pullAll(), 600); }
        } catch (err) {}
      };
      this.es.addEventListener("put", onEv);
      this.es.addEventListener("patch", onEv);
      this.es.onerror = () => {
        try { this.es.close(); } catch (e) {}
        this.es = null;
        /* 실시간 스트림만 잠깐 끊긴 경우 — 읽기가 되면 "실시간" 유지(pullAll이 on으로 세팅),
           읽기까지 실패할 때만 오프라인 표시. 3초 후 스트림 재접속. */
        this.pullAll().finally(() => setTimeout(() => { if (!this.es) this.stream(); }, 3000));
      };
    } catch (e) {}
  },

  /* ---- 상단 ☁ 상태 배지 ---- */
  setStatus(st) {
    this.status = st;
    let b = document.getElementById("cloud-badge");
    if (!b) {
      b = document.createElement("button");
      b.id = "cloud-badge";
      b.style.cssText = "border:0;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;line-height:1;display:inline-flex;align-items:center;gap:2px";
      const meta = document.querySelector(".header-meta");
      if (meta) meta.appendChild(b); else document.body.appendChild(b);
      b.onclick = () => {
        if (!this.uid()) Hub.openPicker();
        else this.forceSync();
      };
    }
    b.title = "탭하면 강제 동기화";
    if (!this.uid()) { b.textContent = "☁ 연결"; b.style.background = "#FEE2E2"; b.style.color = "#991B1B"; }
    else if (st === "on") { b.textContent = "☁ 실시간"; b.style.background = "#DCFCE7"; b.style.color = "#166534"; }
    else { b.textContent = "☁ 오프라인"; b.style.background = "#FEF3C7"; b.style.color = "#92400E"; }
  },

  toastOnce(msg) {
    clearTimeout(this._tt);
    this._tt = setTimeout(() => Hub.toast(msg), 300);
  },

  start() {
    if (this.started) return;
    if (!this.uid()) { this.setStatus("off"); return; }
    this.started = true;
    this.pullAll().then(() => this.stream());
  },
  init() {
    this.setStatus("off");
    this.start();
    // 허브 계정이 나중에 연결돼도 자동 시작
    setInterval(() => { if (!this.started) this.start(); }, 3000);
    window.addEventListener("online", () => {
      if (this.started) { this.pullAll(); if (!this.es) this.stream(); }
    });
    // 앱으로 돌아올 때마다 최신 데이터 확인 + 스트림 살아있는지 점검
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.started) { this.pullAll(); if (!this.es) this.stream(); }
    });
    // 8초마다 스트림 생존 점검 — 끊겼으면 자동 복구 (모든 기기 항상 실시간 유지)
    setInterval(() => { if (this.uid() && this.started && !this.es) { this.pullAll(); this.stream(); } }, 8000);
    this.addResetButton();
  },

  /* 🔄 강제 업데이트 버튼 — 옛 캐시(서비스워커)에 갇힌 기기를 최신 버전으로 강제 갱신 */
  addResetButton() {
    setTimeout(() => {
      const meta = document.querySelector(".header-meta");
      if (!meta || document.getElementById("hard-reset")) return;
      const rb = document.createElement("button");
      rb.id = "hard-reset";
      rb.textContent = "🔄";
      rb.title = "최신 버전으로 강제 갱신 (기록은 유지)";
      rb.style.cssText = "border:0;border-radius:999px;padding:5px 8px;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;line-height:1;background:#E0E7FF;color:#3730A3";
      rb.onclick = async () => {
        if (!confirm("최신 버전으로 강제 갱신할까요? (콜백싯 기록은 그대로 유지됩니다)")) return;
        try { await this.forceSync(); } catch (e) {}
        try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch (e) {}
        try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.unregister())); } catch (e) {}
        location.reload(true);
      };
      meta.appendChild(rb);
    }, 500);
  },
};
Cloud.init();

/* ════════════════════════════════════════════════════════════════════
   TEAM — 팀관리 (관리자 임재영 전용 탭)
   - 팀원별 개인 링크: ?u={uid}&n={이름} → 열면 자동으로 본인 계정 연결
   - 링크로 연결된 팀원은 계정이 잠겨 다른 팀원 데이터를 볼 수 없음
   - 관리자는 팀원별 콜백싯 데이터(최근 14일 + 후원자)를 열람
   ════════════════════════════════════════════════════════════════════ */
const Team = {
  LOCK_KEY: "fcos_locked",

  isAdmin() {
    const w = Hub.identity();
    return !!(w && (w.uid === "admin" || w.name === "임재영"));
  },
  appUrl() { return location.origin + location.pathname; },
  linkFor(u) { return this.appUrl() + "?u=" + encodeURIComponent(u.uid) + "&n=" + encodeURIComponent(u.name); },

  copy(text) {
    const fb = () => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;top:-999px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("📋 복사 완료 — 카톡에 붙여넣기"); }
      catch (e) { prompt("복사해서 보내세요:", text); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(() => toast("📋 복사 완료 — 카톡에 붙여넣기"), fb);
    else fb();
  },
  share(u) {
    const text = `📋 ${u.name}님 전용 콜백싯\n${this.linkFor(u)}\n\n링크를 열면 자동으로 ${u.name}님 계정으로 연결돼요. 사파리 공유 → "홈 화면에 추가" 하면 앱처럼 쓸 수 있어요!`;
    if (navigator.share) navigator.share({ text }).catch(() => this.copy(text));
    else this.copy(text);
  },

  async render() {
    const box = $("team-list");
    if (!box) return;
    if (!this.isAdmin()) {
      box.innerHTML = '<div class="empty">관리자(임재영) 계정으로 허브 연결 시 사용할 수 있어요</div>';
      return;
    }
    box.innerHTML = '<div class="empty">팀원 명단 불러오는 중…</div>';
    let users = {}, removed = [];
    try {
      [users, removed] = await Promise.all([
        fetch(HUB_DB + "/users.json").then((r) => r.json()).then((v) => v || {}),
        fetch(HUB_DB + "/removedMembers.json").then((r) => r.json()).then((v) => v || []).catch(() => []),
      ]);
    }
    catch (e) { box.innerHTML = '<div class="empty">허브 연결 실패 — 인터넷을 확인해주세요</div>'; return; }
    const nrm = (s) => String(s || "").replace(/\s+/g, "");
    const rmSet = new Set((removed || []).map(nrm));
    const isAdminU = (u) => u.uid === "admin" || u.name === "임재영";
    /* 임재영(AOP)을 항상 맨 위에 고정, 나머지는 이름순 · 퇴사자(removedMembers) 제외 */
    const list = Object.values(users)
      .filter((u) => u && u.name && u.uid && u.status !== "retired" && !u.test && !rmSet.has(nrm(u.name)))
      .sort((a, b) => {
        const aa = isAdminU(a), bb = isAdminU(b);
        if (aa !== bb) return aa ? -1 : 1;
        return a.name > b.name ? 1 : -1;
      });
    box.innerHTML = list.map((u) => {
      const admin = isAdminU(u);
      const role = u.role || (admin ? "AOP" : "");
      return `
      <div class="rh-item" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <b style="font-size:14px">${admin ? "👑 " : ""}${esc(u.name)}</b><span class="chip">${esc(role)}</span>
        <span style="flex:1"></span>
        <button class="btn btn-outline btn-sm" data-tcopy="${esc(u.uid)}">🔗 링크 복사</button>
        <button class="btn btn-outline btn-sm" data-tshare="${esc(u.uid)}">💬 카톡</button>
        <button class="btn btn-primary btn-sm" data-tview="${esc(u.uid)}" data-tname="${esc(u.name)}">📊 데이터 보기</button>
      </div>`;
    }).join("") || '<div class="empty">팀원이 없습니다</div>';
    box.querySelectorAll("[data-tcopy]").forEach((b) => (b.onclick = () => { const u = list.find((x) => x.uid === b.dataset.tcopy); if (u) this.copy(this.linkFor(u)); }));
    box.querySelectorAll("[data-tshare]").forEach((b) => (b.onclick = () => { const u = list.find((x) => x.uid === b.dataset.tshare); if (u) this.share(u); }));
    box.querySelectorAll("[data-tview]").forEach((b) => (b.onclick = () => this.view(b.dataset.tview, b.dataset.tname)));
  },

  /* 팀원 데이터 열람 — 실시간 스트림(SSE) 구독 + 캐시버스터.
     기존엔 1회성 fetch라 팀원이 기록해도 관리자 화면이 안 바뀌고,
     캐시된 옛 응답(빈 데이터)을 받아 "안 보인다"는 문제가 있었음. */
  view(uid, name) {
    const box = $("team-view");
    if (!box) return;
    this.closeView();
    this.viewUid = uid; this.viewName = name;
    box.innerHTML = '<div class="empty">' + esc(name) + '님 데이터 불러오는 중… (실시간 연결)</div>';
    this.fetchView(uid, name);
    /* 실시간 수신 — 팀원이 기록하는 즉시 관리자 화면 자동 갱신 */
    try {
      this.viewES = new EventSource(HUB_DB + "/callbacksheets/" + uid + ".json");
      const onEv = () => {
        if (this.viewUid !== uid) return;
        clearTimeout(this._vt);
        this._vt = setTimeout(() => this.fetchView(uid, name), 400);
      };
      this.viewES.addEventListener("put", onEv);
      this.viewES.addEventListener("patch", onEv);
      this.viewES.onerror = () => {
        try { this.viewES.close(); } catch (e) {}
        this.viewES = null;
        if (this.viewUid === uid) setTimeout(() => { if (this.viewUid === uid && !this.viewES) this.view(uid, name); }, 6000);
      };
    } catch (e) {}
  },

  closeView() {
    this.viewUid = null;
    clearTimeout(this._vt);
    if (this.viewES) { try { this.viewES.close(); } catch (e) {} this.viewES = null; }
  },

  async fetchView(uid, name) {
    const box = $("team-view");
    if (!box) return;
    let all = {};
    try {
      all = await fetch(HUB_DB + "/callbacksheets/" + uid + ".json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json()) || {};
    } catch (e) {
      if (!box.querySelector(".mini-table")) box.innerHTML = '<div class="empty">불러오기 실패 — 인터넷을 확인해주세요</div>';
      return;
    }
    if (this.viewUid !== uid) return;   // 다른 팀원으로 전환됨 → 폐기
    const dates = Object.keys(all).filter((d) => all[d] && !all[d].deleted && all[d].info).sort().reverse().slice(0, 14);
    if (!dates.length) {
      box.innerHTML = '<div class="empty">' + esc(name) + '님은 아직 기록이 없어요 — 개인 링크로 접속해 기록하면 여기 실시간으로 쌓입니다</div>';
      return;
    }
    const arr = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);
    let rows = "", donors = [];
    const tot = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0 };
    dates.forEach((d) => {
      const s = all[d];
      const c = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0 };
      arr(s.logs).forEach((l) => { if (c[l.type] !== undefined) c[l.type]++; });
      STAGES.forEach((k) => (tot[k] += c[k]));
      arr(s.rehashes).forEach((r) => donors.push({ date: d, ...r }));
      rows += `<tr><td>${d.slice(5)}</td>` + STAGES.map((k) => `<td>${c[k] || ""}</td>`).join("")
        + `<td style="font-size:11px">${esc(((s.info && s.info.site) || "").split("/")[0])}</td>`
        + `<td><button class="btn btn-ghost btn-sm" data-tdel="${esc(d)}" title="이 세션 삭제" style="padding:2px 7px">🗑</button></td></tr>`;
    });
    box.innerHTML =
      `<h3 style="font-size:14px;margin:4px 0 8px">👤 ${esc(name)} — 최근 ${dates.length}일 · Close ${tot.close} · Rehash ${tot.rehash} (KPI ${pct(tot.rehash, tot.close)}%) <span class="chip" style="background:#DCFCE7;color:#166534">☁ 실시간</span></h3>
      <div class="table-wrap"><table class="mini-table"><tr><th>날짜</th><th>C</th><th>S</th><th>PT</th><th>Cl</th><th>Rh</th><th>사이트</th><th></th></tr>${rows}</table></div>`
      + (donors.length
        ? `<p class="hint" style="margin:12px 0 4px;font-weight:800">후원자 ${donors.length}건</p>`
          + donors.slice(0, 20).map((r) => `<div class="rh-item">
              <div class="rh-top"><span>${esc(r.name) || "이름 없음"}</span><span class="chip">${esc(r.pay || "")}</span>${r.code ? `<span class="chip">${esc(r.code)}</span>` : ""}<span class="rh-amount">${r.amount ? Number(r.amount).toLocaleString() + "원" : "-"}</span></div>
              <div class="rh-sub">${r.date} · ${esc(r.place || r.site || "-")}</div>
            </div>`).join("")
        : "");
    /* 🗑 세션 삭제 (관리자 복구 도구) — tombstone PUT */
    box.querySelectorAll("[data-tdel]").forEach((b) => (b.onclick = () => this.delSession(uid, name, b.dataset.tdel)));
  },

  /* 세션 tombstone 삭제 — 단순 DELETE는 팀원 기기의 pullAll이 로컬 사본을
     되살리므로 반드시 {deleted:true} 표식을 PUT한다 (모든 기기에서 사라짐) */
  async delSession(uid, name, date) {
    if (!confirm(`${name}님의 ${date} 세션을 삭제할까요? 모든 기기에서 사라집니다`)) return;
    try {
      const res = await fetch(HUB_DB + "/callbacksheets/" + uid + "/" + date + ".json", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleted: true, info: { date }, up: Date.now() }),
      });
      if (!res.ok) throw new Error("del " + res.status);
      toast("세션을 삭제했습니다");
      this.view(uid, name);
    } catch (e) { toast("삭제 실패 — 인터넷을 확인해주세요"); }
  },

  tabVis() {
    const t = document.querySelector('[data-nav="team"]');
    if (t) t.style.display = this.isAdmin() ? "" : "none";
  },

  init() {
    /* 개인 링크(?u=uid&n=이름)로 접속 → 자동 계정 연결 + 잠금 */
    try {
      const q = new URLSearchParams(location.search);
      const u = q.get("u"), n = q.get("n");
      if (u && n) {
        const cur = Hub.identity();
        const wasAdmin = localStorage.getItem("fcos_was_admin") === "1";
        const connect = async () => {
          const candidate = { uid: u, name: n };
          if (!(await Hub.activeIdentity(candidate))) { Hub.toast(n + "님은 현재 활성 팀원 명단에 없습니다"); history.replaceState(null, "", location.pathname); return; }
          if (u !== "admin" && n !== "임재영") localStorage.setItem(this.LOCK_KEY, "1");
          else localStorage.removeItem(this.LOCK_KEY);
          Hub.setIdentity(candidate);
          location.replace(location.pathname);   // 새 계정으로 동기화 재시작
        };
        if (!cur) { connect(); return; }          // 첫 연결(새 기기)만 비밀번호 없이
        if (cur.uid !== u) {
          /* ★ 이미 다른 계정이 연결된 기기 — 관리자 비밀번호 없이는 링크로도 전환 불가
             (남의 링크·QR로 다른 사람 콜백싯에 들어가던 문제 차단) */
          if (this.isAdmin() || wasAdmin) { connect(); return; }
          (async () => {
            const pw = prompt(`이 기기는 이미 ${cur.name}님 계정으로 연결돼 있어요 🔒\n다른 계정으로 전환하려면 관리자 비밀번호가 필요합니다:`);
            if (pw !== null && pw !== "") {
              let real = "0691";
              try { const v = await fetch(HUB_DB + "/settings/cbAdminPw.json").then((r) => r.json()); if (v) real = String(v); } catch (e) {}
              if (String(pw).trim() === real) { localStorage.setItem("fcos_was_admin", "1"); connect(); return; }
              Hub.toast("비밀번호가 맞지 않아요 🔒");
            }
          })();
        }
        history.replaceState(null, "", location.pathname);
      }
    } catch (e) {}
    /* ★ 계정 연결·전환은 항상 관리자 비밀번호 필요 (2026-07-11 보안 강화)
       - QR/기본 주소로 들어온 사람이 비밀번호 없이 아무 계정이나 선택해
         남의 콜백싯에 들어가던 문제 차단
       - 팀원은 관리자가 보내준 개인 링크(?u=&n=)로만 자동 연결됨
       - 관리자 본인/관리자 인증된 기기만 자유 전환
         (비밀번호 0691 · Firebase settings/cbAdminPw 로 변경 가능) */
    const orig = Hub.openPicker.bind(Hub);
    Hub.openPicker = async () => {
      const wasAdmin = localStorage.getItem("fcos_was_admin") === "1";
      if (!this.isAdmin() && !wasAdmin) {
        const pw = prompt("계정 연결·전환은 관리자만 할 수 있어요 🔒\n관리자 비밀번호를 입력하세요.\n(팀원은 관리자가 카톡으로 보내준 개인 링크로 접속하면 자동 연결됩니다)");
        if (pw === null || pw === "") return;
        let real = "0691";
        try {
          const v = await fetch(HUB_DB + "/settings/cbAdminPw.json").then((r) => r.json());
          if (v) real = String(v);
        } catch (e) {}
        if (String(pw).trim() !== real) { Hub.toast("비밀번호가 맞지 않아요 🔒"); return; }
        localStorage.setItem("fcos_was_admin", "1");
        Hub.toast("관리자 확인 ✓ — 계정을 선택하세요");
      }
      return orig();
    };
    this.tabVis();
    setInterval(() => this.tabVis(), 3000);
  },
};
Team.init();

/* ==================== 앱 시작 (모든 모듈 정의 완료 후 실행) ==================== */
loadToday();
renderHeader();
bind();
nav("dashboard");
