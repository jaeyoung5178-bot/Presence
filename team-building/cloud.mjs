import {auth as workbookAuth, firebase} from '../recruiting/store.js?v=20261025-1';
import {CARE,emptyRecord,validateRecord,summaryFor,aggregate,isDate,normalizeMemberName,memberNameKey} from './model.mjs?v=20261112-team2';

export const auth=workbookAuth;
export const OWNER_UID='umqn5es9t';
const ROOT='teamBuildingSupport';
const clone=x=>JSON.parse(JSON.stringify(x));
const clean=x=>Array.isArray(x)?x.map(clean):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,clean(v)])):x;
export function encodeRecord(record){const r=clone(record);r.review.care=Object.fromEntries(r.review.care.map(({key,...v})=>[key,v]));r.sales.team=Object.fromEntries(r.sales.team.map(({memberId,...v})=>[memberId,v]));return clean(r);}
export function decodeDocument(doc,date){if(!doc)return {record:emptyRecord(date),revision:0,updatedAt:0};if(doc.version!==1||doc.ownerUid!==OWNER_UID||doc.record?.date!==date||!Number.isInteger(doc.revision)||doc.revision<1)throw Error('기록 형식을 확인하지 못했습니다. 관리자에게 확인해 주세요.');const r=clone(doc.record);r.review??={};r.review.care=CARE.map(({key})=>({key,rating:'',note:'',...r.review.care?.[key]}));r.sales??={};r.sales.team=Object.entries(r.sales.team||{}).map(([memberId,row])=>({memberId,...row}));return {record:validateRecord(r,date),revision:doc.revision,updatedAt:doc.updatedAt,updatedBy:doc.updatedBy};}
export async function createTeamBuildingCloud(account,onState=()=>{},{getFirebase=firebase,timeoutMs=18000,online=()=>navigator.onLine}={}){
 if(!account?.uid)throw Error('워크북 계정으로 로그인해 주세요.');
 const f=await getFirebase();let closed=false,generation=0,viewer=null,owner=null,members=[],watchers=[];
 const sessionUid=f.auth.currentUser?.uid;
 function active(epoch=generation){if(closed||epoch!==generation||f.auth.currentUser?.uid!==sessionUid)throw Error('계정 연결이 바뀌었습니다. 다시 로그인해 주세요.');}
 function timed(p){let t;return Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('연결 시간이 초과됐습니다. 입력은 유지되며, 다시 저장할 수 있어요.')),timeoutMs);})]).finally(()=>clearTimeout(t));}
 async function raw(path){const epoch=generation;active(epoch);const snapshot=await timed(f.d.get(f.d.ref(f.db,path)));active(epoch);return snapshot.val();}
 async function authorize(adminOnly=false){const epoch=generation;active(epoch);if(!online())throw Error('오프라인입니다. 온라인 연결 후 저장해 주세요.');const session=await raw(`authSessions/${sessionUid}`);if(session?.userUid!==account.uid)throw Error('워크북 로그인 계정이 바뀌었습니다. 다시 로그인해 주세요.');const p=await raw(`users/${session.userUid}`);active(epoch);if(p?.status!=='active'||![OWNER_UID,'admin'].includes(session.userUid))throw Error('박인선 전용 기록과 관리자 계정만 이용할 수 있어요.');const actual={uid:session.userUid,name:p.name||'',isAdmin:session.userUid==='admin'};if(adminOnly&&!actual.isAdmin)throw Error('분석은 관리자만 열 수 있습니다.');viewer=actual;return actual;}
 function revoked(){if(closed)return;closed=true;generation++;viewer=null;owner=null;members=[];watchers.forEach(off=>off());watchers=[];onState('signedout','로그인 또는 페이지 권한이 변경되었습니다. 다시 로그인해 주세요.');}
 async function boot(){const v=await authorize(),config=await raw(`${ROOT}/config`);if(config?.version!==1||config.ownerUid!==OWNER_UID||config.ownerName!=='박인선'||config.enabled!==true)throw Error('팀빌딩 지원의 온라인 저장 준비를 확인하고 있습니다. 관리자에게 확인해 주세요.');owner={uid:OWNER_UID,name:config.ownerName,role:config.ownerRole||'LR'};const directory=await raw(`${ROOT}/directory/${OWNER_UID}`);if(directory?.version!==1)throw Error('선택할 팀원 명단이 준비되지 않았습니다. 관리자에게 확인해 주세요.');members=Object.entries(directory.members||{}).filter(([id,p])=>p?.active===true&&id!==OWNER_UID).map(([id,p])=>({id,name:p.name,role:p.role||'IC'})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));if(!watchers.length){watchers.push(f.d.onValue(f.d.ref(f.db,`authSessions/${sessionUid}`),s=>{if(s.val()?.userUid!==account.uid)revoked();},revoked));watchers.push(f.d.onValue(f.d.ref(f.db,`users/${account.uid}/status`),s=>{if(s.val()!=='active')revoked();},revoked));watchers.push(f.d.onValue(f.d.ref(f.db,`${ROOT}/config/enabled`),s=>{if(s.val()!==true)revoked();},revoked));}await authorize();onState('connected','온라인 저장 연결됨');return {viewer:{...v},owner:{...owner},members:clone(members)};}
 async function read(date){if(!isDate(date))throw Error('날짜를 확인해 주세요.');await authorize();const value=await raw(`${ROOT}/records/${OWNER_UID}/${date}`);await authorize();return decodeDocument(value,date);}
 async function listMonth(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('달력을 확인해 주세요.');await authorize();const epoch=generation,q=f.d.query(f.d.ref(f.db,`${ROOT}/records/${OWNER_UID}`),f.d.orderByKey(),f.d.startAt(month+'-01'),f.d.endAt(month+'-31'));const snapshot=await timed(f.d.get(q));active(epoch);await authorize();return Object.entries(snapshot.val()||{}).map(([date,doc])=>summaryFor(decodeDocument(doc,date).record)).sort((a,b)=>a.date.localeCompare(b.date));}
 async function save(date,record,expectedRevision){
  const v=await authorize();if(!isDate(date)||record?.date!==date||!Number.isInteger(expectedRevision)||expectedRevision<0)throw Error('기록 날짜와 저장 버전을 확인해 주세요.');
  const normalized=validateRecord(record,date),directory=await raw(`${ROOT}/directory/${OWNER_UID}`),target=f.d.ref(f.db,`${ROOT}/records/${OWNER_UID}/${date}`),epoch=generation;
  const before=await timed(f.d.get(target));active(epoch);const previous=before.val();
  for(const row of normalized.sales.team){const member=directory?.members?.[row.memberId],historical=previous?.record?.sales?.team?.[row.memberId];const current=member?.active===true&&member.name===row.memberName;const preserved=historical?.memberName===row.memberName;if((!current&&!preserved)||row.memberId===OWNER_UID)throw Error('선택한 팀원 이름이 변경됐습니다. 최신 명단을 다시 열어 주세요.');}
  await authorize();const next={version:1,ownerUid:OWNER_UID,revision:expectedRevision+1,updatedAt:Date.now(),updatedBy:v.uid,record:encodeRecord(normalized)};
  const result=await timed(f.d.runTransaction(target,current=>Number(current?.revision||0)===expectedRevision?next:undefined,{applyLocally:false}));active(epoch);await authorize();
  if(!result.committed){const error=Error('다른 기기에서 먼저 수정했습니다. 작성 내용은 유지했어요. 최신 기록을 다시 열어 비교해 주세요.');error.name='ConflictError';error.code='conflict';throw error;}
  onState('saved','온라인에 저장되었습니다');return decodeDocument(result.snapshot.val(),date);
 }
 async function addMember(value){
  const v=await authorize(),name=normalizeMemberName(value),key=memberNameKey(name),directoryPath=`${ROOT}/directory/${OWNER_UID}`,epoch=generation;
  function existing(directory){const id=directory?.nameIndex?.[key];if(!id)return null;const row=directory.members?.[id];if(!row||memberNameKey(row.name)!==key)throw Error('이름 명단을 확인하지 못했습니다. 다시 열어 주세요.');if(row.active!==true)throw Error('같은 이름의 보관된 팀원이 있습니다. 관리자에게 확인해 주세요.');return {id,name:row.name,role:row.role||'IC'};}
  const directory=await raw(directoryPath);if(directory?.version!==1||directory.memberIndexVersion!==1)throw Error('이름 등록 준비를 확인하고 있습니다. 잠시 후 다시 열어 주세요.');
  const found=existing(directory);if(found){await authorize();return found;}
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('presence-private-journal-member:'+key));active(epoch);
  const id='custom_'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('').slice(0,32),row={name,role:'IC',active:true,createdAt:Date.now(),createdBy:v.uid};
  await authorize();
  try{await timed(f.d.update(f.d.ref(f.db,directoryPath),{[`members/${id}`]:row,[`nameIndex/${key}`]:id}));active(epoch);}
  catch(error){active(epoch);await authorize();const concurrent=existing(await raw(directoryPath));if(concurrent)return concurrent;throw Error('이름을 온라인에 등록하지 못했습니다. 입력은 유지했어요. 다시 시도해 주세요.');}
  await authorize();const confirmed=existing(await raw(directoryPath));if(!confirmed||confirmed.id!==id)throw Error('등록 결과를 확인하지 못했습니다. 다시 열어 확인해 주세요.');
  if(!members.some(x=>x.id===confirmed.id))members.push(confirmed);onState('connected','이름이 온라인에 등록되었습니다');return confirmed;
 }
 async function analytics({from,to}){const v=await authorize(true);if(!isDate(from)||!isDate(to)||from>to||new Date(to)-new Date(from)>366*86400000)throw Error('분석 기간은 1년 이내로 선택해 주세요.');const all=await raw(`${ROOT}/records`);await authorize(true);const rows=Object.entries(all?.[OWNER_UID]||{}).filter(([date])=>date>=from&&date<=to).map(([date,doc])=>decodeDocument(doc,date));const a=aggregate(rows),summary={days:a.days,planDays:a.planDays,reviewDays:a.reviewDays,ownDonors:a.ownDonors??rows.reduce((s,x)=>s+(x.record.sales.self.donors||0),0),ownCloses:a.ownCloses,teamDonors:a.teamDonors??rows.reduce((s,x)=>s+x.record.sales.team.reduce((n,r)=>n+(r.donors||0),0),0),teamCloses:a.teamCloses},snapshot={version:1,from,to,generatedAt:Date.now(),generatedBy:v.uid,sourceRevisions:Object.fromEntries(rows.map(x=>[x.record.date,x.revision])),summary,care:Object.fromEntries(a.care.map(x=>[x.key,{total:x.total,good:x.good,improve:x.improve,notDone:x.notDone}]))};const epoch=generation;await timed(f.d.set(f.d.ref(f.db,`${ROOT}/analytics/${OWNER_UID}/${from}_${to}`),snapshot));active(epoch);await authorize(true);return rows;}
 return {boot,read,save,listMonth,addMember,analytics,close(){if(closed)return;closed=true;generation++;viewer=null;owner=null;members=[];watchers.forEach(off=>off());watchers=[];}};
}
