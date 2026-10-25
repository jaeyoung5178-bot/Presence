import {firebase} from './store.js?v=20261025-1';
import {reconcileShowup} from './sheet-sync-model.js?v=20261025-3';
export function createSheetSync({all,settings,save,onStatus,canPull,demo}) {
  let busy=false,timer,last='인터뷰 시트 자동연결 준비 중';
  const scheduled=()=>all().filter(c=>c.interviewDate&&c.mobile&&['booked','showed','starter','noShow','cancelled'].includes(c.status));
  const status=s=>{last=s;onStatus(s);};
  async function run(){
    if(busy||demo()||document.hidden||!canPull())return;
    const endpoint=settings().sheetEndpoint;
    if(!endpoint){status('자동연결 설정 전 · 수동 행 복사를 이용할 수 있어요.');return;}
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){status('자동연결 주소를 확인해 주세요.');return;}
    busy=true;status('인터뷰 시트 확인 중…');
    try{
      const f=await firebase(),token=await f.auth.currentUser.getIdToken();
      const candidates=scheduled().map(c=>({id:c.id,name:c.name,age:c.age,gender:c.gender,mobile:c.mobile,recruiter:c.recruiter,interviewDate:c.interviewDate,interviewTime:c.interviewTime,bookedDate:c.bookedDate||'',note:c.note||'',status:c.status,revision:c.revision,sheetState:c.sheetState||null}));
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({token,candidates}),signal:AbortSignal.timeout(25000),credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw Error('시트 연결 응답을 확인하지 못했어요.');
      const result=await response.json();if(!result.ok)throw Error(result.error||'시트 연결에 실패했어요.');
      for(const remote of result.records||[]){const c=all().find(c=>c.id===remote.id);if(!c)continue;const next=reconcileShowup(c,remote);if(next)await save(next,c.revision);}
      status(`시트 연결됨 · ${result.records.length}명 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} 확인`);
    }catch(e){status('자동연결 대기 · '+(e.name==='TimeoutError'?'응답 시간 초과':e.message));}
    finally{busy=false;}
  }
  return {run,status:()=>last,start(){clearInterval(timer);run();timer=setInterval(run,20000);document.addEventListener('visibilitychange',run);},stop(){clearInterval(timer);document.removeEventListener('visibilitychange',run);}};
}
