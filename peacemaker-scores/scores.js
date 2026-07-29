const state={records:[],filtered:[],limit:100};
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const formatDate=value=>new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"short",day:"numeric",weekday:"short"}).format(new Date(`${value}T00:00:00`));
const typoRules=[
  [/굴\s*[4포]\s*천\s*[엳역]/g,"굴포천역"],[/굴포천\s*8번출구/g,"굴포천역 8번출구"],
  [/다이서/g,"다이소"],[/에이비씨마트|abc\s*마트/gi,"ABC마트"],[/인천\s*터미널역/g,"인천터미널역"]
];
function cleanSiteName(value){
  let name=String(value||"").normalize("NFKC").replace(/[️⃣⃣]/g,"").replace(/^(?:\d+\s*[.)]?\s*)+/,"").replace(/^[^A-Za-z가-힣]+/u,"").replace(/\s+/g," ").trim();
  typoRules.forEach(([pattern,replacement])=>{name=name.replace(pattern,replacement);});
  return name.replace(/\s*\/\s*/g," / ").replace(/\s+/g," ").trim();
}
function siteGroup(value){
  const clean=cleanSiteName(value);
  const station=clean.match(/([가-힣A-Za-z0-9]{2,}역)(?:\s|$|\/|\d)/);
  if(station)return station[1];
  return clean.replace(/\s*\([^)]*(?:구|이동|사용|팀)[^)]*\)\s*/g," ").replace(/\s+/g," ").trim();
}
function detailName(value,group){
  const clean=cleanSiteName(value);
  if(clean===group)return "";
  if(clean.startsWith(group))return clean.slice(group.length).replace(/^[\s/·-]+/,"")||"기본 위치";
  return clean;
}
const fingerprint=value=>value.toLowerCase().replace(/(?:인천광역시|경기도|인천|경기)/g,"").replace(/지점/g,"점").replace(/[^a-z0-9가-힣]/g,"");
function editDistance(a,b){
  const row=Array.from({length:b.length+1},(_,index)=>index);
  for(let i=1;i<=a.length;i++){
    let previous=row[0];row[0]=i;
    for(let j=1;j<=b.length;j++){const saved=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=saved;}
  }
  return row[b.length];
}
function samePlace(a,b){
  const left=fingerprint(a),right=fingerprint(b);
  if(left===right)return true;
  if(!left||!right)return false;
  const stationA=a.match(/[가-힣A-Za-z0-9]{2,}역/)?.[0],stationB=b.match(/[가-힣A-Za-z0-9]{2,}역/)?.[0];
  if(stationA||stationB)return stationA===stationB;
  const brand=value=>value.match(/^(다이소|스타벅스|ABC마트|홈플러스|롯데마트|롯데리아|버거킹|빽다방|컴포즈커피|메가MGC커피|올리브영|공차|노브랜드|세븐일레븐|CU|에덴마트|하나은행|신한은행)/i)?.[0]?.toLowerCase();
  if(brand(a)!==brand(b))return false;
  const distance=editDistance(left,right),limit=Math.max(left.length,right.length)>=12?2:1;
  return distance<=limit||(Math.min(left.length,right.length)>=8&&(left.includes(right)||right.includes(left))&&Math.abs(left.length-right.length)<=2);
}
function mergeSimilarSites(records){
  const frequency=new Map();
  records.forEach(item=>frequency.set(siteGroup(item.site),(frequency.get(siteGroup(item.site))||0)+1));
  const names=[...frequency.keys()].sort((a,b)=>frequency.get(b)-frequency.get(a)||a.localeCompare(b,"ko"));
  const representatives=[];
  const aliases=new Map();
  names.forEach(name=>{
    const match=representatives.find(candidate=>samePlace(name,candidate));
    aliases.set(name,match||name);
    if(!match)representatives.push(name);
  });
  return records.map(item=>({...item,siteOriginal:cleanSiteName(item.site),siteGroup:aliases.get(siteGroup(item.site))}));
}
function populate(){
  state.records=mergeSimilarSites(state.records);
  const years=[...new Set(state.records.map(item=>item.date.slice(0,4)))].sort().reverse();
  $("#year").insertAdjacentHTML("beforeend",years.map(year=>`<option>${year}</option>`).join(""));
  const sites=[...new Set(state.records.map(item=>item.siteGroup))].sort((a,b)=>a.localeCompare(b,"ko"));
  $("#site").insertAdjacentHTML("beforeend",sites.map(site=>`<option value="${escapeHtml(site)}">${escapeHtml(site)}</option>`).join(""));
  $("#record-count").textContent=state.records.length.toLocaleString("ko-KR");
  $("#site-count").textContent=sites.length.toLocaleString("ko-KR");
  $("#latest-date").textContent=state.records[0]?.date.replaceAll("-",".")||"—";
}
function render(){
  const query=$("#query").value.trim().toLowerCase(),year=$("#year").value,site=$("#site").value;
  state.filtered=state.records.filter(item=>(!year||item.date.startsWith(year))&&(!site||item.siteGroup===site)&&(!query||`${item.siteGroup} ${item.siteOriginal} ${item.result} ${item.date}`.toLowerCase().includes(query)));
  const visible=state.filtered.slice(0,state.limit);
  $("#result-list").innerHTML=visible.map(item=>{
    const detail=detailName(item.siteOriginal,item.siteGroup);
    return `<article class="record"><time datetime="${item.date}">${formatDate(item.date)}</time><div class="site-name"><h3>${escapeHtml(item.siteGroup)}</h3>${detail?`<span>${escapeHtml(detail)}</span>`:""}</div><p class="crew"><b>셋업 인원 · 결과</b>${escapeHtml(item.result)}</p></article>`;
  }).join("");
  $("#shown-count").textContent=`${state.filtered.length.toLocaleString("ko-KR")}건 중 ${visible.length.toLocaleString("ko-KR")}건 표시`;
  $("#empty").hidden=state.filtered.length!==0;
  $("#more").hidden=visible.length>=state.filtered.length;
}
fetch("./data/incheon-score-room.json").then(response=>{if(!response.ok)throw new Error("데이터를 불러오지 못했습니다.");return response.json();}).then(data=>{state.records=data.records||[];populate();render();}).catch(error=>{$("#shown-count").textContent=error.message;$("#empty").hidden=false;});
["query","year","site"].forEach(id=>$("#"+id).addEventListener(id==="query"?"input":"change",()=>{state.limit=100;render();}));
$("#reset").addEventListener("click",()=>{$("#query").value="";$("#year").value="";$("#site").value="";state.limit=100;render();});
$("#more").addEventListener("click",()=>{state.limit+=100;render();});
