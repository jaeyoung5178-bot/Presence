const ZONES=[
  {id:'medical-south',time:'13:00',kind:'medical',title:'남측 메디컬 빌딩군',area:'인하로 남측 · 터미널 방향',lat:37.44366,lng:126.70254,targets:['독립 병의원','안과·이비인후과','피부·성형외과'],reason:'점심 진료 재개 직후 데스크가 정리되는 시간입니다. 대기가 길면 실장·원장 연결 가능 시간만 확인하세요.',query:'구월동 로데오 병원'},
  {id:'link126',time:'13:35',kind:'medical',title:'예술로126 · 링크126',area:'로데오 남중앙 전문상가',lat:37.44462,lng:126.70160,targets:['메디컬','뷰티·안경','전문 서비스'],reason:'병의원과 전문 서비스가 섞인 대형 상가입니다. 층별 안내판을 먼저 보고 A등급 독립 매장부터 위로 올라갑니다.',query:'인천 남동구 예술로 126'},
  {id:'north-pro',time:'14:10',kind:'academy',title:'예술회관역 · 북측 전문상가',area:'예술회관역 4번 출구 방향',lat:37.44749,lng:126.70121,targets:['학원·교습소','스튜디오','운동·서비스'],reason:'수업과 예약이 몰리기 전 원장·실장 접촉을 우선합니다. 14시 수업 중이면 16시 이후 재방문 시간을 잡으세요.',query:'예술회관역 학원 구월동'},
  {id:'market-block',time:'14:40',kind:'academy',title:'구월도매시장 · 중앙 상가',area:'로데오 북중앙 골목',lat:37.44630,lng:126.70218,targets:['개인 사무실','미용·스튜디오','소형 학원'],reason:'개인 운영 업종이 섞인 블록입니다. 건물 입구의 층별 간판에서 점주·원장 직영 가능성이 높은 곳만 추립니다.',query:'구월동 로데오 구월도매시장'},
  {id:'food-street',time:'15:00',kind:'food',title:'로데오 음식문화거리',area:'중앙 먹자골목',lat:37.44544,lng:126.70239,targets:['개인 식당','브레이크타임 매장','지역 카페'],reason:'점심 정리 후 저녁 준비 전 핵심 시간입니다. 문 앞 브레이크타임 표시를 확인하고, 점주가 있는 매장부터 방문합니다.',query:'구월로데오 음식문화거리'},
  {id:'newcore-south',time:'16:00',kind:'food',title:'뉴코아 · 남측 먹자라인',area:'뉴코아아울렛 인천점 주변',lat:37.44410,lng:126.70080,targets:['개인 카페·베이커리','미용·안경','관심 매장 재방문'],reason:'대형 직영점은 후순위로 두고 주변 개인 매장과 앞선 구역의 관심 매장을 재방문해 다음 액션을 확정합니다.',query:'뉴코아아울렛 인천점 주변 맛집'}
];
const STORE_KEY='presence_b2b_guwol_v1';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const naver=q=>`https://map.naver.com/p/search/${encodeURIComponent(q)}`;
const road=z=>`https://map.kakao.com/link/roadview/${z.lat},${z.lng}`;
let state={date:'',zones:{}},map,markers={},activeId=ZONES[0].id;

function load(){try{state={...state,...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}}catch(e){}const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const d=[tomorrow.getFullYear(),String(tomorrow.getMonth()+1).padStart(2,'0'),String(tomorrow.getDate()).padStart(2,'0')].join('-');if(!state.date)state.date=d;$('#field-date').value=state.date}
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(state));updateProgress()}
function zoneState(id){return state.zones[id]||(state.zones[id]={status:'pending',note:''})}
function isDone(s){return ['visited','interest','followup','hold'].includes(s)}

function renderList(){
  $('#route-list').innerHTML=ZONES.map((z,i)=>{const s=zoneState(z.id);return `<article class="route-item ${z.id===activeId?'is-active':''} ${isDone(s.status)?'is-done':''}" data-id="${z.id}" data-kind="${z.kind}">
    <button class="route-main" type="button" data-open="${z.id}" aria-expanded="${z.id===activeId}"><span class="route-num">${i+1}</span><span class="route-copy"><span>${z.time} · ${z.kind==='medical'?'병원 우선':z.kind==='academy'?'학원·전문상가':'식당·카페'}</span><h3>${esc(z.title)}</h3><p>${esc(z.area)}</p></span><span class="route-arrow">›</span></button>
    <div class="route-detail"><p>${esc(z.reason)}</p><div class="targets">${z.targets.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="route-links"><a class="nv" href="${naver(z.query)}" target="_blank" rel="noreferrer">네이버지도 ↗</a><a href="${road(z)}" target="_blank" rel="noreferrer">거리뷰 ↗</a></div><div class="field-log"><select data-status="${z.id}" aria-label="${esc(z.title)} 방문 결과"><option value="pending">대기</option><option value="visited">방문 완료</option><option value="interest">관심 · 후속 필요</option><option value="followup">재방문 예약</option><option value="hold">보류 · 거절</option></select><input data-note="${z.id}" maxlength="80" placeholder="담당자·재방문 시간 메모" value="${esc(s.note)}"></div></div>
  </article>`}).join('');
  ZONES.forEach(z=>{const s=zoneState(z.id);const sel=document.querySelector(`[data-status="${z.id}"]`);if(sel)sel.value=s.status});
  $$('[data-open]').forEach(b=>b.onclick=()=>activate(b.dataset.open));
  $$('[data-status]').forEach(el=>el.onchange=()=>{zoneState(el.dataset.status).status=el.value;save();renderList();refreshMarkers()});
  $$('[data-note]').forEach(el=>el.oninput=()=>{zoneState(el.dataset.note).note=el.value;save()});
}
function updateProgress(){const done=ZONES.filter(z=>isDone(zoneState(z.id).status)).length;$('#progress-value').textContent=`${done} / ${ZONES.length}`;$('#progress-bar').style.width=`${done/ZONES.length*100}%`}
function activate(id){activeId=id;renderList();const z=ZONES.find(x=>x.id===id);if(map&&z){map.flyTo([z.lat,z.lng],18,{duration:.45});markers[id]?.openPopup()}if(innerWidth<1121)document.querySelector(`[data-id="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'})}
function icon(z){const done=isDone(zoneState(z.id).status);return L.divIcon({className:'',html:`<span class="pin ${done?'done':z.kind}"><b>${ZONES.indexOf(z)+1}</b></span>`,iconSize:[40,40],iconAnchor:[20,38],popupAnchor:[0,-34]})}
function refreshMarkers(){if(!map)return;ZONES.forEach(z=>markers[z.id]?.setIcon(icon(z)))}

function initMap(){
  if(!window.L){$('#map').innerHTML='<div style="display:grid;place-items:center;height:100%;padding:30px;text-align:center;color:#a8b0be">지도를 불러오지 못했습니다.<br>상단 네이버지도 버튼을 이용해 주세요.</div>';return}
  map=L.map('map',{zoomControl:false,minZoom:15,maxZoom:20}).setView([37.44545,126.70172],18);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'&copy; OpenStreetMap'}).addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.rectangle([[37.44312,126.70025],[37.44825,126.70385]],{color:'#58d39b',weight:2,fillColor:'#58d39b',fillOpacity:.045,dashArray:'7 8'}).addTo(map);
  L.polyline(ZONES.map(z=>[z.lat,z.lng]),{color:'#315fef',weight:5,opacity:.72,dashArray:'10 9'}).addTo(map);
  ZONES.forEach(z=>{const m=L.marker([z.lat,z.lng],{icon:icon(z),title:z.title}).addTo(map);m.bindPopup(`<div class="popup"><h3>${esc(z.time)} · ${esc(z.title)}</h3><p>${esc(z.targets.join(' · '))}</p><a href="${naver(z.query)}" target="_blank" rel="noreferrer">네이버지도 열기 ↗</a></div>`);m.on('click',()=>{activeId=z.id;renderList()});markers[z.id]=m});
  setTimeout(()=>map.invalidateSize(),120);
}

$('#field-date').onchange=e=>{state.date=e.target.value;save()};
$('#reset').onclick=()=>{if(!confirm('구월동 방문 결과와 메모를 모두 초기화할까요?'))return;state.zones={};save();renderList();refreshMarkers()};
$('#locate').onclick=()=>{if(!navigator.geolocation)return alert('현재 위치를 사용할 수 없습니다.');navigator.geolocation.getCurrentPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude];map.flyTo(ll,18);L.circleMarker(ll,{radius:9,color:'#fff',weight:3,fillColor:'#58d39b',fillOpacity:1}).addTo(map).bindPopup('현재 위치').openPopup()},()=>alert('위치 권한을 확인해 주세요.'),{enableHighAccuracy:true,timeout:8000})};
load();renderList();updateProgress();initMap();
