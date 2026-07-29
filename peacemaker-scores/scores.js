const state={records:[],filtered:[],limit:100};
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const formatDate=value=>new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"short",day:"numeric",weekday:"short"}).format(new Date(`${value}T00:00:00`));
function populate(){
  const years=[...new Set(state.records.map(item=>item.date.slice(0,4)))].sort().reverse();
  $("#year").insertAdjacentHTML("beforeend",years.map(year=>`<option>${year}</option>`).join(""));
  const sites=[...new Set(state.records.map(item=>item.site))].sort((a,b)=>a.localeCompare(b,"ko"));
  $("#site").insertAdjacentHTML("beforeend",sites.map(site=>`<option value="${escapeHtml(site)}">${escapeHtml(site)}</option>`).join(""));
  $("#record-count").textContent=state.records.length.toLocaleString("ko-KR");
  $("#site-count").textContent=sites.length.toLocaleString("ko-KR");
  $("#latest-date").textContent=state.records[0]?.date.replaceAll("-",".")||"—";
}
function render(){
  const query=$("#query").value.trim().toLowerCase(),year=$("#year").value,site=$("#site").value;
  state.filtered=state.records.filter(item=>(!year||item.date.startsWith(year))&&(!site||item.site===site)&&(!query||`${item.site} ${item.result} ${item.date}`.toLowerCase().includes(query)));
  const visible=state.filtered.slice(0,state.limit);
  $("#result-list").innerHTML=visible.map(item=>`<article class="record"><time datetime="${item.date}">${formatDate(item.date)}</time><h3>${escapeHtml(item.site)}</h3><p class="crew"><b>셋업 인원 · 결과</b>${escapeHtml(item.result)}</p></article>`).join("");
  $("#shown-count").textContent=`${state.filtered.length.toLocaleString("ko-KR")}건 중 ${visible.length.toLocaleString("ko-KR")}건 표시`;
  $("#empty").hidden=state.filtered.length!==0;
  $("#more").hidden=visible.length>=state.filtered.length;
}
fetch("./data/incheon-score-room.json").then(response=>{if(!response.ok)throw new Error("데이터를 불러오지 못했습니다.");return response.json();}).then(data=>{state.records=data.records||[];populate();render();}).catch(error=>{$("#shown-count").textContent=error.message;$("#empty").hidden=false;});
["query","year","site"].forEach(id=>$("#"+id).addEventListener(id==="query"?"input":"change",()=>{state.limit=100;render();}));
$("#reset").addEventListener("click",()=>{$("#query").value="";$("#year").value="";$("#site").value="";state.limit=100;render();});
$("#more").addEventListener("click",()=>{state.limit+=100;render();});
