/* Firebase REST streaming: only display names/groups are public. */
(function(){
  'use strict';
  const url='https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app/hubPublicRoster.json';
  const groups={FIRST:'first-lr-names',SECOND:'second-lr-names',IC:'ic-names'};
  const status=document.createElement('span');status.className='hub-roster-status';status.id='hubRosterStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='팀 명단 연결 중';document.querySelector('.rows').after(status);
  const lead=document.querySelector('.lead-name');lead.textContent='명단 연결 중';document.querySelector('.lead>.role').textContent='팀 대표';
  let source=null,snapshot={},received=false;
  function render(){
    const rows=Object.values(snapshot?.members||{}).filter(m=>m&&typeof m.name==='string'&&m.name.trim()).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||a.name.localeCompare(b.name,'ko'));
    Object.entries(groups).forEach(([group,id])=>{const el=document.getElementById(id),members=rows.filter(m=>m.group===group);el.replaceChildren();members.forEach((m,i)=>{if(i){const sep=document.createElement('span');sep.className='sep';sep.textContent='·';el.append(sep);}const name=document.createElement('span');name.className='hub-person-name';name.textContent=m.name;el.append(name);});if(!members.length)el.textContent='등록된 팀원이 없어요';});
    lead.textContent=rows.filter(m=>m.group==='AOP').map(m=>m.name).join(' · ')||'프레젠스';
    received=true;status.textContent='워크북과 실시간 연결';status.dataset.state='live';
  }
  function put(path,value){const keys=String(path||'/').split('/').filter(Boolean);if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))return;if(!keys.length){snapshot=value||{};return;}let current=snapshot;for(let i=0;i<keys.length-1;i++)current=current[keys[i]]||(current[keys[i]]={});if(value===null)delete current[keys[keys.length-1]];else current[keys[keys.length-1]]=value;}
  function receive(event,patch){try{const msg=JSON.parse(event.data);if(patch&&msg.data&&typeof msg.data==='object')Object.entries(msg.data).forEach(([key,value])=>put((msg.path==='/'?'':msg.path)+'/'+key,value));else put(msg.path,msg.data);render();}catch(e){status.textContent='명단을 다시 확인하고 있어요';status.dataset.state='waiting';}}
  function connect(){if(source)return;if(!window.EventSource){status.textContent='실시간 연결을 지원하는 브라우저가 필요해요';return;}source=new EventSource(url);source.addEventListener('put',e=>receive(e,false));source.addEventListener('patch',e=>receive(e,true));source.addEventListener('cancel',()=>{status.textContent='팀 명단 연결을 확인해 주세요';status.dataset.state='waiting';source.close();source=null;});source.onerror=()=>{status.textContent=received?'최근 명단 · 연결을 다시 시도하고 있어요':'팀 명단에 다시 연결하고 있어요';status.dataset.state='waiting';};source.onopen=()=>{if(received){status.textContent='워크북과 실시간 연결';status.dataset.state='live';}};}
  window.addEventListener('pagehide',()=>{source?.close();source=null;});window.addEventListener('pageshow',connect);window.addEventListener('online',connect);window.addEventListener('offline',()=>{status.textContent='최근 명단 · 인터넷 연결 대기';status.dataset.state='waiting';});connect();
})();
