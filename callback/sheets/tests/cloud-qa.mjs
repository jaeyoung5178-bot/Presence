import assert from 'node:assert/strict';
const {createCloudClient,IdentityChangedError}=await import(new URL('../cloud.js', import.meta.url));
const identity={uid:'qa-member',namespace:'user:qa-member',name:'가상멤버',accessKey:'synthetic-only',signature:'synthetic-member-signature'};
let checks=0;
async function run(kind){
 let active={...identity};const reads=[],writes=[];
 const user={uid:'qa-anon',getIdToken:async()=> 'synthetic-token'};
 const auth={currentUser:user,authStateReady:async()=>{}};
 const sdk={getApp:()=>({}),initializeApp:()=>({}),getAuth:()=>auth,setPersistence:async()=>{},browserLocalPersistence:{},signInAnonymously:async()=>({user}),signOut:async()=>{throw Error('unexpected signOut');}};
 const fetchImpl=async(url,options={})=>{
  const p=decodeURIComponent(new URL(url).pathname.slice(1).replace(/\.json$/,''));
  if((options.method||'GET')!=='GET'){writes.push(p);throw Error('unexpected write');}
  reads.push(p);let data=null,status=200;
  if(p==='callbackSessions/qa-anon')data={userUid:identity.uid,accessKey:identity.accessKey};
  else if(p==='callbackProfiles/qa-member')data={uid:'qa-member',status:'active',name:kind==='name-mismatch'?'다른사람':'가상멤버'};
  else if(p==='users/qa-member/surveys'){if(['fallback','firstfield-denied'].includes(kind)){status=403;}else data={onboarding:{answers:{firstField:'2026-11-03'}}};}
  else if(p==='memberInfo/가상멤버/join'){if(kind==='firstfield-denied')status=403;else data='2026-11-04';}
  else if(p.startsWith('sales/')){
   const d=p.split('/')[1];
   if(kind==='failure'&&d==='2026-11-06'){status=403;data={error:'Permission denied'};}
   else if(kind==='account-change'&&d==='2026-11-06'){active={...identity,signature:'different-user-signature'};}
   else if(d==='2026-11-05')data={name:'가상멤버',checked:true,count:0};
   else if(d==='2026-11-06')data={name:'가상멤버',count:3};
   else if(d==='2026-11-07')data={name:'가상멤버',count:3,na:true};
   else if(d==='2026-11-08')data={name:'가상멤버',count:3,rally:true};
   else if(d==='2026-11-09')data={name:'가상멤버',count:3,cleared:true};
   else if(d==='2026-11-10')data={name:'가상멤버',count:2};
  } else if(p==='callbacksheets/qa-member/2026-11-10'){if(kind==='legacy-error')status=403;else data={info:{date:'2026-11-10',name:'가상멤버'},logs:[{type:'contact',t:'2026-11-10T07:00:00Z'}]};}
  else if(!p.startsWith('callbacksheets/qa-member/'))throw Error('unexpected path '+p);
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 };
 const client=createCloudClient({readIdentity:()=>active,fetchImpl,loadFirebase:async()=>sdk});
 if(['failure','name-mismatch','legacy-error'].includes(kind))await assert.rejects(()=>client.readFieldMonth(identity,'2026-11','2026-11-21'));
 else if(kind==='account-change')await assert.rejects(()=>client.readFieldMonth(identity,'2026-11','2026-11-21'),IdentityChangedError);
 else{
  const result=await client.readFieldMonth(identity,'2026-11','2026-11-21');
  assert.equal(result.firstField,kind==='fallback'?'2026-11-04':kind==='firstfield-denied'?'':'2026-11-03');
  assert.equal(result.firstFieldVerified,kind!=='firstfield-denied');
  assert.deepEqual(result.days.map(x=>[x.date,x.count,x.legacyStatus]),[['2026-11-05',0,'missing'],['2026-11-06',3,'missing'],['2026-11-10',2,'legacy']]);
 }
 assert.equal(writes.length,0);
 assert(reads.every(p=>p==='callbackSessions/qa-anon'||p==='callbackProfiles/qa-member'||p==='users/qa-member/surveys'||p==='memberInfo/가상멤버/join'||/^sales\/2026-11-\d{2}\/가상멤버$/.test(p)||/^callbacksheets\/qa-member\/2026-11-\d{2}$/.test(p)));
 assert(reads.filter(p=>p.startsWith('sales/')).every(p=>p.split('/')[1]>=(kind==='fallback'?'2026-11-04':kind==='firstfield-denied'?'2026-11-01':'2026-11-03')&&p.split('/')[1]<='2026-11-21'));
 checks++;console.log(`PASS ${kind}; scoped reads ${reads.length}, writes ${writes.length}`);
}
for(const kind of ['ok','fallback','firstfield-denied','failure','legacy-error','name-mismatch','account-change'])await run(kind);
console.log(JSON.stringify({checks,passed:true,realDataRequests:0,realWrites:0}));
