const sites = [
  {id:"daiso-jukrim",name:"다이소 통영죽림점",address:"경남 통영시 광도면 죽림4로 38",zone:"죽림",evidence:"ctm",score:96,flow:5,donor:5,dwell:4,setup:5,time:"평일 16:30–20:30",analysis:"죽림 생활권의 장보기·퇴근 유동이 겹치고, CTM에서 볼륨과 참여율이 함께 확인된 최우선 기준점입니다.",risk:"점포 승인 후 출입구·점자블록을 비켜 설치",pano:"1204429615",pan:"128",zoom:"0",x:"824020",y:"387871",ctm:{sales:82,hc:39,pavg:2.1,scoring:36,rate:"92%",donate:"2,520,000원"}},
  {id:"daiso-mujeon",name:"다이소 통영무전점",address:"경남 통영시 남해안대로 581",zone:"무전·북신",evidence:"ctm",score:93,flow:5,donor:4,dwell:4,setup:5,time:"평일 16:30–20:30",analysis:"무전 신도심 생활 유동이 강하고 CTM Sales 62가 검증된 2순위 앵커입니다. 저녁 장보기 시간대가 핵심입니다.",risk:"주차 진출입 동선과 매장 정면 통행 폭 확보",pano:"1189100150",pan:"265",zoom:"-3",x:"829392",y:"380413",ctm:{sales:62,hc:35,pavg:1.8,scoring:25,rate:"71%",donate:"1,960,000원"}},
  {id:"bus-terminal",name:"통영종합버스터미널",address:"경남 통영시 광도면 죽림4로 24",zone:"죽림",evidence:"ctm",score:88,flow:5,donor:4,dwell:5,setup:3,time:"11:00–14:00 · 17:00–20:00",analysis:"도착·대기 유동과 죽림 상권이 만나는 교통 거점입니다. CTM 실적은 중상위이며 대기시간을 대화로 전환하기 좋습니다.",risk:"터미널 시설관리자 승인 필수·승하차선 회피",pano:"1189087164",pan:"217",zoom:"-4",x:"823869",y:"388206",ctm:{sales:22,hc:16,pavg:1.4,scoring:11,rate:"69%",donate:"670,000원"}},
  {id:"central-market",name:"통영중앙전통시장",address:"경남 통영시 중앙동 중앙시장 일대",zone:"원도심·항남",evidence:"expand",score:86,flow:5,donor:4,dwell:5,setup:3,time:"11:00–14:00 · 16:00–19:30",analysis:"강구안·동피랑과 이어지는 대표 원도심 보행축입니다. 관광객과 지역 장보기 유동이 동시에 모여 신규 검증 가치가 높습니다.",risk:"시장 상인회·관할부서 협의 및 소방통로 확보",pano:"1204507305",pan:"1",zoom:"-4",x:"825716",y:"376976"},
  {id:"ferry-terminal",name:"통영항여객선터미널",address:"경남 통영시 통영해안로 234",zone:"원도심·항남",evidence:"expand",score:84,flow:5,donor:4,dwell:5,setup:3,time:"09:00–12:00 · 15:00–18:00",analysis:"섬 이동 전후의 대기·귀환 유동이 모이는 곳입니다. 짐이 많은 승객보다 대기 승객을 대상으로 짧은 첫 멘트를 권장합니다.",risk:"여객터미널 운영사 승인·출입구와 수하물 동선 회피",pano:"1204408869",pan:"150",zoom:"-1",x:"824731",y:"375672"},
  {id:"emart",name:"이마트 통영점",address:"경남 통영시 광도면 죽림4로 9",zone:"죽림",evidence:"expand",score:83,flow:5,donor:4,dwell:4,setup:4,time:"평일 16:30–20:30",analysis:"죽림점·터미널과 같은 생활권의 대형 장보기 앵커입니다. 죽림점 대체 또는 동시 운영 후보로 비교 측정하기 좋습니다.",risk:"점포 승인 필수·카트 및 차량 진입 동선 확보",pano:"1189022023",pan:"52",zoom:"-4",x:"823896",y:"388676"},
  {id:"seoho-market",name:"서호시장",address:"경남 통영시 새터길 42-7",zone:"원도심·항남",evidence:"expand",score:81,flow:4,donor:4,dwell:4,setup:3,time:"08:30–12:30",analysis:"아침형 지역 생활 유동이 강한 전통시장입니다. 관광형 중앙시장과 다른 로컬 참여 패턴을 검증할 수 있습니다.",risk:"오전 운영 권장·상인회 협의·적재 동선 회피",pano:"1204410166",pan:"175",zoom:"0",x:"824569",y:"376078"},
  {id:"lotte-mart",name:"롯데마트 통영점",address:"경남 통영시 무전대로 65",zone:"무전·북신",evidence:"ctm",score:79,flow:4,donor:3,dwell:4,setup:4,time:"평일 16:30–20:30",analysis:"무전·북신 장보기 유동이 안정적이며 CTM 이력이 있습니다. 표본은 작아 무전점 대비 전환 효율을 재검증해야 합니다.",risk:"점포 승인·카트 회수선과 주차장 출입구 회피",pano:"1204417740",pan:"276",zoom:"-14",x:"826645",y:"381366",ctm:{sales:5,hc:3,pavg:1.7,scoring:2,rate:"67%",donate:"150,000원"}},
  {id:"gangguan",name:"강구안 문화마당",address:"경남 통영시 중앙동 강구안 일대",zone:"원도심·항남",evidence:"expand",score:78,flow:5,donor:3,dwell:5,setup:2,time:"15:00–20:00",analysis:"해안 산책·관광·식음 대기 유동이 겹치는 체류형 거점입니다. 날씨에 민감하지만 저녁 테스트 가치가 높습니다.",risk:"공공광장 사용 승인 필수·행사 일정과 해풍 확인",pano:"1204413936",pan:"123",zoom:"0",x:"825597",y:"376775"},
  {id:"bukshin-market",name:"북신전통시장",address:"경남 통영시 북신시장1길 33",zone:"무전·북신",evidence:"expand",score:76,flow:4,donor:4,dwell:4,setup:3,time:"10:30–13:00 · 16:30–19:30",analysis:"주거 밀집지의 반복 생활 유동을 볼 수 있는 로컬 시장입니다. 관광객보다 지역 주민 참여 패턴을 측정하기 좋습니다.",risk:"시장 상인회 승인·좁은 통로와 적재시간 회피",pano:"1053475246",pan:"90",zoom:"-8",x:"826413",y:"380006"},
  {id:"lotte-cinema",name:"롯데시네마 통영",address:"경남 통영시 안개로 37",zone:"무전·북신",evidence:"expand",score:74,flow:4,donor:3,dwell:4,setup:3,time:"17:00–21:00",analysis:"영화 상영 전후 대기와 저녁 외식 유동을 활용하는 시간대형 후보입니다. 평일 저녁과 우천일 대체 운영에 적합합니다.",risk:"건물·극장 승인 필수·상영 직전 이동 방해 금지",pano:"1204229286",pan:"281",zoom:"-6",x:"827108",y:"380955"},
  {id:"oliveyoung",name:"올리브영 통영무전점",address:"경남 통영시 중앙로 307",zone:"무전·북신",evidence:"expand",score:73,flow:4,donor:3,dwell:3,setup:3,time:"16:30–20:30",analysis:"무전 상업가로의 젊은 소비 유동을 확인할 수 있습니다. 단독보다는 무전점 운영 전후의 세컨드 스팟으로 적합합니다.",risk:"협소한 보도에서는 부스보다 소형 셋업 검토",pano:"1204420587",pan:"332",zoom:"-10",x:"826546",y:"380544"},
  {id:"hanaro",name:"새통영농협하나로마트 본점",address:"경남 통영시 광도면 죽림2로 49-49",zone:"죽림",evidence:"expand",score:72,flow:4,donor:4,dwell:4,setup:4,time:"15:30–19:30",analysis:"죽림 주거권의 생활밀착 장보기 후보입니다. 대형 상업시설보다 지역 주민 반복 방문 비중이 높을 가능성을 테스트합니다.",risk:"농협·매장 승인 필수·카트와 차량 동선 확보",pano:"1204426807",pan:"239",zoom:"-13",x:"824235",y:"387424"},
  {id:"topmart",name:"탑마트 통영점",address:"경남 통영시 미수해안로 164-13",zone:"미륵·도남",evidence:"ctm",score:70,flow:3,donor:4,dwell:4,setup:4,time:"15:30–19:30",analysis:"CTM 표본은 작지만 P.Avg 5.0이 확인된 고효율 테스트 후보입니다. 먼저 짧게 운영해 유효 표본을 늘리는 것이 좋습니다.",risk:"소표본 과대평가 주의·점포 승인 후 운영",pano:"1204403027",pan:"264",zoom:"-4",x:"823481",y:"373471",ctm:{sales:5,hc:1,pavg:5.0,scoring:1,rate:"100%",donate:"150,000원"}},
  {id:"daiso-hangnam",name:"다이소 통영항남점",address:"경남 통영시 항남3길 4",zone:"원도심·항남",evidence:"ctm",score:68,flow:4,donor:2,dwell:3,setup:3,time:"15:00–19:00",analysis:"원도심 상권에 위치하지만 기존 CTM P.Avg 0.3·성공률 25%로 전환이 약했습니다. 재운영 시 멘트·위치 변경이 전제입니다.",risk:"검증 결과 낮음·긴 운영보다 90분 재테스트 권장",pano:"1204414457",pan:"182",zoom:"-12",x:"825034",y:"376264",ctm:{sales:1,hc:4,pavg:0.3,scoring:1,rate:"25%",donate:"30,000원"}},
  {id:"cablecar",name:"통영케이블카",address:"경남 통영시 발개로 205",zone:"미륵·도남",evidence:"expand",score:67,flow:4,donor:3,dwell:5,setup:2,time:"10:00–16:00",analysis:"관광객 대기시간이 길어 설명형 대화가 가능한 후보입니다. 날씨와 운행 여부에 따라 유동 편차가 큽니다.",risk:"시설 운영사 승인 필수·탑승 대기열 방해 금지",pano:"1204400808",pan:"319",zoom:"1",x:"826049",y:"371951"},
  {id:"dongpirang",name:"동피랑벽화마을",address:"경남 통영시 동피랑1길 6-18",zone:"원도심·항남",evidence:"expand",score:65,flow:4,donor:3,dwell:4,setup:2,time:"11:00–17:00",analysis:"중앙시장과 이어지는 관광 보행축입니다. 골목 내부보다 시장 연결부의 넓은 공간을 승인받아 테스트하는 편이 안전합니다.",risk:"주민 생활골목·경사·통행 폭 때문에 부스 난도 높음",pano:"1204416144",pan:"26",zoom:"0",x:"826415",y:"377111"},
  {id:"luge",name:"스카이라인 루지 통영",address:"경남 통영시 발개로 178",zone:"미륵·도남",evidence:"expand",score:63,flow:4,donor:3,dwell:4,setup:2,time:"10:30–16:30",analysis:"가족 관광객 비중과 대기 체류가 강한 주간형 후보입니다. 일반 보도 운영보다 시설 제휴·승인형 캠페인에 적합합니다.",risk:"시설 승인 필수·성수기 대기열과 안전구역 침범 금지",pano:"1204394329",pan:"119",zoom:"-1",x:"825687",y:"371360"},
  {id:"naejukdo",name:"내죽도수변공원",address:"경남 통영시 광도면 죽림리 수변공원 일대",zone:"죽림",evidence:"expand",score:61,flow:3,donor:3,dwell:5,setup:3,time:"17:00–20:30",analysis:"죽림 주민의 산책·가족 체류를 볼 수 있는 저녁형 후보입니다. 날씨가 좋을 때 죽림 상업시설과 연계해 비교하기 좋습니다.",risk:"공원 사용 승인·자전거와 산책 동선 확보",pano:"1204431783",pan:"3",zoom:"-4",x:"824773",y:"386976"},
  {id:"dipirang",name:"디피랑",address:"경남 통영시 남망공원길 29",zone:"원도심·항남",evidence:"expand",score:59,flow:3,donor:3,dwell:4,setup:2,time:"18:30–21:30",analysis:"야간 콘텐츠 관람객을 대상으로 한 특수 시간대 후보입니다. 운영 시간이 제한적이므로 원도심 메인 운영 후 보조 테스트가 적합합니다.",risk:"유료시설·공원 승인 필수·야간 조도와 안전 확인",pano:"1204419205",pan:"52",zoom:"1",x:"826561",y:"376195"}
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const territory = site => `${site.name}/S/R/DISC`;
const mapUrl = site => `https://map.kakao.com/?q=${encodeURIComponent(site.name)}`;
const roadviewUrl = site => `https://map.kakao.com/?panoid=${site.pano}&pan=${site.pan}&zoom=${site.zoom}&map_type=TYPE_MAP&map_attribute=ROADVIEW&urlX=${site.x}&urlY=${site.y}`;
const evidenceLabel = site => site.evidence === "ctm" ? "CTM 검증" : "확장 후보";

function metricBars(site) {
  return [["유동",site.flow],["참여전망",site.donor],["체류",site.dwell],["셋업",site.setup]].map(([label,value]) => `<div><span>${label}</span><b>${value}/5</b></div>`).join("");
}

function ctmProof(site) {
  if (!site.ctm) return "";
  const values = [["Sales",site.ctm.sales],["HC",site.ctm.hc],["P.Avg",site.ctm.pavg],["Scoring",site.ctm.scoring],["성공률",site.ctm.rate],["후원금",site.ctm.donate]];
  return `<dl class="ctm-proof">${values.map(([key,value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
}

function siteCard(site, index) {
  return `<article class="site-card" data-rank="${index + 1}">
    <div class="site-visual">
      <img src="./assets/regions/tongyeong-top20/${site.id}.jpg" alt="${esc(site.name)} 카카오맵 실제 로드뷰" loading="${index < 2 ? "eager" : "lazy"}" decoding="async">
      <span class="rank">TOP ${index + 1}</span><span class="zone">${esc(site.zone)}</span>
      <span class="photo-label">카카오맵 실제 로드뷰 · 운영 전 방향 재확인</span>
      <span class="rank-score"><span><b>${site.score}</b><small>우선지수</small></span></span>
    </div>
    <div class="site-body">
      <div class="site-title-row"><span class="evidence-badge ${site.evidence}">${evidenceLabel(site)}</span><span>RANK ${String(index + 1).padStart(2,"0")}</span></div>
      <h3>${esc(site.name)}</h3><p class="site-address">${esc(site.address)}</p>
      <div class="territory"><span>${esc(territory(site))}</span><button type="button" data-copy-code="${site.id}">복사</button></div>
      <div class="score-bars">${metricBars(site)}</div>${ctmProof(site)}
      <p class="site-analysis">${esc(site.analysis)}</p>
      <div class="site-meta"><div><span>추천 시간</span><p>${esc(site.time)}</p></div><div><span>운영 체크</span><p>${esc(site.risk)}</p></div></div>
      <div class="map-links"><a href="${mapUrl(site)}" target="_blank" rel="noreferrer">카카오맵 위치</a><a class="roadview-link" href="${roadviewUrl(site)}" target="_blank" rel="noreferrer">실제 도로뷰 열기</a></div>
    </div>
  </article>`;
}

function renderSites() {
  const zone = $("#zone-filter").value;
  const evidence = $("#evidence-filter").value;
  const filtered = sites.filter(site => (zone === "all" || site.zone === zone) && (evidence === "all" || site.evidence === evidence));
  $("#site-grid").innerHTML = filtered.map(site => siteCard(site, sites.indexOf(site))).join("");
  $("#site-count").textContent = `${filtered.length}곳 표시`;
}

function showToast(message) {
  const toast = $("#copy-toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1500);
}

async function copyText(text, success) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(success);
  } catch {
    const area = document.createElement("textarea");
    area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
    document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); showToast(success);
  }
}

$("#zone-filter").addEventListener("change", renderSites);
$("#evidence-filter").addEventListener("change", renderSites);
$("#site-grid").addEventListener("click", event => {
  const button = event.target.closest("[data-copy-code]");
  if (!button) return;
  const site = sites.find(item => item.id === button.dataset.copyCode);
  copyText(territory(site), `${site.name} 테리코드를 복사했습니다.`);
});
$("#copy-top20").addEventListener("click", () => copyText(sites.map((site,index) => `${index + 1}. ${site.name}\n${territory(site)}`).join("\n\n"), "통영 TOP 20을 카톡용으로 복사했습니다."));

const ctmSites = sites.filter(site => site.ctm).sort((a,b) => b.ctm.sales - a.ctm.sales);
$("#ctm-table-body").innerHTML = ctmSites.map(site => `<tr><td>${esc(site.name)}</td><td>${site.ctm.sales}</td><td>${site.ctm.hc}</td><td>${site.ctm.pavg}</td><td>${site.ctm.scoring}</td><td>${site.ctm.rate}</td><td>${site.ctm.donate}</td></tr>`).join("");

$$('[data-tab]').forEach(button => button.addEventListener("click", () => {
  $$('[data-tab]').forEach(item => item.classList.toggle("active", item === button));
  $$('[data-panel]').forEach(panel => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
  history.replaceState(null, "", `#${button.dataset.tab}`);
  window.scrollTo({top: 0, behavior: "smooth"});
}));
const initialTab = location.hash.slice(1);
if (initialTab && $(`[data-tab="${initialTab}"]`)) $(`[data-tab="${initialTab}"]`).click();

const formatDate = new Intl.DateTimeFormat("ko-KR", {month:"numeric", day:"numeric"});
const now = new Date();
const daysToTuesday = (2 - now.getDay() + 7) % 7;
const tuesday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToTuesday);
const friday = new Date(tuesday.getFullYear(), tuesday.getMonth(), tuesday.getDate() + 3);
$("#trip-range").textContent = `${formatDate.format(tuesday)} 화 — ${formatDate.format(friday)} 금`;
const localISO = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const weatherIcon = code => ({0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",71:"🌨️",73:"🌨️",75:"🌨️",80:"🌦️",81:"🌧️",82:"⛈️",95:"⛈️",96:"⛈️",99:"⛈️"}[code] || "🌦️");
const weatherText = code => code === 0 ? "맑음" : code <= 2 ? "구름 조금" : code === 3 ? "흐림" : code >= 95 ? "뇌우" : code >= 71 && code < 80 ? "눈" : code >= 51 && code <= 82 ? "비" : "안개";

async function loadWeather() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=34.8544&longitude=128.4332&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FSeoul&forecast_days=10";
    const response = await fetch(url);
    if (!response.ok) throw new Error("weather");
    const data = await response.json();
    const start = localISO(tuesday), end = localISO(friday);
    const indexes = data.daily.time.map((date,index) => date >= start && date <= end ? index : -1).filter(index => index >= 0);
    $("#weather-grid").innerHTML = indexes.map(index => {
      const date = new Date(`${data.daily.time[index]}T12:00:00`), code = data.daily.weather_code[index];
      return `<div class="weather-day"><b>${["일","월","화","수","목","금","토"][date.getDay()]}</b><i>${weatherIcon(code)}</i><span>${Math.round(data.daily.temperature_2m_min[index])}° / ${Math.round(data.daily.temperature_2m_max[index])}°</span><small>${weatherText(code)} · 비 ${data.daily.precipitation_probability_max[index]}%</small></div>`;
    }).join("");
    $("#weather-status").textContent = `실시간 예보 · ${new Date().toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"})} 갱신`;
  } catch {
    $("#weather-status").textContent = "예보 연결 실패 · 잠시 후 새로고침";
  }
}

const goalIds = ["name","theme","kpi","score-a","score-b","score-c","pledge"];
const storageKey = "presence-tongyeong-top20-action-plan";
function calculateClosings() {
  const kpi = Number($("#kpi").value);
  ["a","b","c"].forEach(tier => {
    const score = Number($("#score-" + tier).value);
    $("#close-" + tier).textContent = $("#kpi").value && $("#score-" + tier).value ? `${Math.round(kpi * score)} Closing` : "— Closing";
  });
}
function saveGoal(message = "자동 저장했습니다 ✓") {
  localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(goalIds.map(id => [id, $("#" + id).value]))));
  $("#save-state").textContent = message;
}
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  goalIds.forEach(id => $("#" + id).value = saved[id] || "");
} catch {}
$("#goal-form").addEventListener("input", () => { calculateClosings(); saveGoal(); });
$("#goal-form").addEventListener("submit", event => { event.preventDefault(); saveGoal("내 Action Plan을 저장했습니다 ✓"); });

function lockedNavigation(event) {
  event.preventDefault();
  const password = prompt("관리자 비밀번호를 입력하세요.");
  if (password === "0001") location.href = "./index.html";
  else if (password !== null) alert("비밀번호가 맞지 않습니다.");
}
$("#locked-home").addEventListener("click", lockedNavigation);
$("#locked-brand").addEventListener("click", lockedNavigation);

renderSites();
loadWeather();
calculateClosings();
