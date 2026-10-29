import {auth,firebase} from '../recruiting/store.js?v=20261025-1';
import {validateDocument} from './model.mjs';
export {auth};
export class ConflictError extends Error {constructor(){super('다른 기기에서 수정됐습니다. 내 초안을 백업한 뒤 최신 내용을 불러와 비교해주세요.');this.name='ConflictError';}}
export async function createBlueprintCloud(user,onData,onState,{getFirebase=firebase,timeoutMs=18000,online=()=>navigator.onLine}={}){
 if(!/^[a-zA-Z0-9_-]{1,160}$/.test(user?.uid))throw Error('계정을 확인해주세요.');
 const f=await getFirebase(),root=`userPreferences/${user.uid}/presenceBlueprint`,target=f.d.ref(f.db,root);let closed=false;
 const timed=async p=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('서버 응답을 확인하지 못했습니다. 초안을 유지했으니 연결을 확인해주세요.')),timeoutMs);})]);}finally{clearTimeout(timer);}};
 function decode(value){if(!value)return {document:null,revision:0};if(!Number.isInteger(value.revision)||value.revision<1||typeof value.documentJson!=='string')throw Error('서버 초안 형식을 확인해주세요.');return {document:validateDocument(JSON.parse(value.documentJson)),revision:value.revision,updatedAt:value.updatedAt,operationId:value.operationId};}
 const emit=(state,message)=>{if(!closed)onState(state,message);};
 const stopData=f.d.onValue(target,s=>{if(closed)return;try{onData(decode(s.val()));emit('ready','내 계정의 초안을 불러왔습니다.');}catch{emit('error','서버 초안을 읽지 못했습니다. 기존 기록을 덮어쓰지 않도록 저장을 잠갔습니다.');}},()=>emit('denied','내 초안에 접근하지 못했습니다. 다시 로그인해주세요.'));
 const stopSession=f.d.onValue(f.d.ref(f.db,`authSessions/${f.auth.currentUser.uid}`),s=>{if(s.val()?.userUid!==user.uid)emit('signedout','로그인 계정이 바뀌었습니다. 다시 로그인해주세요.');},()=>emit('signedout','계정 연결이 만료됐습니다.'));
 const stopUser=f.d.onValue(f.d.ref(f.db,`users/${user.uid}`),s=>{if(s.val()?.status!=='active')emit('signedout','활성 계정을 확인해주세요.');},()=>emit('signedout','계정 상태를 확인하지 못했습니다.'));
 const stopConnected=f.d.onValue(f.d.ref(f.db,'.info/connected'),s=>emit(s.val()?'connected':'offline',s.val()?'계정 연결됨':'연결 확인 중 · 아직 저장되지 않은 내용은 이 탭에 유지됩니다.'));
 const stopAuth=f.h.onAuthStateChanged?.(f.auth,u=>{if(!u)emit('signedout','로그아웃됐습니다.');})||(()=>{});
 async function account(){if(closed||!f.auth.currentUser)throw Error('다시 로그인해주세요.');if(!online())throw Error('오프라인입니다. 초안은 유지했습니다. 연결 후 다시 저장해주세요.');const [session,profile]=await timed(Promise.all([f.d.get(f.d.ref(f.db,`authSessions/${f.auth.currentUser.uid}`)),f.d.get(f.d.ref(f.db,`users/${user.uid}`))]));if(closed||session.val()?.userUid!==user.uid||profile.val()?.status!=='active')throw Error('계정이 바뀌었습니다. 다시 로그인해주세요.');}
 return {
  async save(document,expected){const safe=validateDocument(document);await account();const operationId=crypto.randomUUID(),payload={revision:expected+1,operationId,updatedAt:Date.now(),documentJson:JSON.stringify(safe)};
   try{const result=await timed(f.d.runTransaction(target,current=>Number(current?.revision||0)===expected?payload:undefined,{applyLocally:false}));if(closed)throw Error('계정이 바뀌었습니다.');if(!result.committed)throw new ConflictError();return decode(result.snapshot.val());}
   catch(error){if(error instanceof ConflictError)throw error;if(closed)throw error;try{const latest=await timed(f.d.get(target));if(!closed&&latest.val()?.operationId===operationId)return decode(latest.val());}catch{}throw error;}
  },
  async read(){await account();return decode((await timed(f.d.get(target))).val());},
  close(){closed=true;stopData();stopSession();stopUser();stopConnected();stopAuth();}
 };
}
