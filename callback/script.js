/* ============================================================
   Field Callback OS — Plan · Do · See
   Vanilla JS + LocalStorage. Storage layer is isolated so it
   can be swapped for Supabase/Firebase later.
============================================================ */
"use strict";

/* ==================== Constants ==================== */
const STAGES = ["contact", "stop", "presentation", "close", "rehash"];
const STAGE_LABEL = { contact: "Contact", stop: "Stop", presentation: "Presentation", close: "Close", rehash: "Rehash" };
const STAGE_COLOR = { contact: "#3B82F6", stop: "#14B8A6", presentation: "#8B5CF6", close: "#22C55E", rehash: "#F59E0B", fail: "#EF4444" };
const OBJECTIONS = ["이미 후원", "경제적 부담", "배우자 상의", "부모님", "시간이 없음", "급함", "신뢰 부족", "관심 없음", "타단체", "외국인", "미성년자"];

/* ==================== Storage Adapter ====================
   All persistence goes through this object only.
   Swap implementation for Supabase/Firebase later.        */
const Store = {
  KEY: "fcos_sessions_v1",
  _read() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch { return {}; }
  },
  _write(all) { localStorage.setItem(this.KEY, JSON.stringify(all)); },
  getAll() { return this._read(); },
  getSession(date) { return this._read()[date] || null; },
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
    rehashes: [],    // {t, date, site, name, age, gender, amount, pay, note, memory, next, remark}
    retro: { number: { good: "", bad: "" }, skill: { good: "", bad: "" }, attitude: { good: "", bad: "" } },
  };
}

let S = null; // current day session
const todayStr = () => new Date().toISOString().slice(0, 10);
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function loadToday() {
  S = Store.getSession(todayStr()) || newSession(todayStr());
}
function save() { Store.saveSession(S); }

/* 날짜 전환 — 지난 날짜도 뒤늦게 작성 가능 */
function switchDate(date) {
  if (!date || date === S.info.date) return;
  save();
  let next = Store.getSession(date);
  if (!next) {
    next = newSession(date);
    // 최근 세션에서 이름/팀/목표를 이어받는다
    const prev = Object.values(Store.getAll()).sort((a, b) => b.info.date.localeCompare(a.info.date))[0];
    if (prev) {
      next.info.name = prev.info.name;
      next.info.team = prev.info.team;
      next.goals = { ...prev.goals };
    }
  }
  S = next;
  logMode = "now";
  save();
  renderHeader(); renderPlan();
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
}

/* ==================== Header ==================== */
function renderHeader() {
  const d = new Date(S.info.date + "T00:00:00");
  const isToday = S.info.date === todayStr();
  $("header-date").textContent = `${d.getMonth() + 1}/${d.getDate()} (${"일월화수목금토"[d.getDay()]})${isToday ? "" : " · 과거 세션"}`;
  const site = $("header-site");
  site.textContent = S.info.site || "사이트 미설정";
  site.classList.toggle("chip-blue", !!S.info.site);
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
  const sites = new Set(Object.values(Store.getAll()).map((x) => x.info.site).filter(Boolean));
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

function deleteLog(idx) {
  const log = S.logs[idx];
  if (!log) return;
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

function openRehash() {
  pendingRehashLog = addLog("rehash");
  ["name", "age", "amount", "note", "memory", "next", "remark"].forEach((f) => ($("rh-f-" + f).value = ""));
  $("rh-f-gender").value = "여";
  $$("#modal-rehash .seg-btn").forEach((b, i) => b.classList.toggle("active", i === 0));
  $("modal-rehash").classList.remove("hidden");
  setTimeout(() => $("rh-f-name").focus(), 250);
}

function saveRehash() {
  const pay = document.querySelector("#modal-rehash .seg-btn.active")?.dataset.pay || "계좌";
  S.rehashes.push({
    t: pendingRehashLog.t,
    source: pendingRehashLog.type,
    date: S.info.date,
    site: S.info.site,
    name: $("rh-f-name").value.trim(),
    age: $("rh-f-age").value,
    gender: $("rh-f-gender").value,
    amount: $("rh-f-amount").value,
    pay,
    note: $("rh-f-note").value.trim(),
    memory: $("rh-f-memory").value.trim(),
    next: $("rh-f-next").value.trim(),
    remark: $("rh-f-remark").value.trim(),
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
}

/* ==================== SEE ==================== */
let hourlyChart = null, objChart = null, objChartType = "pie";

function renderSee() {
  $("see-sub").textContent = `${S.info.date} · ${S.info.site || "사이트 미설정"} · ${S.info.weather}`;
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
  return Object.values(Store.getAll()).flatMap((s) => s.rehashes || []);
}

function renderRehashList() {
  const q = $("rh-search").value.trim().toLowerCase();
  const date = $("rh-date").value;
  const site = $("rh-site").value.trim().toLowerCase();
  const pay = $("rh-pay").value;
  const items = allRehashes().filter((r) =>
    (!q || (r.name || "").toLowerCase().includes(q)) &&
    (!date || r.date === date) &&
    (!site || (r.site || "").toLowerCase().includes(site)) &&
    (!pay || r.pay === pay)
  ).sort((a, b) => b.t.localeCompare(a.t));

  $("rehash-list").innerHTML = items.length ? items.map((r) => `
    <div class="rh-item">
      <div class="rh-top">
        <span>${esc(r.name) || "이름 없음"}</span>
        <span class="chip chip-blue">Rehash</span>
        <span class="chip">${esc(r.pay)}</span>
        <span class="rh-amount">${r.amount ? Number(r.amount).toLocaleString() + "원" : "-"}</span>
      </div>
      <div class="rh-sub">${r.date} · ${esc(r.site) || "-"} · ${r.age ? r.age + "세" : ""} ${esc(r.gender || "")}</div>
      ${r.memory ? `<div class="rh-note">💭 ${esc(r.memory)}</div>` : ""}
      ${r.next ? `<div class="rh-note">💬 다음: ${esc(r.next)}</div>` : ""}
      ${r.note || r.remark ? `<div class="rh-note">${esc([r.note, r.remark].filter(Boolean).join(" · "))}</div>` : ""}
    </div>`).join("")
    : `<div class="empty" style="color:var(--ink-3);font-size:13px;text-align:center;padding:14px">결과가 없습니다</div>`;
}

/* site / weather stats across all sessions */
function aggregateBy(keyFn) {
  const map = {};
  Object.values(Store.getAll()).forEach((s) => {
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
  Object.values(Store.getAll()).forEach((s) => {
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
  let rows = [["날짜", "시간", "이름", "나이", "성별", "후원금액", "결제수단", "사이트", "특이사항", "기억할 내용", "다음 이야기", "Remark"]];
  allRehashes().forEach((r) => {
    rows.push([r.date, fmtTime(r.t), r.name, r.age, r.gender, r.amount, r.pay, r.site, r.note, r.memory, r.next, r.remark]);
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

  // 실제 기록된 시간대만 표시 (억지로 늘어나지 않도록)
  const hourRows = hours.map((h) => {
    const d = data[h];
    return `<tr><td class="hr">${h}시</td><td>${d.contact || ""}</td><td>${d.stop || ""}</td><td>${d.presentation || ""}</td><td>${d.close || ""}</td><td>${d.rehash || ""}</td></tr>`;
  }).join("");

  const objItems = S.objections.map((o) =>
    `<li>${o.type === "fail" ? `<span class="tag tag-f">실패</span> ` : ""}${fmtTime(o.t)} · ${esc(o.reasons.join(", "))}</li>`
  ).join("") || `<li class="none">기록 없음</li>`;

  const serialItems = S.rehashes.map((r) =>
    `<li><b class="ser-time">${fmtTime(r.t)}</b> · ${esc(r.name) || "이름없음"} · ${r.age ? r.age + "세" : "-"} ${esc(r.gender || "")} · ${r.amount ? Number(r.amount).toLocaleString() + "원" : "-"} · ${esc(r.pay)}${r.memory ? `<div class="memo">메모: ${esc(r.memory)}</div>` : ""}${r.next ? `<div class="memo">다음: ${esc(r.next)}</div>` : ""}</li>`
  ).join("") || `<li class="none">기록 없음</li>`;

  const goalCells = STAGES.map((s, i) =>
    `<td class="gv"><b>${counts[i]}</b><span class="gg"> / ${S.goals[s]}</span></td>`).join("");
  const rateCells = STAGES.map((s, i) => {
    const g = S.goals[s], a = counts[i], p = pct(a, g);
    return `<td class="rate ${a >= g ? "ok" : ""}">${p}%</td>`;
  }).join("");

  // 전환율: 각 칸에 "무엇에서 무엇으로 몇 %"인지 그대로 표기
  let convCells = "";
  for (let i = 0; i < STAGES.length - 1; i++) {
    convCells += `<td class="cv"><b>${pct(counts[i + 1], counts[i])}%</b>
      <div class="cv-sub">${STAGE_LABEL[STAGES[i]]} ${counts[i]}명 → ${STAGE_LABEL[STAGES[i + 1]]} ${counts[i + 1]}명</div></td>`;
  }

  const retroRow = (sign) => ["number", "skill", "attitude"].map((k) =>
    `<td class="retro-cell">${esc(S.retro[k][sign === "+" ? "good" : "bad"]) || "<span class='none'>-</span>"}</td>`).join("");

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>Call Back Sheet — ${S.info.date}</title>
<style>
  @page { size: A4; margin: 9mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif; color:#18181B; font-size:10.5px; line-height:1.4; padding:24px; }
  #sheet { width:718px; margin:0 auto; }
  h1 { text-align:center; font-size:20px; letter-spacing:-.02em; margin-bottom:1px; }
  .subtitle { text-align:center; color:#71717A; font-size:9px; margin-bottom:10px; }
  .info { display:grid; grid-template-columns:repeat(3,1fr); gap:2px 14px; border:1px solid #D4D4D8; border-radius:8px; padding:7px 12px; margin-bottom:9px; }
  .info div b { color:#2563EB; margin-right:6px; font-size:9.5px; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:9px; align-items:start; }
  table { width:100%; border-collapse:collapse; }
  th,td { border:1px solid #D4D4D8; padding:3px 5px; text-align:center; }
  th { background:#F4F4F5; font-size:9.5px; }
  .hr { font-weight:700; background:#FAFAFA; }
  .hourly td { height:17px; }
  .lbl { width:64px; background:#F4F4F5; color:#71717A; font-size:9px; font-weight:700; }
  .panel { border:1px solid #D4D4D8; border-radius:8px; overflow:hidden; }
  .ser-time { color:#2563EB; }
  .panel h3 { background:#F4F4F5; font-size:10px; padding:4px 9px; border-bottom:1px solid #D4D4D8; }
  .panel ol { padding:5px 9px 6px 24px; }
  .panel ol.two-col { columns:2; column-gap:14px; }
  .panel li { margin-bottom:2px; break-inside:avoid; }
  .memo { color:#71717A; font-size:9px; padding-left:2px; }
  .none { color:#A1A1AA; }
  .tag { font-size:8.5px; font-weight:700; border-radius:4px; padding:0 4px; background:#FEE2E2; color:#DC2626; }
  .sec-title { background:#27272A; color:#fff; text-align:center; font-size:10.5px; font-weight:700; padding:4px; border-radius:6px 6px 0 0; }
  .goal-table .gv { font-size:11px; padding:6px 5px; }
  .goal-table .gv b { font-size:15px; }
  .gg { color:#A1A1AA; font-size:9.5px; }
  .rate { font-size:9px; font-weight:700; color:#A1A1AA; background:#FAFAFA; padding:3px; }
  .rate.ok { color:#16A34A; }
  .conv-table { margin-bottom:9px; }
  .cv b { font-size:11.5px; color:#2563EB; }
  .cv-sub { font-size:8.5px; color:#71717A; }
  .retro-cell { text-align:left; vertical-align:middle; min-height:0; white-space:pre-wrap; width:33.3%; padding:7px 9px; height:auto; }
  .retro-table td { height:52px; }
  .pm { width:56px; font-weight:800; background:#F4F4F5; color:#71717A; font-size:9px; }
  .footer { text-align:center; color:#A1A1AA; font-size:8.5px; margin-top:9px; }
  .noprint { text-align:center; margin-bottom:14px; }
  .noprint button { background:#2563EB; color:#fff; border:none; border-radius:8px; padding:10px 22px; font-size:14px; font-weight:700; cursor:pointer; }
  @media print {
    .noprint { display:none; }
    body { padding:0; }
    html, body { height:auto; }
  }
</style></head><body>
<div class="noprint"><button onclick="window.print()">📑 PDF로 저장 / 인쇄</button></div>
<div id="sheet">
<h1>Call Back Sheet</h1>
<div class="subtitle">Field Callback OS — Daily Report</div>

<div class="info">
  <div><b>Name</b>${esc(S.info.name) || "-"}</div>
  <div><b>Team</b>${esc(S.info.team) || "-"}</div>
  <div><b>Date</b>${S.info.date}</div>
  <div><b>Weather</b>${esc(S.info.weather)}</div>
  <div><b>Location</b>${esc(S.info.site) || "-"}</div>
  <div><b>오늘의 테마</b>${esc(S.info.theme) || "-"}</div>
</div>

<div class="cols">
  <table class="hourly">
    <tr><th>Field Time</th><th>Contact</th><th>Stop</th><th>PT</th><th>Close</th><th>Rehash</th></tr>
    ${hourRows}
    <tr><td class="hr">합계</td>${counts.map((c) => `<td><b>${c}</b></td>`).join("")}</tr>
  </table>
  <div>
    <div class="panel" style="margin-bottom:9px">
      <h3>오브젝션 핸들링 사유 (Close)</h3>
      <ol class="${S.objections.length > 7 ? "two-col" : ""}">${objItems}</ol>
    </div>
    <div class="panel">
      <h3>시리얼 — 후원자 기본정보 (Rehash)</h3>
      <ol>${serialItems}</ol>
    </div>
  </div>
</div>

<div class="sec-title">오늘의 목표 & 결과 (환경을 탓하지 말고 나의 노력을 탓하라)</div>
<table class="goal-table">
  <tr><th class="lbl"></th>${STAGES.map((s) => `<th>${STAGE_LABEL[s]}</th>`).join("")}</tr>
  <tr><td class="lbl">결과<br>실제/목표</td>${goalCells}</tr>
  <tr><td class="lbl">달성률</td>${rateCells}</tr>
</table>
<table class="conv-table">
  <tr><td class="lbl">전환율<br>다음 단계<br>이동 비율</td>${convCells}</tr>
</table>

<div class="sec-title">내일을 위한 Analysis &amp; Evaluation</div>
<table class="retro-table">
  <tr><th class="pm"></th><th>Number</th><th>Pitch (Skill)</th><th>Attitude (Mental)</th></tr>
  <tr><td class="pm">잘한 점 (＋)</td>${retroRow("+")}</tr>
  <tr><td class="pm">아쉬운 점 (－)</td>${retroRow("-")}</tr>
</table>

<div class="footer">Generated by Field Callback OS · ${new Date().toLocaleString("ko-KR")}</div>
</div><!-- /#sheet -->
<script>
// 어떤 데이터가 들어와도 무조건 A4 한 페이지: 내용이 넘치면 전체를 비율 축소
window.addEventListener("load", () => {
  const sheet = document.getElementById("sheet");
  const PAGE_H = 1035; // A4 인쇄 가능 높이(px, 9mm 여백 기준)
  const h = sheet.scrollHeight;
  if (h > PAGE_H) sheet.style.zoom = Math.max(0.55, PAGE_H / h).toFixed(3);
  setTimeout(() => window.print(), 400);
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
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* ==================== Init ==================== */
loadToday();
renderHeader();
bind();
nav("dashboard");
