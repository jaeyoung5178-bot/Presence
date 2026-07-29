const defaultRegions=["춘천","대구","울산","제주","원주","강릉","철원","공주"];
const zoneData=[
  ["제주공항·용담",5,"평일",["제주국제공항 1번 게이트 외곽 보도","제주공항 국내선 도착층 건너편","용두암 입구 관광안내소 인근","용담해안도로 스타벅스 인근","다이소 제주용담점 인근","용담사거리 대로변 상가 앞","제주민속오일시장 정문 인근"]],
  ["연동·신제주",5,"금·토",["누웨마루거리 북측 입구","누웨마루거리 남측 입구","제원사거리 스타벅스 인근","삼무공원 북측 상가 앞","신라면세점 제주점 건너편","다이소 제주연동점 인근","올리브영 제주연동점 인근"]],
  ["노형·한라대",5,"금·토",["노형오거리 다이소 인근","노형로터리 스타벅스 인근","노형동 드림타워 남측 보도","이마트 신제주점 외곽 보도","롯데마트 제주점 외곽 보도","한라대학교 정문 상가 앞","노형동 올리브영 인근"]],
  ["제주시청·이도",5,"평일",["제주시청 대학로 입구","제주시청 버스정류장 후면 상가","제주법원 사거리 상가 앞","이도지구 다이소 인근","제주대학로 스타벅스 인근","제주중앙여고 사거리 상가 앞","제주보건소 사거리 상가 앞"]],
  ["중앙로·동문",5,"토·일",["동문시장 1번 게이트 외곽","동문시장 8번 게이트 외곽","칠성로 쇼핑거리 입구","제주중앙로사거리 다이소 인근","탑동광장 맞은편 상가 보도","제주목관아 동측 상가 앞","산지천 탐라문화광장 상가측"]],
  ["애월·한림",4,"토·일",["애월한담 산책로 상가 입구","애월읍사무소 사거리 상가 앞","곽지해수욕장 상가측 입구","한림매일시장 외곽 보도","한림읍 다이소 인근","협재해수욕장 상가측 입구","금능해수욕장 주상권 입구"]],
  ["함덕·조천",4,"토·일",["함덕해수욕장 중앙 상가측","함덕 스타벅스 인근 보도","함덕 다이소 인근 상가 앞","조천읍사무소 사거리","김녕해수욕장 상가측 입구","세화오일시장 외곽 보도","월정리 해변 상가거리 입구"]],
  ["성산·표선",4,"주말",["성산일출봉 상가거리 입구","성산항 여객터미널 진입 상가","고성오일시장 외곽 보도","성산읍 다이소 인근","섭지코지 진입 상가 구간","표선오일시장 외곽 보도","표선해수욕장 상가측 입구"]],
  ["서귀포·올레시장",5,"금·토",["서귀포매일올레시장 1번 입구","서귀포매일올레시장 7번 입구","이중섭거리 북측 입구","서귀포 중앙로터리 다이소 인근","서귀포 스타벅스 중앙점 인근","천지연폭포 진입 상가 구간","서귀포시청 1청사 상가측"]],
  ["중문·대정",4,"주말",["중문관광단지 여미지 입구","중문색달해수욕장 상가 입구","제주국제컨벤션센터 외곽 상가","중문동 다이소 인근","대정오일시장 외곽 보도","모슬포 중앙시장 입구","산방산 용머리해안 상가 입구"]]
];
const baseSites=zoneData.flatMap(([zone,flow,day,names],zoneIndex)=>names.map((name,index)=>({
  id:`jeju-${String(zoneIndex*7+index+1).padStart(3,"0")}`,region:"제주",zone,name,flow:Math.max(1,flow-(index>4?1:0)),day,
  address:`제주특별자치도 ${zone.split("·")[0]} 권역 · ${name}`,
  shade:index%3===0?"가로수+건물 복합 그늘":index%3===1?"건물 입면 그늘":"가로수 그늘",
  note:"매장·상가 출입축을 피한 보도 안쪽 후보. 12–16시 그늘과 보행 유효폭을 현장에서 재확인.",
  source:"관광·상권·교통 거점 기반 사전답사 우선순위"
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
function allSites(){return [...baseSites,...customSites].filter(item=>item.region===activeRegion)}
function renderRegions(){
  regions=[...new Set([...defaultRegions,...cloudRegions])];
  $("#region-tabs").innerHTML=regions.map(region=>`<button type="button" role="tab" aria-selected="${region===activeRegion}" class="${region===activeRegion?"active":""}" data-region="${escapeHtml(region)}">${escapeHtml(region)}${region==="제주"?" · 70":""}</button>`).join("");
}
function card(item){
  const stars="★".repeat(item.flow)+"☆".repeat(5-item.flow);
  return `<article class="card">
    <div class="visual"><span class="zone">${escapeHtml(item.zone)}</span><strong>${escapeHtml(item.name)}</strong></div>
    <div class="body">
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
  const item={id,region:activeRegion,name:$("#site-name").value.trim(),zone:$("#site-zone").value.trim(),address:$("#site-address").value.trim(),flow:Number($("#site-flow").value),day:$("#site-day").value,mapUrl:$("#site-map").value.trim(),shade:"현장 그늘 확인",note:$("#site-note").value.trim()||"보도 경계·그늘 시간·출입 동선을 현장에서 확인.",source:"팀 직접 추가",createdAt:new Date().toISOString()};
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
