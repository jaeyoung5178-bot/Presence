import {firebase} from './store.js?v=20261025-1';
import {reconcileShowup} from './sheet-sync-model.js?v=20261025-5';
export function createSheetSync({all,settings,save,onStatus,canPull,demo}) {
  let busy=false,timer,generation=0,active=true,last='인터뷰 시트 자동연결 준비 중';
  const scheduled=()=>all().filter(c=>!c.deleted&&c.interviewDate&&c.mobile&&['booked','showed','starter','noShow','cancelled'].includes(c.status));
  const status=s=>{last=s;onStatus(s);};
  async function run(){
    if(!active||busy||demo()||document.hidden||!canPull())return;
    const endpoint=settings().sheetEndpoint;
    if(!endpoint){status('자동연결 설정 전 · 수동 행 복사를 이용할 수 있어요.');return;}
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){status('자동연결 주소를 확인해 주세요.');return;}
    const runGeneration=generation,sameRun=()=>active&&generation===runGeneration,current=()=>sameRun()&&settings().sheetEndpoint===endpoint;
    busy=true;status('인터뷰 시트 확인 중…');
    try{
      // Older bridges ignore unknown POST modes and perform an upsert. Always
      // check the non-data capability before sending any automatic request.
      const capabilityResponse=await fetch(endpoint,{method:'GET',cache:'no-store',signal:AbortSignal.timeout(10000),credentials:'omit',referrerPolicy:'no-referrer'});
      if(!capabilityResponse.ok)throw Error('시트 연결 버전을 확인하지 못했어요.');
      const capability=await capabilityResponse.json();
      if(capability?.service!=='presence-interview-sync'||capability.protocol!==2||!capability.modes?.includes('pull'))throw Error('자동연결 도우미 업데이트가 필요해요. 수동 복사는 계속 사용할 수 있어요.');
      if(!current())return;
      const f=await firebase();if(!f.auth.currentUser)throw Error('다시 로그인한 뒤 시트를 연결해 주세요.');
      const token=await f.auth.currentUser.getIdToken();if(!current())return;
      // Pull needs identity only. Notes, training details and other private
      // candidate fields never need to leave the page for an O lookup.
      const candidates=scheduled().map(c=>({id:c.id,name:c.name,mobile:c.mobile,interviewDate:c.interviewDate,interviewTime:c.interviewTime}));
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({mode:'pull',protocol:2,token,candidates}),signal:AbortSignal.timeout(25000),credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw Error('시트 연결 응답을 확인하지 못했어요.');
      const result=await response.json();if(!result.ok)throw Error(result.error||'시트 연결에 실패했어요.');
      if(result.mode!=='pull'||result.protocol!==2||!Array.isArray(result.records))throw Error('시트 읽기 전용 연결 응답을 확인해 주세요.');
      if(!current())return;if(!canPull()){status('편집 중 · 다음 연결 때 다시 확인해요.');return;}
      for(const remote of result.records){
        if(!current()||!canPull())return;
        const sent=candidates.find(c=>c.id===remote.id),c=all().find(c=>c.id===remote.id&&!c.deleted);
        if(!sent||!c||typeof remote.showed!=='boolean'||remote.interviewDate!==sent.interviewDate||['name','mobile','interviewDate','interviewTime'].some(key=>String(c[key]||'')!==String(sent[key]||'')))continue;
        const next=reconcileShowup(c,remote);if(next)await save(next,c.revision);
        if(!current()||!canPull())return;
      }
      if(current())status(`시트 읽기 연결됨 · ${result.records.length}명 확인${result.unmatched?' · 미일치 '+result.unmatched+'명 (시트에 행을 붙여넣어 주세요)':''} · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`);
    }catch(e){if(current())status('자동연결 대기 · '+(e.name==='TimeoutError'?'응답 시간 초과':e.message));}
    finally{if(sameRun())busy=false;}
  }
  return {run,status:()=>last,start(){generation++;active=true;busy=false;clearInterval(timer);run();timer=setInterval(run,20000);document.addEventListener('visibilitychange',run);},stop(){active=false;generation++;busy=false;clearInterval(timer);document.removeEventListener('visibilitychange',run);}};
}
