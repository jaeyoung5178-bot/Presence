const incheonNames = [
  "다이소 인천운서동점","다이소 부평2호점","다이소 인천검단신도시점","다이소 인천청라2호점","다이소 인천신기사거리점","다이소 인천서창점","다이소 인천논현본점","다이소 인천검암점","다이소 인천부개3동점","다이소 주안역점","다이소 인천강남시장점","다이소 인천연안부두점","다이소 인천갈산점",
  "스타벅스 인천구월로데오점","스타벅스 부평역점","스타벅스 송도캐슬파크점","스타벅스 부평사거리점","스타벅스 검단사거리역점","스타벅스 인천당하DT점","스타벅스 제물포역DT점","스타벅스 루원앨리스빌점","스타벅스 아라동사거리점","스타벅스 인천장제로점","스타벅스 인천청라타워돔점","스타벅스 인천만수향촌점","스타벅스 송도학원가점",
  "올리브영 부평점","올리브영 부평 타운","올리브영 송도센트럴파크점","올리브영 인천논현역점","올리브영 영종하늘도시점","올리브영 인천루원시티점",
  "투썸플레이스 왕산해수욕장점","투썸플레이스 산곡역점","투썸플레이스 부평시장역점","투썸플레이스 부평구청역점","투썸플레이스 인천검암점","투썸플레이스 부평남부역점","투썸플레이스 인천부개점","투썸플레이스 청라시티타워점","투썸플레이스 인천숭의점","투썸플레이스 인천마전역점","투썸플레이스 부평산곡위브점","투썸플레이스 송도에스파이브시티점","투썸플레이스 인천논현역튜브점","투썸플레이스 인천주안점","투썸플레이스 호구포역점","투썸플레이스 신검단풍경채점","투썸플레이스 인천송현점","투썸플레이스 인천독정이삼거리점"
];

const missingIncheon = new Set([27,28,30]);
const incheon = incheonNames
  .map((name,index)=>({name,file:`inc-${String(index+1).padStart(2,"0")}.jpg`,original:index+1}))
  .filter(item=>!missingIncheon.has(item.original))
  .concat([
    {name:"메가MGC커피 부평아이즈빌점",file:"inc-sup-01.jpg"},
    {name:"메가MGC커피 인천백병원점",file:"inc-sup-02.jpg"},
    {name:"메가MGC커피 인천구월문화로점",file:"inc-sup-03.jpg"}
  ])
  .slice(0,50)
  .map((item,index)=>({...item,id:index+1,region:"인천"}));

const metroPrimaryNames = [
  "다이소 김포구래점","다이소 김포장기점","다이소 김포사우점","다이소 김포풍무점","다이소 김포통진점","다이소 부천역점","다이소 부천중동점","다이소 부천상동점","다이소 부천옥길점","다이소 부천원종점","다이소 고양화정점","다이소 고양행신점","다이소 고양일산점","다이소 고양주엽점","다이소 고양삼송점","다이소 파주문산점","다이소 파주금촌점","다이소 파주운정점","다이소 파주야당점","다이소 파주교하점","다이소 시흥배곧점","다이소 시흥정왕점","다이소 시흥은행점","다이소 시흥능곡점","다이소 시흥대야점",
  "스타벅스 김포구래점","스타벅스 김포장기점","스타벅스 김포풍무DT점","스타벅스 김포걸포점","스타벅스 김포사우점","스타벅스 부천역점","스타벅스 부천중동점","스타벅스 부천상동점","스타벅스 부천옥길점","스타벅스 부천원종DT점","스타벅스 화정역점","스타벅스 행신역점","스타벅스 일산주엽점","스타벅스 일산백마점","스타벅스 고양삼송점","스타벅스 파주문산DT점","스타벅스 파주금촌역점","스타벅스 파주야당역점","스타벅스 파주운정점","스타벅스 파주가람점","스타벅스 시흥배곧점","스타벅스 시흥대야점","스타벅스 시흥능곡역점","스타벅스 시흥정왕점","스타벅스 시흥은계점"
];
const primaryFiles = [1,2,3,5,11,16,19,20,24,25,27,29,32,33,34,35,36,37,38,39,40,41,42,43,44,45];
const metroPrimary = primaryFiles.map(number=>({
  name:metroPrimaryNames[number-1],
  file:`metro-${String(number).padStart(2,"0")}.jpg`
}));
const metroSupNames = [
  "투썸플레이스 김포장기점","투썸플레이스 김포풍무점","투썸플레이스 김포사우점","투썸플레이스 김포운양점","투썸플레이스 김포통진점","투썸플레이스 김포고촌점","투썸플레이스 부천상동점","투썸플레이스 부천옥길점","투썸플레이스 부천원종점","투썸플레이스 부천시청역점","투썸플레이스 고양행신점","투썸플레이스 일산주엽점","투썸플레이스 일산백마점","투썸플레이스 고양삼송점","투썸플레이스 원흥역점","투썸플레이스 파주문산점","투썸플레이스 파주운정점","투썸플레이스 파주교하점","투썸플레이스 시흥배곧점","투썸플레이스 시흥정왕점","투썸플레이스 시흥능곡점","투썸플레이스 시흥은계점"
];
const supFileNumbers = [2,3,4,5,6,7,10,11,12,13,16,17,18,20,21,22,25,26,28,29,30,33];
const metroSupplements = metroSupNames.map((name,index)=>({
  name,file:`metro-sup-${String(supFileNumbers[index]).padStart(2,"0")}.jpg`
}));
const metro = metroPrimary.concat(metroSupplements,[
  {name:"메가MGC커피 파주야당역점",file:"metro-final-01.jpg"},
  {name:"다이소 파주문산점",file:"metro-paju-user.jpg"}
]).slice(0,50).map((item,index)=>({...item,id:index+51,region:"수도권"}));

function brandOf(name){
  if(name.includes("다이소")) return "다이소";
  if(name.includes("스타벅스")) return "스타벅스";
  if(name.includes("올리브영")) return "올리브영";
  if(name.includes("투썸")) return "투썸플레이스";
  return "메가커피";
}
function cityOf(item){
  if(item.region==="인천") return "인천광역시";
  const n=item.name;
  if(n.includes("김포")) return "경기 김포시";
  if(n.includes("부천")||n.includes("송내")) return "경기 부천시";
  if(n.includes("고양")||n.includes("일산")||n.includes("화정")||n.includes("행신")||n.includes("삼송")||n.includes("원흥")) return "경기 고양시";
  if(n.includes("파주")||n.includes("문산")||n.includes("금촌")||n.includes("야당")||n.includes("운정")||n.includes("교하")||n.includes("가람")) return "경기 파주시";
  return "경기 시흥시";
}
function setupText(brand,index){
  const options=[
    "매장 정면이 아닌 가로수 뒤쪽 보도 여유부. 출입문과 점자블록에서 충분히 이격.",
    "사진의 건물 그림자와 가로수 그늘이 겹치는 보도 안쪽. 차량 진출입부는 제외.",
    "점포 측면의 나무 그늘 후보. 간판·쇼윈도 앞과 배달 오토바이 대기공간은 비움.",
    "보도 폭이 유지되는 가로수열 사이 후보. 매장 출입축을 가로막지 않도록 평행 배치."
  ];
  return `${brand} 앞 ${options[index%options.length]}`;
}
const baseSpots=incheon.concat(metro).map((item,index)=>({
  ...item,
  key:`base-${String(index+1).padStart(3,"0")}`,
  brand:brandOf(item.name),
  city:cityOf(item),
  setup:setupText(brandOf(item.name),index),
  risk:index%5===0?"경계 재확인":"공공보도 추정",
  shade:index%3===0?"나무+건물 복합 그늘":index%3===1?"가로수 그늘":"건물 입면 그늘"
}));
const localCustomSpots=JSON.parse(localStorage.getItem("presence-custom-sites")||"[]");
let cloudCustomSpots=[];
let spots=[...baseSpots];
function rebuildSpots(){
  const source=cloudCustomSpots.length?cloudCustomSpots:localCustomSpots;
  spots=[...baseSpots,...source.map((item,index)=>({...item,key:item.key||`custom-${item.createdAt||index}`,id:101+index,custom:true}))];
  window.__presenceBoothSpots=spots;
}
rebuildSpots();
window.__presenceBoothSpots=spots;

const grid=document.querySelector("#spot-grid");
const search=document.querySelector("#search");
const brandFilter=document.querySelector("#brand-filter");
const countOutput=document.querySelector("#result-count");
const emptyState=document.querySelector("#empty-state");
const regionButtons=[...document.querySelectorAll("[data-region]")];
const viewButtons=[...document.querySelectorAll("[data-view]")];
let region="전체";
let viewMode=localStorage.getItem("presence-booth-view")||"photo";
const saved=new Set(JSON.parse(localStorage.getItem("presence-booth-spots")||"[]"));
let reviews=JSON.parse(localStorage.getItem("presence-site-reviews")||"{}");
let activeReviewId=null;
let sharedDb=null;
let firebaseApi=null;
let sharedReady=false;
let scoreMatcher=null;
const itemKey=item=>item.key||String(item.id);
const reviewFor=item=>reviews[itemKey(item)]||reviews[item.id];

function mapUrl(provider,name,item){
  if(provider==="kakao"&&item?.kakaoUrl)return item.kakaoUrl;
  const q=encodeURIComponent(name);
  return provider==="naver"?`https://map.naver.com/p/search/${q}`:`https://map.kakao.com/?q=${q}`;
}
function escapeHtml(value){
  return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function card(item){
  const safeName=escapeHtml(item.name);
  const imageSource=item.imageData||`./assets/streetview/${item.file}`;
  const review=reviewFor(item);
  const reviewLabel=review?`${review.status||"후기"}${review.photos?.length?` · 셋업사진 ${review.photos.length}장`:""}`:"";
  const recentResult=review?.result?.trim();
  const reviewPhotos=(review?.photos||[]).slice(0,3);
  const scoreHistory=scoreMatcher?.find(item.name);
  return `<article class="spot-card">
    <div class="spot-photo">
      <img src="${imageSource}" alt="${safeName} 매장 정면과 보도 후보 사진" loading="lazy">
      <span class="spot-number">#${String(item.id).padStart(3,"0")}</span>
      <button class="save-button ${saved.has(item.id)?"saved":""}" type="button" data-save="${item.id}" aria-label="${safeName} 답사 후보 저장">${saved.has(item.id)?"★":"☆"}</button>
      <span class="photo-shade">${item.shade} · 거리뷰 사전 판독</span>
    </div>
    <div class="spot-body">
      <div class="spot-meta"><span>${item.region}</span><span>${item.brand}</span>${item.custom?'<span class="custom-badge">직접 추가</span>':""}<span class="low-risk">${item.risk}</span></div>
      <h3>${safeName}</h3>
      <p class="location">${item.address?escapeHtml(item.address):`${item.city} · 정확한 도로명 주소는 지도 링크에서 최신 정보 확인`}</p>
      <p class="setup-note"><b>추천 장면</b><br>${item.setup}</p>
      <p class="risk-note">점포 대지·화단·주차면에는 설치하지 않음 · 관할 구청 확인 전 확정 금지</p>
      ${reviewLabel?`<span class="review-badge">${escapeHtml(reviewLabel)}</span>`:""}
      ${recentResult?`<span class="recent-result"><b>최근 결과</b> · ${escapeHtml(recentResult)}</span>`:""}
      ${scoreHistory?`<a class="score-history" href="../peacemaker-scores/index.html?q=${encodeURIComponent(item.name)}"><b>✓ 방문 이력 있음</b><span>${scoreHistory.days}회 · AVG ${scoreHistory.average.toFixed(1)} · 최근 ${escapeHtml(scoreHistory.recent.result)}</span></a>`:`<span class="score-history is-empty"><b>첫 운영 후보</b><span>스코어방 매칭 기록 없음 · 운영 후 후기 기록</span></span>`}
      ${reviewPhotos.length?`<div class="card-setup-photos" aria-label="실제 셋업사진">${reviewPhotos.map((photo,index)=>`<img src="${photo}" alt="${safeName} 실제 셋업사진 ${index+1}" loading="lazy">`).join("")}</div>`:""}
      <div class="card-actions"><a href="${mapUrl("naver",item.name,item)}" target="_blank" rel="noreferrer">네이버 거리뷰</a><a href="${mapUrl("kakao",item.name,item)}" target="_blank" rel="noreferrer">카카오맵 확인</a><button type="button" class="review-open" data-review="${itemKey(item)}">${review?"후기·셋업사진 수정":"후기·셋업사진 추가"}</button></div>
    </div>
  </article>`;
}
function render(){
  const q=search.value.trim().toLowerCase();
  const brand=brandFilter.value;
  const filtered=spots.filter(item=>
    (region==="전체"||item.region===region)&&
    (brand==="전체"||item.brand===brand)&&
    `${item.name} ${item.city} ${item.address||""} ${item.brand} ${reviewFor(item)?.status||""} ${reviewFor(item)?.result||""} ${reviewFor(item)?.text||""}`.toLowerCase().includes(q)
  );
  grid.innerHTML=filtered.map(card).join("");
  grid.classList.toggle("text-view",viewMode==="text");
  viewButtons.forEach(button=>{const active=button.dataset.view===viewMode;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
  countOutput.textContent=`${filtered.length}개 표시`;
  emptyState.hidden=filtered.length!==0;
}
function updateTotals(){
  const incCount=spots.filter(item=>item.region==="인천").length;
  const metroCount=spots.filter(item=>item.region==="수도권").length;
  document.querySelector("#summary-total").textContent=spots.length;
  document.querySelector("#summary-incheon").textContent=incCount;
  document.querySelector("#summary-metro").textContent=metroCount;
  regionButtons.forEach(button=>{
    const count=button.dataset.region==="전체"?spots.length:button.dataset.region==="인천"?incCount:metroCount;
    button.textContent=`${button.dataset.region} ${count}`;
  });
}
search.addEventListener("input",render);
brandFilter.addEventListener("change",render);
viewButtons.forEach(button=>button.addEventListener("click",()=>{viewMode=button.dataset.view;localStorage.setItem("presence-booth-view",viewMode);render();}));
regionButtons.forEach(button=>button.addEventListener("click",()=>{
  region=button.dataset.region;
  regionButtons.forEach(item=>item.classList.toggle("active",item===button));
  render();
}));
grid.addEventListener("click",event=>{
  const reviewButton=event.target.closest("[data-review]");
  if(reviewButton){openReview(reviewButton.dataset.review);return;}
  const button=event.target.closest("[data-save]");
  if(!button)return;
  const id=Number(button.dataset.save);
  saved.has(id)?saved.delete(id):saved.add(id);
  localStorage.setItem("presence-booth-spots",JSON.stringify([...saved]));
  render();
});
const reviewDialog=document.querySelector("#review-dialog");
const reviewForm=document.querySelector("#review-form");
const reviewStatus=document.querySelector("#review-status");
const reviewRating=document.querySelector("#review-rating");
const reviewResult=document.querySelector("#review-result");
const reviewText=document.querySelector("#review-text");
const reviewPhoto=document.querySelector("#review-photo");
const reviewPreview=document.querySelector("#review-preview");
const reviewMessage=document.querySelector("#review-message");
async function persistReviews(key){
  try{localStorage.setItem("presence-site-reviews",JSON.stringify(reviews));}
  catch(error){reviewMessage.textContent="기기 저장 공간이 부족합니다. 오래된 셋업사진을 일부 삭제해 주세요.";return false;}
  try{
    if(sharedReady&&key)await firebaseApi.set(firebaseApi.ref(sharedDb,`summerStrategy/reviews/${key}`),reviews[key]||null);
  }
  catch(error){reviewMessage.textContent="기기에는 저장했습니다. Firebase 연결 후 다시 공용 동기화됩니다.";}
  render();
  return true;
}
function openReview(key){
  const item=spots.find(spot=>itemKey(spot)===key);
  if(!item)return;
  activeReviewId=itemKey(item);
  const review=reviewFor(item)||{status:"미답사",rating:"0",result:"",text:"",photos:[]};
  document.querySelector("#review-site").textContent=`#${String(item.id).padStart(3,"0")} · ${item.name}`;
  reviewStatus.value=review.status||"미답사";reviewRating.value=String(review.rating||0);reviewResult.value=review.result||"";reviewText.value=review.text||"";reviewPhoto.value="";reviewMessage.textContent="";
  drawReviewPhotos(review.photos||[]);
  reviewDialog.showModal();document.body.style.overflow="hidden";
}
function closeReview(){reviewDialog.close();document.body.style.overflow="";}
function drawReviewPhotos(photos){
  reviewPreview.innerHTML=photos.map((photo,index)=>`<figure><img src="${photo}" alt="실제 부스 셋업사진 ${index+1}"><button type="button" data-remove-photo="${index}" aria-label="셋업사진 ${index+1} 삭제">×</button></figure>`).join("");
}
function resizePhoto(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=reject;
    reader.onload=()=>{
      const image=new Image();
      image.onerror=reject;
      image.onload=()=>{
        const max=1280,scale=Math.min(1,max/Math.max(image.width,image.height));
        const canvas=document.createElement("canvas");canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
        canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",.76));
      };
      image.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
reviewPhoto.addEventListener("change",async()=>{
  const file=reviewPhoto.files?.[0];if(!file||!activeReviewId)return;
  reviewMessage.textContent="사진 압축 중…";
  try{
    const photo=await resizePhoto(file);
    const review=reviews[activeReviewId]||{status:reviewStatus.value,rating:reviewRating.value,result:reviewResult.value,text:reviewText.value,photos:[]};
    review.photos=[...(review.photos||[]),photo].slice(-3);review.updatedAt=new Date().toISOString();reviews[activeReviewId]=review;
    if(await persistReviews(activeReviewId)){drawReviewPhotos(review.photos);reviewMessage.textContent=sharedReady?"셋업사진을 저장했습니다. 카드에도 바로 표시됩니다.":"사진을 기기와 카드에 표시했습니다. 연결되면 공용 저장됩니다.";}
  }catch(error){reviewMessage.textContent="사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.";}
});
reviewPreview.addEventListener("click",async event=>{
  const button=event.target.closest("[data-remove-photo]");if(!button||!activeReviewId)return;
  const review=reviews[activeReviewId];review.photos.splice(Number(button.dataset.removePhoto),1);await persistReviews(activeReviewId);drawReviewPhotos(review.photos);
});
reviewForm.addEventListener("submit",async event=>{
  event.preventDefault();if(!activeReviewId)return;
  const previous=reviews[activeReviewId]||{};
  reviews[activeReviewId]={status:reviewStatus.value,rating:reviewRating.value,result:reviewResult.value.trim(),text:reviewText.value.trim(),photos:previous.photos||[],updatedAt:new Date().toISOString()};
  if(await persistReviews(activeReviewId)){reviewMessage.textContent=sharedReady?"후기·최근 결과·사진을 저장해 카드에 반영했습니다.":"기기에 저장해 카드에 반영했습니다. 연결되면 자동 동기화됩니다.";setTimeout(closeReview,650);}
});
document.querySelector("#review-delete").addEventListener("click",async()=>{if(!activeReviewId)return;delete reviews[activeReviewId];await persistReviews(activeReviewId);render();closeReview();});
document.querySelector("#review-close").addEventListener("click",closeReview);
reviewDialog.addEventListener("click",event=>{if(event.target===reviewDialog)closeReview();});
const siteDialog=document.querySelector("#site-dialog");
const siteForm=document.querySelector("#site-form");
const sitePhoto=document.querySelector("#site-photo");
const siteMessage=document.querySelector("#site-message");
let pendingSitePhoto="";
function autoRegion(address){
  if(address.includes("인천"))return "인천";
  return "수도권";
}
function autoCity(address){
  const parts=address.trim().split(/\s+/);
  return parts.slice(0,2).join(" ")||"직접 추가";
}
function placeholderImage(name,address){
  const initial=escapeHtml(name.slice(0,2));
  const line=escapeHtml(address.slice(0,28));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#17251d"/><stop offset="1" stop-color="#31543e"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="1030" cy="140" r="230" fill="#d7ff55" opacity=".09"/><text x="90" y="250" fill="#d7ff55" font-family="Arial,sans-serif" font-size="76" font-weight="800">${initial}</text><text x="90" y="345" fill="#f7f9f6" font-family="Arial,sans-serif" font-size="52" font-weight="800">${escapeHtml(name)}</text><text x="90" y="420" fill="#c7d0ca" font-family="Arial,sans-serif" font-size="30">${line}</text><text x="90" y="590" fill="#d7ff55" font-family="Arial,sans-serif" font-size="24" font-weight="700">KAKAO MAP LINKED · 현장 사진 추가 가능</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function openSiteDialog(){
  siteForm.reset();pendingSitePhoto="";document.querySelector("#site-photo-preview").innerHTML="";siteMessage.textContent="";
  siteDialog.showModal();document.body.style.overflow="hidden";
}
function closeSiteDialog(){siteDialog.close();document.body.style.overflow="";}
document.querySelector("#add-site-button").addEventListener("click",openSiteDialog);
document.querySelector("#site-close").addEventListener("click",closeSiteDialog);
document.querySelector("#site-cancel").addEventListener("click",closeSiteDialog);
siteDialog.addEventListener("click",event=>{if(event.target===siteDialog)closeSiteDialog();});
sitePhoto.addEventListener("change",async()=>{
  const file=sitePhoto.files?.[0];if(!file)return;
  siteMessage.textContent="현장 사진 압축 중…";
  try{pendingSitePhoto=await resizePhoto(file);document.querySelector("#site-photo-preview").innerHTML=`<img src="${pendingSitePhoto}" alt="추가할 현장 사진 미리보기">`;siteMessage.textContent="현장 사진을 준비했습니다.";}
  catch(error){siteMessage.textContent="사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.";}
});
siteForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const name=document.querySelector("#site-name").value.trim();
  const address=document.querySelector("#site-address").value.trim();
  const kakaoUrl=document.querySelector("#site-kakao").value.trim();
  const shade=document.querySelector("#site-shade").value;
  const manualSetup=document.querySelector("#site-setup").value.trim();
  if(!/^https:\/\/(place\.map\.kakao\.com|map\.kakao\.com|kko\.to)\//i.test(kakaoUrl)){siteMessage.textContent="카카오맵에서 공유한 정확한 https 주소를 넣어주세요.";return;}
  const key=`custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const custom={
    key,
    name,address,kakaoUrl,shade,region:autoRegion(address),city:autoCity(address),brand:brandOf(name),
    risk:"경계 재확인",setup:manualSetup||`${brandOf(name)} 앞 그늘 후보. 정확한 보도 경계와 출입 동선을 현장에서 확인한 뒤 평행 배치.`,
    imageData:pendingSitePhoto||placeholderImage(name,address),photoStatus:pendingSitePhoto?"지도·현장사진 등록":"거리뷰 사진 미등록",createdAt:new Date().toISOString()
  };
  const stored=JSON.parse(localStorage.getItem("presence-custom-sites")||"[]");stored.unshift(custom);
  try{
    localStorage.setItem("presence-custom-sites",JSON.stringify(stored));
    if(sharedReady){
      await firebaseApi.set(firebaseApi.ref(sharedDb,`summerStrategy/sites/${key}`),custom);
      siteMessage.textContent="사이트를 Firebase에 공용 저장했습니다. 다른 기기에도 바로 표시됩니다.";
    }else siteMessage.textContent="사이트를 기기에 임시 저장했습니다. 연결되면 자동 동기화됩니다.";
    setTimeout(()=>location.reload(),650);
  }
  catch(error){siteMessage.textContent="저장 공간이 부족합니다. 사진 없이 다시 저장하거나 오래된 사진을 정리해 주세요.";}
});
const menuButton=document.querySelector(".menu-button");
const mobileMenu=document.querySelector("#mobile-menu");
menuButton.addEventListener("click",()=>{
  const open=menuButton.getAttribute("aria-expanded")==="true";
  menuButton.setAttribute("aria-expanded",String(!open));
  mobileMenu.hidden=open;
});
mobileMenu.addEventListener("click",()=>{mobileMenu.hidden=true;menuButton.setAttribute("aria-expanded","false")});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){mobileMenu.hidden=true;menuButton.setAttribute("aria-expanded","false");if(reviewDialog.open)closeReview();if(siteDialog.open)closeSiteDialog();}});
function setSyncStatus(mode,title,detail){
  const el=document.querySelector("#sync-status");
  el.className=`sync-status is-${mode}`;
  el.querySelector("b").textContent=title;
  el.querySelector("span:last-child").textContent=detail;
}
async function initSharedData(){
  const config={apiKey:"AIzaSyCYKKnK8myrSM-eip9HEJxYRq_hzpfPUY0",authDomain:"presence-team.firebaseapp.com",databaseURL:"https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"presence-team",storageBucket:"presence-team.firebasestorage.app",messagingSenderId:"1056684483470",appId:"1:1056684483470:web:1f50113d410b53458d3adf"};
  try{
    const [appApi,authApi,dbApi]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js")
    ]);
    let app;try{app=appApi.getApp("presence-summer-strategy");}catch(error){app=appApi.initializeApp(config,"presence-summer-strategy");}
    const auth=authApi.getAuth(app);
    if(typeof auth.authStateReady==="function")await auth.authStateReady();
    if(!auth.currentUser)await authApi.signInAnonymously(auth);
    sharedDb=dbApi.getDatabase(app);firebaseApi=dbApi;
    dbApi.onValue(dbApi.ref(sharedDb,".info/connected"),snapshot=>{
      if(snapshot.val())setSyncStatus("live","Firebase 공용 동기화 ON","사이트·후기·최근 결과·셋업사진이 모든 기기에 실시간 반영됩니다.");
      else setSyncStatus("offline","오프라인 임시 저장","연결이 복구되면 Firebase와 다시 맞춥니다.");
    });
    const rootRef=dbApi.ref(sharedDb,"summerStrategy");
    dbApi.onValue(rootRef,async snapshot=>{
      const data=snapshot.val()||{};
      const remoteSites=Object.values(data.sites||{}).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
      const remoteReviews=data.reviews||{};
      if(!sharedReady){
        sharedReady=true;
        for(const [index,item] of localCustomSpots.entries()){
          const key=item.key||`legacy-${String(item.createdAt||Date.now()).replace(/[^a-zA-Z0-9-]/g,"-")}-${index}`;
          if(!data.sites?.[key])await dbApi.set(dbApi.ref(sharedDb,`summerStrategy/sites/${key}`),{...item,key});
        }
        for(const [oldKey,value] of Object.entries(reviews)){
          const key=/^\d+$/.test(oldKey)?`base-${String(oldKey).padStart(3,"0")}`:oldKey;
          if(!remoteReviews[key])await dbApi.set(dbApi.ref(sharedDb,`summerStrategy/reviews/${key}`),value);
        }
      }
      cloudCustomSpots=remoteSites;
      reviews={...reviews,...remoteReviews};
      localStorage.setItem("presence-site-reviews",JSON.stringify(reviews));
      rebuildSpots();updateTotals();render();
    },error=>{
      console.error("Presence summer sync failed",error);
      setSyncStatus("offline","공용 동기화 권한 확인 필요","현재는 이 기기에 안전하게 저장합니다.");
    });
  }catch(error){
    console.error("Presence summer Firebase unavailable",error);
    setSyncStatus("offline","오프라인 임시 저장","Firebase 연결이 복구되면 공용 데이터로 전환됩니다.");
  }
}
updateTotals();
render();
window.PresenceScoreMatcher?.load("../peacemaker-scores/data/incheon-score-room.json").then(matcher=>{scoreMatcher=matcher;render()}).catch(()=>{});
initSharedData();
