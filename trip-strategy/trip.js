const defaultRegions=["강릉·동해·삼척","제주","춘천","대구","울산","원주","철원","공주"];
const storeGroups=[
  ["다이소",["버거킹 제주함덕DT점","버거킹 서귀포시청점","다이소 서귀포중문점","다이소 용담해안도로점","버거킹 제주애월DT점","다이소 서귀포혁신도시점","다이소 제주시청점","버거킹 제주민속오일장DT점","다이소 서귀포점"]],
  ["스타벅스",["스타벅스 제주서해안로DT점","스타벅스 제주협재점","스타벅스 더제주송당파크R점","스타벅스 제주중문점","스타벅스 성산일출봉점","스타벅스 제주세화DT점","스타벅스 제주공항DT점","스타벅스 제주한담해변DT점","스타벅스 서귀포DT점"]],
  ["올리브영",["올리브영 제주함덕점","올리브영 제주시청점","KFC 제주시청","KFC 제주노형","올리브영 서귀포혁신도시점","KFC 제주서귀포DI점","올리브영 제주연동점","올리브영 제주용담점","KFC 제주연동신라"]],
  ["투썸플레이스",["투썸플레이스 제주노형DT점","투썸플레이스 제주연동점","투썸플레이스 제주노형오거리점","투썸플레이스 제주남원농협하나로마트점","투썸플레이스 제주대병원점","투썸플레이스 제주오라점","투썸플레이스 제주엠제이벤처오름점","투썸플레이스 제주애월하귀점","투썸플레이스 곽지과물해변점"]],
  ["메가MGC커피",["KFC 제주아라","메가MGC커피 제주중문점","KFC 제주삼화","배스킨라빈스 제주함덕점","배스킨라빈스 제주서귀포","메가MGC커피 제주동홍중앙점","메가MGC커피 제주아라점","배스킨라빈스 제주하귀점","메가MGC커피 협재해수욕장점"]],
  ["컴포즈커피",["컴포즈커피 서귀포일호광장점","배스킨라빈스 제주삼화","컴포즈커피 제주함덕점","컴포즈커피 제주이호테우점","배스킨라빈스 제주서사라점","컴포즈커피 제주서사라점","배스킨라빈스 제주도청점","컴포즈커피 제주아라점","컴포즈커피 제주연동점"]],
  ["이디야커피",["이디야커피 제주일도점","배스킨라빈스 신제주점","이디야커피 제주연동점","이디야커피 제주외도점","이디야커피 서귀포위미점","이디야커피 제주삼도점","이디야커피 제주연북로점","이디야커피 서귀포동홍점"]],
  ["맥도날드",["맥도날드 제주노형DT점","맥도날드 서귀포DT점","맥도날드 제주 외도DT점","맥도날드 제주중문DT점","맥도날드 제주탑동점","맥도날드 제주일도DT점","맥도날드 제주시청DT점","맥도날드 제주공항DT점"]],
  ["다이소 추가",["다이소 제주연동점","다이소 롯데마트제주점","다이소 제주노형점","다이소 제주도남점","다이소 제주동문시장점","다이소 제주본점","다이소 제주봉개점","다이소 제주삼양점","다이소 제주세화점","다이소 제주애월점"]]
];
const capturedStreetviews=new Set([...Array.from({length:70},(_,index)=>index+1),73,79,80]);
const verifiedStorePhotos={
  73:{label:"실제 매장 외관 · 현장 재확인",source:"다이소 제주노형점 실제 외관 · 네이버 블로그 현장사진"},
  79:{label:"실제 매장 외관 · 현장 재확인",source:"다이소 제주세화점 실제 외관 · 네이버 블로그 현장사진"},
  80:{label:"실제 매장 외관 · 현장 재확인",source:"다이소 제주애월점 실제 외관 · 트리플 등록사진"}
};
const officialDaisoInfo={
  "다이소 제주연동점":"제주특별자치도 제주시 신대로 105 (연동)",
  "다이소 롯데마트제주점":"제주특별자치도 제주시 연북로 1 (노형동) 2층",
  "다이소 제주노형점":"제주특별자치도 제주시 1100로 3325 (노형동)",
  "다이소 제주도남점":"제주특별자치도 제주시 연북로 424 (도남동)",
  "다이소 제주동문시장점":"제주특별자치도 제주시 관덕로 68 (일도일동)",
  "다이소 제주본점":"제주특별자치도 제주시 남광로 220 (건입동)",
  "다이소 제주봉개점":"제주특별자치도 제주시 번영로 526 (봉개동)",
  "다이소 제주삼양점":"제주특별자치도 제주시 일주동로 422 (삼양이동)",
  "다이소 제주세화점":"제주특별자치도 제주시 구좌읍 일주동로 3126",
  "다이소 제주애월점":"제주특별자치도 제주시 애월읍 애원로 38"
};
function zoneOf(name){
  if(/서귀포|중문|남원|동홍|위미|표선|대정/.test(name))return "서귀포권";
  if(/협재|한림|애월|곽지|하귀/.test(name))return "제주서부";
  if(/함덕|세화|송당|성산/.test(name))return "제주동부";
  if(/용담|공항|서해안/.test(name))return "공항·용담";
  if(/연동|노형|외도|이호/.test(name))return "연동·노형";
  return "제주시내";
}
const verifiedNames=storeGroups.flatMap(([,names])=>names);
const jejuSites=verifiedNames.map((name,index)=>{
  const number=index+1,zone=zoneOf(name),hasStreetview=capturedStreetviews.has(number);
  return {
  id:`jeju-${String(number).padStart(3,"0")}`,region:"제주",zone,name,flow:/공항|시청|연동|노형|동문|중문|성산/.test(name)?5:/협재|애월|함덕|서귀포/.test(name)?4:3,day:/협재|애월|함덕|성산|중문/.test(name)?"토·일":"금·토",
  address:officialDaisoInfo[name]||`제주특별자치도 ${zone} · 네이버 지도 등록 지점`,
  shade:hasStreetview?"거리뷰에서 그늘 재판독":"거리뷰 미제공·현장 확인",
  sunlight:hasStreetview?(index%3===1?"partial":"shade"):"sun",
  imageData:hasStreetview?`./assets/streetview/thumbs/jeju-${String(number).padStart(3,"0")}.jpg`:null,
  photoVerified:hasStreetview,
  note:name==="다이소 제주연동점"?"팀 현장 성과 우수 지점 · 실제 후원자 접점이 좋았던 연동권 최우선 재답사 후보. 출입축과 12–16시 건물 그늘을 재확인.":"매장·상가 출입축을 피한 보도 안쪽 후보. 12–16시 그늘과 보행 유효폭을 현장에서 재확인.",
  photoLabel:verifiedStorePhotos[number]?.label,
  source:verifiedStorePhotos[number]?.source||(hasStreetview?"네이버 지도 등록 지점 · 실제 거리뷰 캡처":officialDaisoInfo[name]?"다이소 공식 매장검색 확인 · 거리뷰 추가 수집 대상":"네이버 지도 등록 지점 · 거리뷰 미제공")
}});
const ctmAddedSites=[];
const ctmProxyImageIds=new Set(["ctm-001","ctm-003","ctm-005","ctm-006","ctm-010","ctm-013","ctm-016","ctm-020","ctm-021","ctm-022","ctm-030","ctm-032","ctm-038","ctm-039","ctm-041","ctm-046"]);
ctmRecords.forEach((record,index)=>{
  const existing=gangneungDonghaeSites.find(site=>ctmCanonical(site.name)===record.canonical);
  if(existing){existing.ctm=record;return}
  const highPriority=record.pAvg>=2||record.sales>=30;
  const id=`ctm-${String(index+1).padStart(3,"0")}`;
  ctmAddedSites.push({
    id,region:"강릉·동해·삼척",zone:`${record.city} CTM`,name:record.name,
    flow:record.pAvg>=2.5?5:record.pAvg>=1.3?4:record.pAvg>=.8?3:2,
    day:"화–금",address:`강원특별자치도 ${record.city} · CTM 원자료 등록 지점`,shade:"그늘·보도폭 현장 확인",sunlight:"partial",
    imageData:`./assets/streetview/gangwon/${id}.jpg`,photoVerified:true,
    photoLabel:ctmProxyImageIds.has(id)?"네이버 인접 권역 거리뷰 · 현장 방향 재확인":"네이버 실제 거리뷰 · 현장 방향 재확인",
    note:`CTM 실적 기반 ${highPriority?"우선 답사":"운영 후보"}. 동일 장소의 표기 차이는 통합했으며 정확한 셋업 면은 지도와 현장에서 확인.`,
    source:"카카오맵 장소명 기준 · CTM 제공 이미지 원자료",ctm:record,main:false
  });
});
const baseSites=[...jejuSites,...gangneungDonghaeSites,...ctmAddedSites];
let regions=[...defaultRegions];
let cloudRegions=[];
let customSites=[];
let activeRegion="강릉·동해·삼척";
let fb=null,db=null,shared=false;
let storageApi=null,storage=null;
let scoreMatcher=null;
let tripStrategies=JSON.parse(localStorage.getItem("presence-trip-strategies")||"{}");
let tripRecords=[];
let siteMedia={};
let tripGoalUserId="local";
let goalSaveTimer=null;
const tripRegion="강릉·동해·삼척";
const isTripAdmin=(()=>{try{return localStorage.getItem("presence_hub_admin")==="1"}catch(error){return false}})();
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const mapUrl=(provider,item)=>{
  if(item.mapUrl&&provider==="kakao")return item.mapUrl;
  const q=encodeURIComponent(`${item.name} ${item.address||item.region}`);
  return provider==="kakao"?`https://map.kakao.com/?q=${q}`:`https://map.naver.com/p/search/${q}`;
};
const metroPattern=/서울|인천|경기|수원|성남|고양|용인|부천|안산|안양|남양주|화성|평택|의정부|시흥|파주|광명|김포|군포|광주|이천|양주|오산|구리|안성|포천|의왕|하남|여주|동두천|과천/;
const territoryType=item=>metroPattern.test(`${item.region} ${item.zone} ${item.address}`)?"C":"R";
const terryCode=item=>`${item.name}/S/${territoryType(item)}/DISC`;
function brandName(name){
  return ["다이소","스타벅스","올리브영","투썸플레이스","메가MGC커피","컴포즈커피","이디야커피","맥도날드","버거킹","KFC","배스킨라빈스"].find(brand=>name.includes(brand))||"BRAND";
}
function guideThumbnail(item){
  const brand=brandName(item.name);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <rect width="1200" height="720" fill="#1d2923"/><circle cx="980" cy="120" r="230" fill="#d7ff55" opacity=".05"/>
    <text x="70" y="275" fill="#d7ff55" font-family="Arial,sans-serif" font-size="34" font-weight="800">${brand}</text>
    <text x="70" y="355" fill="#f5f7f4" font-family="Arial,sans-serif" font-size="52" font-weight="800">거리뷰 미제공</text>
    <text x="70" y="415" fill="#aeb9b2" font-family="Arial,sans-serif" font-size="28">지도 링크에서 위치 확인 · 현장사진 추가 필요</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function lightInfo(item){
  if(!item.photoVerified)return {icon:"?",label:"그늘 미확인",className:"unknown"};
  if(item.sunlight==="sun")return {icon:"☀",label:"햇빛 강함",className:"sun"};
  if(item.sunlight==="partial")return {icon:"◐",label:"부분 그늘",className:"partial"};
  return {icon:"●",label:"그늘 좋음",className:"shade"};
}
function mergedSite(item){const media=siteMedia[item.id]||{};return {...item,...(media.guidePhotoUrl?{imageData:media.guidePhotoUrl,photoVerified:true,photoLabel:"팀 현장 셋업 위치 캡처 · 최신"}:{})}}
function allSites(){return [...baseSites,...customSites].filter(item=>item.region===activeRegion).map(mergedSite)}
function recordsFor(siteId){return tripRecords.filter(record=>record.siteId===siteId).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))}
function renderRegions(){
  regions=[...new Set([...defaultRegions,...cloudRegions])];
  if(!isTripAdmin)activeRegion=tripRegion;
  const visibleRegions=isTripAdmin?regions:[tripRegion];
  $("#region-tabs").innerHTML=visibleRegions.map(region=>`<button type="button" role="tab" aria-selected="${region===activeRegion}" class="${region===activeRegion?"active":""}" data-region="${escapeHtml(region)}">${escapeHtml(region)}${region==="제주"?` · ${jejuSites.length}`:region===tripRegion?` · ${gangneungDonghaeSites.length+ctmAddedSites.length}`:""}</button>`).join("");
}
function card(item){
  const stars="★".repeat(item.flow)+"☆".repeat(5-item.flow);
  const light=lightInfo(item);
  const scoreHistory=scoreMatcher?.find(item.name);
  const strategy=tripStrategies[item.id]?.text;
  const records=recordsFor(item.id),recentRecords=records.slice(0,3);
  return `<article class="card${item.main?" is-main":""}">
    <div class="visual">
      <img src="${item.imageData||guideThumbnail(item)}" alt="${escapeHtml(item.name)} 매장 전면과 보도 그늘 셋업 가이드 구도" loading="lazy">
      ${item.main?`<span class="main-badge">MAIN</span>`:""}
      ${item.ctm?`<span class="ctm-badge">CTM 분석자료</span>`:""}
      <span class="zone">${escapeHtml(item.zone)}</span>
      <span class="light-badge ${light.className}"><i>${light.icon}</i>${light.label}</span>
      <span class="guide-label">${escapeHtml(item.photoLabel||(item.photoVerified?"네이버 실제 거리뷰 · 현장 재확인":"거리뷰 미제공 · 현장사진 필요"))}</span>
    </div>
    <div class="body">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="terry-code"><span>${escapeHtml(terryCode(item))}</span><button type="button" data-copy-code="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} 테리코드 복사">복사</button></div>
      <div class="meta"><span>${escapeHtml(item.shade)}</span><span>추천 ${escapeHtml(item.day)}</span></div>
      <p class="flow">${stars} <b>유동 ${item.flow}</b></p>
      <p class="address">${escapeHtml(item.address)}</p>
      <p class="note">${escapeHtml(item.note)}</p>
      <p class="source">${escapeHtml(item.source||"직접 추가")}</p>
      ${item.ctm?`<dl class="ctm-stats"><div><dt>Sales</dt><dd>${item.ctm.sales.toLocaleString()}</dd></div><div><dt>HC</dt><dd>${item.ctm.hc.toLocaleString()}</dd></div><div><dt>P.Avg</dt><dd>${item.ctm.pAvg.toFixed(1)}</dd></div><div><dt>Scoring</dt><dd>${item.ctm.scoring.toLocaleString()}</dd></div><div><dt>성공률</dt><dd>${Math.round(item.ctm.scoringRate)}%</dd></div><div><dt>후원금</dt><dd>${item.ctm.donate.toLocaleString()}원</dd></div></dl>${item.ctm.rawNames.length>1?`<p class="ctm-merged">표기 ${item.ctm.rawNames.length}건 통합 · ${escapeHtml(item.ctm.rawNames.join(" / "))}</p>`:""}`:""}
      ${scoreHistory?`<a class="score-history" href="../peacemaker-scores/index.html?q=${encodeURIComponent(item.name)}"><b>✓ 방문 이력 있음</b><span>${scoreHistory.days}회 · AVG ${scoreHistory.average.toFixed(1)} · 최근 ${escapeHtml(scoreHistory.recent.result)}</span></a>`:`<span class="score-history is-empty"><b>첫 운영 후보</b><span>스코어방 매칭 기록 없음 · 운영 전략 기록 가능</span></span>`}
      ${strategy?`<p class="team-strategy"><b>팀 운영 전략</b>${escapeHtml(strategy)}</p>`:""}
      ${recentRecords.length?`<div class="field-history"><div><b>현장 기록 ${records.length}건</b><a href="./reports.html?site=${encodeURIComponent(item.id)}">전체 보기</a></div>${recentRecords.map(record=>`<article><span>${escapeHtml(record.date)} · ${escapeHtml(record.member)}</span><strong>결과 ${Number(record.result||0)}</strong><p>${escapeHtml(record.feedback)}</p>${record.photoUrls?.length?`<div class="record-thumbs">${record.photoUrls.slice(0,3).map(url=>`<img src="${escapeHtml(url)}" alt="${escapeHtml(item.name)} 실제 셋업사진" loading="lazy">`).join("")}</div>`:""}</article>`).join("")}</div>`:""}
      <div class="links"><a href="${mapUrl("naver",item)}" target="_blank" rel="noreferrer">네이버 지도</a><a href="${mapUrl("kakao",item)}" target="_blank" rel="noreferrer">카카오맵</a><button type="button" data-strategy="${item.id}">${strategy?"전략 수정":"운영 전략"}</button><button class="record-button" type="button" data-record="${item.id}">결과·피드백</button></div>
    </div>
  </article>`;
}
function filteredSites(){
  const q=$("#search").value.trim().toLowerCase(),flow=Number($("#flow-filter").value),day=$("#day-filter").value,source=$("#source-filter").value;
  return allSites().filter(item=>(!flow||item.flow===flow)&&(day==="전체"||item.day===day)&&(source==="전체"||(source==="CTM"?!!item.ctm:!item.ctm))&&`${item.name} ${item.zone} ${item.address}`.toLowerCase().includes(q));
}
function render(){
  const items=filteredSites();
  $("#spot-grid").innerHTML=items.map(card).join("");
  $("#empty").hidden=items.length>0;$("#result-count").textContent=`${items.length}개 표시`;
  $("#list-title").textContent=`${activeRegion} 필드 후보`;
  if($("#total-count"))$("#total-count").textContent=allSites().length;
  if($("#total-label"))$("#total-label").textContent=`${activeRegion} 사전답사 후보`;
}
async function copyText(text,message){
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
    else{const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();document.execCommand("copy");area.remove()}
    const toast=$("#copy-toast");toast.textContent=message;toast.classList.add("show");clearTimeout(copyText.timer);copyText.timer=setTimeout(()=>toast.classList.remove("show"),1800);
  }catch(error){$("#copy-toast").textContent="복사하지 못했습니다. 다시 눌러 주세요.";$("#copy-toast").classList.add("show")}
}
$("#copy-visible").addEventListener("click",()=>{const items=filteredSites();if(!items.length)return;copyText(items.map(terryCode).join("\n"),`${items.length}개 테리코드를 복사했습니다.`)});
$("#region-tabs").addEventListener("click",event=>{const button=event.target.closest("[data-region]");if(!button||(!isTripAdmin&&button.dataset.region!==tripRegion))return;if(button.dataset.region===tripRegion){location.href="./gangwon-playbook.html";return}activeRegion=button.dataset.region;renderRegions();render()});
["#search","#flow-filter","#day-filter","#source-filter"].forEach(selector=>$(selector).addEventListener(selector==="#search"?"input":"change",render));
$("#spot-grid").addEventListener("click",async event=>{
  const copyButton=event.target.closest("[data-copy-code]");
  if(copyButton){const item=[...baseSites,...customSites].find(site=>site.id===copyButton.dataset.copyCode);if(item)await copyText(terryCode(item),`${item.name} 코드를 복사했습니다.`);return}
  const recordButton=event.target.closest("[data-record]");
  if(recordButton){openRecord(recordButton.dataset.record);return}
  const button=event.target.closest("[data-strategy]");if(!button)return;
  const item=[...baseSites,...customSites].find(site=>site.id===button.dataset.strategy);if(!item)return;
  const text=prompt(`${item.name} 운영 전략`,tripStrategies[item.id]?.text||"");
  if(text===null)return;
  const value={text:text.trim(),updatedAt:new Date().toISOString()};
  if(value.text)tripStrategies[item.id]=value;else delete tripStrategies[item.id];
  localStorage.setItem("presence-trip-strategies",JSON.stringify(tripStrategies));render();
  if(shared)await fb.set(fb.ref(db,`summerStrategy/tripStrategies/${item.id}`),value.text?value:null);
});
const regionDialog=$("#region-dialog"),siteDialog=$("#site-dialog"),recordDialog=$("#record-dialog");
function openDialog(dialog){dialog.showModal();document.body.style.overflow="hidden"}
function closeDialog(dialog){dialog.close();document.body.style.overflow=""}
$("#add-region").addEventListener("click",()=>{if(!isTripAdmin)return;$("#region-form").reset();openDialog(regionDialog)});
$("#add-site").addEventListener("click",()=>{$("#site-form").reset();$("#site-guide-preview").hidden=true;openDialog(siteDialog)});
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>closeDialog(button.dataset.close==="region"?regionDialog:button.dataset.close==="record"?recordDialog:siteDialog)));
function openRecord(siteId){
  const item=[...baseSites,...customSites].find(site=>site.id===siteId);if(!item)return;
  $("#record-form").reset();$("#record-site-id").value=siteId;$("#record-date").value=new Date().toLocaleDateString("en-CA");$("#record-hours").value="3";$("#record-title").textContent=`${item.name} 현장 기록`;$("#record-photo-preview").innerHTML="";$("#record-guide-preview").hidden=true;$("#record-message").textContent="";openDialog(recordDialog);
}
function previewFile(input,image){const file=input.files?.[0];if(!file){image.hidden=true;return}image.src=URL.createObjectURL(file);image.hidden=false}
$("#site-guide-photo").addEventListener("change",()=>previewFile($("#site-guide-photo"),$("#site-guide-preview")));
$("#record-guide-photo").addEventListener("change",()=>previewFile($("#record-guide-photo"),$("#record-guide-preview")));
$("#record-photos").addEventListener("change",()=>{$("#record-photo-preview").innerHTML=[...$("#record-photos").files].slice(0,6).map(file=>`<img src="${URL.createObjectURL(file)}" alt="업로드할 셋업사진 미리보기">`).join("")});
async function compressImage(file){
  if(!file?.type?.startsWith("image/"))throw new Error("이미지 파일만 올릴 수 있습니다.");
  const bitmap=await createImageBitmap(file),max=1280,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("사진 변환 실패")),"image/jpeg",.76));
}
async function uploadImage(file,path){
  const blob=await compressImage(file);
  if(!shared||!db)throw new Error("공용 데이터 연결이 필요합니다.");
  if(storageApi&&storage){try{const target=storageApi.ref(storage,`${path}.jpg`);await storageApi.uploadBytes(target,blob,{contentType:"image/jpeg"});return await storageApi.getDownloadURL(target)}catch(error){console.warn("Firebase Storage unavailable; saving optimized image with the shared record.",error.code)}}
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("사진을 읽지 못했습니다."));reader.readAsDataURL(blob)});
}
$("#region-form").addEventListener("submit",async event=>{
  event.preventDefault();const name=$("#region-name").value.trim();if(!name)return;
  if(shared)await fb.set(fb.ref(db,`summerStrategy/tripRegions/${encodeURIComponent(name)}`),{name,createdAt:new Date().toISOString()});
  else{const local=JSON.parse(localStorage.getItem("presence-trip-regions")||"[]");local.push(name);localStorage.setItem("presence-trip-regions",JSON.stringify(local));cloudRegions=local}
  activeRegion=name;renderRegions();render();closeDialog(regionDialog);
});
$("#site-form").addEventListener("submit",async event=>{
  event.preventDefault();const id=`trip-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const item={id,region:activeRegion,name:$("#site-name").value.trim(),zone:$("#site-zone").value.trim(),address:$("#site-address").value.trim(),flow:Number($("#site-flow").value),day:$("#site-day").value,mapUrl:$("#site-map").value.trim(),shade:"현장 그늘 확인",sunlight:"partial",photoVerified:false,note:$("#site-note").value.trim()||"보도 경계·그늘 시간·출입 동선을 현장에서 확인.",source:"팀 직접 추가",createdAt:new Date().toISOString()};
  try{$("#site-message").textContent="사진을 정리해 공용 저장 중…";const photo=$("#site-guide-photo").files?.[0];if(photo){item.imageData=await uploadImage(photo,`trip/site-guides/${id}`);item.photoVerified=true;item.photoLabel="팀 등록 셋업 위치 캡처"}if(shared)await fb.set(fb.ref(db,`summerStrategy/tripSites/${id}`),item);else{const local=JSON.parse(localStorage.getItem("presence-trip-sites")||"[]");local.push(item);localStorage.setItem("presence-trip-sites",JSON.stringify(local));customSites=local}render();$("#site-message").textContent=shared?"사진과 사이트를 공용 저장했습니다.":"기기에 임시 저장했습니다.";setTimeout(()=>closeDialog(siteDialog),700)}catch(error){console.error(error);$("#site-message").textContent=error.message||"저장하지 못했습니다. 연결 상태를 확인해 주세요."}
});
$("#record-form").addEventListener("submit",async event=>{
  event.preventDefault();const id=`record-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,siteId=$("#record-site-id").value,item=[...baseSites,...customSites].find(site=>site.id===siteId);if(!item)return;
  const record={id,siteId,siteName:item.name,region:item.region,date:$("#record-date").value,member:$("#record-member").value.trim(),result:Number($("#record-result").value),hours:Number($("#record-hours").value||0),feedback:$("#record-feedback").value.trim(),createdAt:new Date().toISOString(),photoUrls:[]};
  try{$("#record-message").textContent="현장 사진과 결과를 공용 저장 중…";for(const [index,file] of [...$("#record-photos").files].slice(0,6).entries())record.photoUrls.push(await uploadImage(file,`trip/field-records/${id}/${index+1}`));const guideFile=$("#record-guide-photo").files?.[0];if(guideFile){const guidePhotoUrl=await uploadImage(guideFile,`trip/site-guides/${siteId}-${Date.now()}`);await fb.set(fb.ref(db,`summerStrategy/tripSiteMedia/${siteId}`),{guidePhotoUrl,updatedAt:new Date().toISOString(),updatedBy:record.member})}if(shared)await fb.set(fb.ref(db,`summerStrategy/tripRecords/${id}`),record);else{tripRecords.push(record);localStorage.setItem("presence-trip-records",JSON.stringify(tripRecords));render()}$("#record-message").textContent="현장 기록을 저장했습니다.";setTimeout(()=>closeDialog(recordDialog),700)}catch(error){console.error(error);$("#record-message").textContent=error.message||"기록을 저장하지 못했습니다."}
});

const learningChoices=["상가 B2B 공략","공공기관 방문 방법","시간대별 Territory 운영","트립 운영 능력","돌발상황 대처","Closing Skill","Territory 분석","리더십","팀 운영","세일즈 퍼포먼스"];
const promiseChoices=["하루 30 Closing 이상","실제 Field 10시간 이상","감사하는 마음으로 Field 뛰기","하루 한 명 이상 칭찬하기","늦게 자지 않기","컨디션 관리하기","끝까지 긍정적인 태도 유지하기"];
function plannerChoice(value,type){return `<label class="${type==="learning"?"choice":"promise-choice"}"><input type="checkbox" name="goal-${type}" value="${escapeHtml(value)}"><i></i><span>${escapeHtml(value)}</span></label>`}
$("#learning-options").innerHTML=learningChoices.map(value=>plannerChoice(value,"learning")).join("");
$("#promise-options").innerHTML=promiseChoices.map(value=>plannerChoice(value,"promise")).join("");
const plannerIds=["goal-name","goal-theme","goal-kpi","goal-score-a","goal-score-b","goal-score-c","goal-reward-a","goal-reward-b","goal-reward-c","goal-learning-other","goal-promise-1","goal-promise-2","goal-pledge"];
function numberText(value){const number=Number(value);return Number.isFinite(number)&&String(value).trim()!==""?number.toLocaleString("ko-KR",{maximumFractionDigits:1}):"—"}
function updateClosingGoals(){
  const kpi=Number($("#goal-kpi").value),hasKpi=Number.isFinite(kpi)&&$("#goal-kpi").value!=="";
  document.querySelectorAll("[data-summary-kpi]").forEach(element=>element.textContent=hasKpi?numberText(kpi):"—");
  ["a","b","c"].forEach(tier=>{const scoreInput=$(`#goal-score-${tier}`),score=Number(scoreInput.value),hasScore=Number.isFinite(score)&&scoreInput.value!=="",closing=hasKpi&&hasScore?Math.round(kpi*score):null;$("#goal-closing-"+tier).textContent=closing===null?"— Closing":`${closing.toLocaleString()} Closing`;$("#summary-score-"+tier).textContent=hasScore?numberText(score):"—";$("#summary-closing-"+tier).textContent=closing===null?"—":closing.toLocaleString()})
}
function readActionPlan(){
  const values=Object.fromEntries(plannerIds.map(id=>[id.replace(/^goal-/,"").replaceAll("-","_"),$("#"+id).value.trim()]));
  return {...values,learning:[...document.querySelectorAll('[name="goal-learning"]:checked')].map(input=>input.value),promises:[...document.querySelectorAll('[name="goal-promise"]:checked')].map(input=>input.value),region:tripRegion,updatedAt:new Date().toISOString()}
}
function writeActionPlan(plan={}){
  plannerIds.forEach(id=>{const key=id.replace(/^goal-/,"").replaceAll("-","_");$("#"+id).value=plan[key]??""});
  document.querySelectorAll('[name="goal-learning"],[name="goal-promise"]').forEach(input=>{const selected=input.name==="goal-learning"?(plan.learning||[]):(plan.promises||[]);input.checked=selected.includes(input.value)});
  updateClosingGoals()
}
function setPlannerState(message,saved=false){const state=$("#planner-save-state");state.querySelector("span").textContent=message;state.classList.toggle("saved",saved)}
async function persistActionPlan(plan,{cloud=true}={}){
  localStorage.setItem("presence-trip-action-plan",JSON.stringify(plan));setPlannerState("이 기기에 자동 저장됨",true);
  if(cloud&&shared&&fb&&db){await fb.set(fb.ref(db,`summerStrategy/tripActionPlans/${tripGoalUserId}`),plan);setPlannerState("내 Action Plan 동기화 완료",true)}
}
function scheduleActionPlanSave(){
  updateClosingGoals();clearTimeout(goalSaveTimer);setPlannerState("작성 내용을 저장하는 중…");goalSaveTimer=setTimeout(()=>persistActionPlan(readActionPlan()).catch(()=>setPlannerState("기기에 저장됨 · 공용 연결 대기",true)),700)
}
$("#action-plan-form").addEventListener("input",scheduleActionPlanSave);
$("#action-plan-form").addEventListener("change",scheduleActionPlanSave);
$("#action-plan-form").addEventListener("submit",async event=>{event.preventDefault();clearTimeout(goalSaveTimer);try{await persistActionPlan(readActionPlan());setPlannerState("내 Action Plan을 저장했습니다.",true)}catch(error){setPlannerState("기기에 저장됨 · 공용 연결 대기",true)}});
$("#reset-action-plan").addEventListener("click",()=>{if(!confirm("현재 작성한 Action Plan을 비우고 새로 작성할까요?"))return;writeActionPlan();persistActionPlan(readActionPlan()).catch(()=>{});$("#goal-name").focus()});
try{writeActionPlan(JSON.parse(localStorage.getItem("presence-trip-action-plan")||"{}"))}catch(error){writeActionPlan()}
document.body.classList.toggle("member-scope",!isTripAdmin);

async function initFirebase(){
  const config={apiKey:"AIzaSyCYKKnK8myrSM-eip9HEJxYRq_hzpfPUY0",authDomain:"presence-team.firebaseapp.com",databaseURL:"https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"presence-team",storageBucket:"presence-team.firebasestorage.app",messagingSenderId:"1056684483470",appId:"1:1056684483470:web:1f50113d410b53458d3adf"};
  try{
    const [appApi,authApi,dbApi,storeApi]=await Promise.all([import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"),import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js")]);
    let app;try{app=appApi.getApp("presence-trip-strategy")}catch(error){app=appApi.initializeApp(config,"presence-trip-strategy")}
    const auth=authApi.getAuth(app);if(typeof auth.authStateReady==="function")await auth.authStateReady();if(!auth.currentUser)await authApi.signInAnonymously(auth);tripGoalUserId=auth.currentUser.uid;
    db=dbApi.getDatabase(app);fb=dbApi;storageApi=storeApi;storage=storeApi.getStorage(app);shared=true;
    dbApi.onValue(dbApi.ref(db,".info/connected"),snap=>{const el=$("#sync-status");el.classList.toggle("live",!!snap.val());el.querySelector("b").textContent=snap.val()?"Firebase 공용 동기화 ON":"오프라인 임시 저장";el.querySelector("span").textContent=snap.val()?"지역과 직접 추가 사이트가 모든 기기에 반영됩니다.":"연결되면 다시 공용 데이터와 맞춥니다."});
    dbApi.onValue(dbApi.ref(db,"summerStrategy/tripRegions"),snap=>{cloudRegions=Object.values(snap.val()||{}).map(item=>item.name);renderRegions()});
    dbApi.onValue(dbApi.ref(db,"summerStrategy/tripSites"),snap=>{customSites=Object.values(snap.val()||{});render()});
    dbApi.onValue(dbApi.ref(db,"summerStrategy/tripStrategies"),snap=>{tripStrategies={...tripStrategies,...(snap.val()||{})};localStorage.setItem("presence-trip-strategies",JSON.stringify(tripStrategies));render()});
    dbApi.onValue(dbApi.ref(db,"summerStrategy/tripRecords"),snap=>{tripRecords=Object.values(snap.val()||{});render()});
    dbApi.onValue(dbApi.ref(db,"summerStrategy/tripSiteMedia"),snap=>{siteMedia=snap.val()||{};render()});
    dbApi.onValue(dbApi.ref(db,`summerStrategy/tripActionPlans/${tripGoalUserId}`),snap=>{const cloudPlan=snap.val();if(!cloudPlan)return;const localPlan=JSON.parse(localStorage.getItem("presence-trip-action-plan")||"{}");if(!localPlan.updatedAt||String(cloudPlan.updatedAt||"")>String(localPlan.updatedAt)){writeActionPlan(cloudPlan);localStorage.setItem("presence-trip-action-plan",JSON.stringify(cloudPlan))}setPlannerState("내 Action Plan 동기화 완료",true)});
  }catch(error){console.error("Trip Firebase unavailable",error);$("#sync-status").querySelector("b").textContent="오프라인 임시 저장"}
}
cloudRegions=JSON.parse(localStorage.getItem("presence-trip-regions")||"[]");customSites=JSON.parse(localStorage.getItem("presence-trip-sites")||"[]");tripRecords=JSON.parse(localStorage.getItem("presence-trip-records")||"[]");
renderRegions();render();initFirebase();
window.PresenceScoreMatcher?.load("../peacemaker-scores/data/incheon-score-room.json").then(matcher=>{scoreMatcher=matcher;render()}).catch(()=>{});
