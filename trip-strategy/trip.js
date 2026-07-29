const defaultRegions=["춘천","대구","울산","제주","원주","강릉","철원","공주"];
const zoneData=[
  ["제주공항·용담",5,"평일",["스타벅스 제주용담DT점 앞","투썸플레이스 제주용담해안도로점 앞","메가MGC커피 제주용담점 앞","컴포즈커피 제주용담점 앞","다이소 제주용담점 앞","올리브영 제주공항점 인근","이디야커피 제주공항점 인근"]],
  ["연동·신제주",5,"금·토",["다이소 제주연동본점 앞","올리브영 제주연동점 앞","스타벅스 제주노연로점 앞","스타벅스 신제주이마트점 외곽","투썸플레이스 제주연동점 앞","메가MGC커피 제주연동점 앞","컴포즈커피 제주제원점 앞"]],
  ["노형·한라대",5,"금·토",["다이소 제주노형점 앞","올리브영 제주노형점 앞","스타벅스 제주노형점 앞","스타벅스 제주노형로터리점 앞","투썸플레이스 제주노형점 앞","메가MGC커피 제주노형점 앞","이디야커피 제주한라대점 앞"]],
  ["제주시청·이도",5,"평일",["다이소 제주시청점 앞","올리브영 제주시청점 앞","스타벅스 제주도남DT점 앞","스타벅스 제주이도DT점 앞","투썸플레이스 제주시청점 앞","메가MGC커피 제주시청점 앞","컴포즈커피 제주이도점 앞"]],
  ["중앙로·동문",5,"토·일",["다이소 제주동문시장점 앞","올리브영 제주중앙점 앞","스타벅스 제주칠성점 앞","스타벅스 제주탑동점 앞","투썸플레이스 제주중앙로점 앞","메가MGC커피 제주동문시장점 앞","이디야커피 제주탑동점 앞"]],
  ["애월·한림",4,"토·일",["다이소 제주한림점 앞","올리브영 제주협재점 앞","스타벅스 제주애월DT점 앞","스타벅스 제주한담해변DT점 앞","투썸플레이스 제주애월한담점 앞","메가MGC커피 제주한림점 앞","컴포즈커피 제주애월점 앞"]],
  ["함덕·조천",4,"토·일",["다이소 제주함덕점 앞","올리브영 제주함덕점 앞","스타벅스 제주함덕점 앞","스타벅스 제주세화DT점 앞","투썸플레이스 제주함덕점 앞","메가MGC커피 제주조천점 앞","컴포즈커피 제주함덕점 앞"]],
  ["성산·표선",4,"주말",["다이소 제주성산점 앞","올리브영 제주성산점 앞","스타벅스 제주성산일출봉점 앞","스타벅스 제주표선점 앞","투썸플레이스 제주성산점 앞","메가MGC커피 제주성산점 앞","컴포즈커피 제주표선점 앞"]],
  ["서귀포·올레시장",5,"금·토",["다이소 서귀포중앙점 앞","올리브영 서귀포광장점 앞","스타벅스 서귀포중정DT점 앞","스타벅스 제주서귀포점 앞","투썸플레이스 서귀포중앙점 앞","메가MGC커피 서귀포올레시장점 앞","컴포즈커피 서귀포중앙점 앞"]],
  ["중문·대정",4,"주말",["다이소 제주중문점 앞","올리브영 제주중문점 앞","스타벅스 제주중문DT점 앞","스타벅스 제주송악산점 앞","투썸플레이스 제주중문점 앞","메가MGC커피 제주모슬포점 앞","컴포즈커피 제주대정점 앞"]]
];
const baseSites=zoneData.flatMap(([zone,flow,day,names],zoneIndex)=>names.map((name,index)=>({
  id:`jeju-${String(zoneIndex*7+index+1).padStart(3,"0")}`,region:"제주",zone,name,flow:Math.max(1,flow-(index>4?1:0)),day,
  address:`제주특별자치도 ${zone.split("·")[0]} 권역 · ${name}`,
  shade:index%3===0?"가로수+건물 복합 그늘":index%3===1?"건물 입면 그늘":"가로수 그늘",
  sunlight:index%7===6?"sun":index%3===1?"partial":"shade",
  note:"매장·상가 출입축을 피한 보도 안쪽 후보. 12–16시 그늘과 보행 유효폭을 현장에서 재확인.",
  source:"브랜드 매장·관광·상권·교통 거점 기반 사전답사 우선순위"
})));
let regions=[...defaultRegions];
let cloudRegions=[];
let customSites=[];
let activeRegion="제주";
let fb=null,db=null,shared=false;
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const mapUrl=(provider,item)=>{
  if(item.mapUrl&&provider==="kakao")return item.mapUrl;
  const q=encodeURIComponent(`${item.name} 제주`);
  return provider==="kakao"?`https://map.kakao.com/?q=${q}`:`https://map.naver.com/p/search/${q}`;
};
function brandName(name){
  return ["다이소","스타벅스","올리브영","투썸플레이스","메가MGC커피","컴포즈커피","이디야커피"].find(brand=>name.includes(brand))||"BRAND";
}
function guideThumbnail(item){
  const brand=brandName(item.name),palette={
    "다이소":["#d82435","#fff"],"스타벅스":["#00754a","#fff"],"올리브영":["#9acb3b","#182513"],
    "투썸플레이스":["#7b1733","#fff"],"메가MGC커피":["#ffd51f","#1d1d1d"],"컴포즈커피":["#f0c400","#151515"],"이디야커피":["#173d78","#fff"],"BRAND":["#41574a","#fff"]
  }[brand];
  const shaded=item.sunlight!=="sun";
  const tree=shaded?`<circle cx="905" cy="155" r="130" fill="#315a3f"/><circle cx="1015" cy="190" r="105" fill="#274b35"/><rect x="940" y="200" width="28" height="270" rx="12" fill="#513a2b"/><path d="M710 430L1200 430L1200 720L510 720Z" fill="#0b1711" opacity=".48"/>`:`<circle cx="1050" cy="115" r="58" fill="#ffd85c"/><circle cx="1050" cy="115" r="82" fill="#ffd85c" opacity=".18"/>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${shaded?"#8fa5ad":"#92cdf2"}"/><stop offset="1" stop-color="#d7e4df"/></linearGradient></defs>
    <rect width="1200" height="720" fill="url(#sky)"/><rect y="165" width="850" height="365" fill="#d8d3ca"/><rect y="205" width="850" height="70" fill="${palette[0]}"/>
    <text x="60" y="255" fill="${palette[1]}" font-family="Arial,sans-serif" font-size="42" font-weight="800">${brand}</text>
    <rect x="55" y="310" width="245" height="205" fill="#52636a"/><rect x="325" y="310" width="245" height="205" fill="#43555d"/><rect x="595" y="310" width="205" height="205" fill="#53666d"/>
    <rect y="520" width="1200" height="200" fill="#a9aaa4"/><path d="M0 585H1200" stroke="#e8e5dc" stroke-width="14"/><path d="M0 650H1200" stroke="#7c7e79" stroke-width="4"/>
    ${tree}<rect x="34" y="548" width="330" height="74" rx="10" fill="#101813" opacity=".82"/>
    <text x="58" y="580" fill="#d7ff55" font-family="Arial,sans-serif" font-size="20" font-weight="800">SETUP GUIDE VIEW</text>
    <text x="58" y="607" fill="#fff" font-family="Arial,sans-serif" font-size="17">매장 전면 · 보도 · ${shaded?"그늘 후보":"햇빛 노출"}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function lightInfo(item){
  if(item.sunlight==="sun")return {icon:"☀",label:"햇빛 강함",className:"sun"};
  if(item.sunlight==="partial")return {icon:"◐",label:"부분 그늘",className:"partial"};
  return {icon:"●",label:"그늘 좋음",className:"shade"};
}
function allSites(){return [...baseSites,...customSites].filter(item=>item.region===activeRegion)}
function renderRegions(){
  regions=[...new Set([...defaultRegions,...cloudRegions])];
  $("#region-tabs").innerHTML=regions.map(region=>`<button type="button" role="tab" aria-selected="${region===activeRegion}" class="${region===activeRegion?"active":""}" data-region="${escapeHtml(region)}">${escapeHtml(region)}${region==="제주"?" · 70":""}</button>`).join("");
}
function card(item){
  const stars="★".repeat(item.flow)+"☆".repeat(5-item.flow);
  const light=lightInfo(item);
  return `<article class="card">
    <div class="visual">
      <img src="${item.imageData||guideThumbnail(item)}" alt="${escapeHtml(item.name)} 매장 전면과 보도 그늘 셋업 가이드 구도" loading="lazy">
      <span class="zone">${escapeHtml(item.zone)}</span>
      <span class="light-badge ${light.className}"><i>${light.icon}</i>${light.label}</span>
      <span class="guide-label">가이드 구도 · 거리뷰 재확인</span>
    </div>
    <div class="body">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="meta"><span>${escapeHtml(item.shade)}</span><span>추천 ${escapeHtml(item.day)}</span></div>
      <p class="flow">${stars} <b>유동 ${item.flow}</b></p>
      <p class="address">${escapeHtml(item.address)}</p>
      <p class="note">${escapeHtml(item.note)}</p>
      <p class="source">${escapeHtml(item.source||"직접 추가")}</p>
      <div class="links"><a href="${mapUrl("naver",item)}" target="_blank" rel="noreferrer">네이버 지도</a><a href="${mapUrl("kakao",item)}" target="_blank" rel="noreferrer">카카오맵</a></div>
    </div>
  </article>`;
}
function render(){
  const q=$("#search").value.trim().toLowerCase(),flow=Number($("#flow-filter").value),day=$("#day-filter").value;
  const items=allSites().filter(item=>(!flow||item.flow===flow)&&(day==="전체"||item.day===day)&&`${item.name} ${item.zone} ${item.address}`.toLowerCase().includes(q));
  $("#spot-grid").innerHTML=items.map(card).join("");
  $("#empty").hidden=items.length>0;$("#result-count").textContent=`${items.length}개 표시`;
  $("#list-title").textContent=`${activeRegion} 필드 후보`;
  $("#total-count").textContent=allSites().length;
}
$("#region-tabs").addEventListener("click",event=>{const button=event.target.closest("[data-region]");if(!button)return;activeRegion=button.dataset.region;renderRegions();render()});
["#search","#flow-filter","#day-filter"].forEach(selector=>$(selector).addEventListener(selector==="#search"?"input":"change",render));
const regionDialog=$("#region-dialog"),siteDialog=$("#site-dialog");
function openDialog(dialog){dialog.showModal();document.body.style.overflow="hidden"}
function closeDialog(dialog){dialog.close();document.body.style.overflow=""}
$("#add-region").addEventListener("click",()=>{$("#region-form").reset();openDialog(regionDialog)});
$("#add-site").addEventListener("click",()=>{$("#site-form").reset();openDialog(siteDialog)});
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>closeDialog(button.dataset.close==="region"?regionDialog:siteDialog)));
$("#region-form").addEventListener("submit",async event=>{
  event.preventDefault();const name=$("#region-name").value.trim();if(!name)return;
  if(shared)await fb.set(fb.ref(db,`summerStrategy/tripRegions/${encodeURIComponent(name)}`),{name,createdAt:new Date().toISOString()});
  else{const local=JSON.parse(localStorage.getItem("presence-trip-regions")||"[]");local.push(name);localStorage.setItem("presence-trip-regions",JSON.stringify(local));cloudRegions=local}
  activeRegion=name;renderRegions();render();closeDialog(regionDialog);
});
$("#site-form").addEventListener("submit",async event=>{
  event.preventDefault();const id=`trip-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const item={id,region:activeRegion,name:$("#site-name").value.trim(),zone:$("#site-zone").value.trim(),address:$("#site-address").value.trim(),flow:Number($("#site-flow").value),day:$("#site-day").value,mapUrl:$("#site-map").value.trim(),shade:"현장 그늘 확인",sunlight:"partial",note:$("#site-note").value.trim()||"보도 경계·그늘 시간·출입 동선을 현장에서 확인.",source:"팀 직접 추가",createdAt:new Date().toISOString()};
  try{if(shared)await fb.set(fb.ref(db,`summerStrategy/tripSites/${id}`),item);else{const local=JSON.parse(localStorage.getItem("presence-trip-sites")||"[]");local.push(item);localStorage.setItem("presence-trip-sites",JSON.stringify(local));customSites=local}render();$("#site-message").textContent=shared?"Firebase에 공용 저장했습니다.":"기기에 임시 저장했습니다.";setTimeout(()=>closeDialog(siteDialog),550)}catch(error){$("#site-message").textContent="저장하지 못했습니다. 연결 상태를 확인해 주세요."}
});
async function initFirebase(){
  const config={apiKey:"AIzaSyCYKKnK8myrSM-eip9HEJxYRq_hzpfPUY0",authDomain:"presence-team.firebaseapp.com",databaseURL:"https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"presence-team",storageBucket:"presence-team.firebasestorage.app",messagingSenderId:"1056684483470",appId:"1:1056684483470:web:1f50113d410b53458d3adf"};
  try{
    const [appApi,authApi,dbApi]=await Promise.all([import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js")]);
    let app;try{app=appApi.getApp("presence-trip-strategy")}catch(error){app=appApi.initializeApp(config,"presence-trip-strategy")}
    const auth=authApi.getAuth(app);if(typeof auth.authStateReady==="function")await auth.authStateReady();if(!auth.currentUser)await authApi.signInAnonymously(auth);
    db=dbApi.getDatabase(app);fb=dbApi;shared=true;
    dbApi.onValue(dbApi.ref(db,".info/connected"),snap=>{const el=$("#sync-status");el.classList.toggle("live",!!snap.val());el.querySelector("b").textContent=snap.val()?"Firebase 공용 동기화 ON":"오프라인 임시 저장";el.querySelector("span").textContent=snap.val()?"지역과 직접 추가 사이트가 모든 기기에 반영됩니다.":"연결되면 다시 공용 데이터와 맞춥니다."});
    dbApi.onValue(dbApi.ref(db,"summerStrategy/tripRegions"),snap=>{cloudRegions=Object.values(snap.val()||{}).map(item=>item.name);renderRegions()});
    dbApi.onValue(dbApi.ref(db,"summerStrategy/tripSites"),snap=>{customSites=Object.values(snap.val()||{});render()});
  }catch(error){console.error("Trip Firebase unavailable",error);$("#sync-status").querySelector("b").textContent="오프라인 임시 저장"}
}
cloudRegions=JSON.parse(localStorage.getItem("presence-trip-regions")||"[]");customSites=JSON.parse(localStorage.getItem("presence-trip-sites")||"[]");
renderRegions();render();initFirebase();
