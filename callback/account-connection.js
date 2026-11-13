// Reuses the workbook login claim. Only authSessions is written on the server.
const CONFIG={apiKey:'AIzaSyCYKKnK8myrSM-eip9HEJxYRq_hzpfPUY0',authDomain:'presence-team.firebaseapp.com',databaseURL:'https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'presence-team',appId:'1:1056684483470:web:1f50113d410b53458d3adf'};
const KEYS=['fcos_hub_identity','fcos_callback_access_key','fcos_personal_launch_v2','fcos_locked'];
const validUid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(v);
const validKey=v=>typeof v==='string'&&v.length>0&&v.length<=2048;
const fail=(code,message)=>Object.assign(new Error(message),{code});
const proofOf=password=>{let h=5381;for(const c of String(password||''))h=((h<<5)+h+c.charCodeAt(0))>>>0;return h.toString(36);};
function identity(storage){try{let who=JSON.parse(storage.getItem(KEYS[0])||'null'),key=storage.getItem(KEYS[1])||'',launch;try{launch=JSON.parse(storage.getItem(KEYS[2])||'null');}catch{}if(!who&&launch)who={uid:launch.u,name:launch.n};if(!validKey(key)&&launch?.u===who?.uid)key=launch.k;return validUid(who?.uid)&&validKey(key)?{uid:who.uid,name:typeof who.name==='string'?who.name:'',key}:null;}catch{return null;}}
export function readExistingConnection(storage=globalThis.localStorage){const who=identity(storage);return who?{connected:true,uid:who.uid,name:who.name}:{connected:false,uid:'',name:''};}
let runtime;
async function loadFirebase(){if(!runtime)runtime=Promise.all(['firebase-app','firebase-database','firebase-auth'].map(name=>import(`https://www.gstatic.com/firebasejs/10.12.2/${name}.js`))).then(([app,db,auth])=>{const instance=app.getApps().find(x=>x.name==='presence-callback-account-connector')||app.initializeApp(CONFIG,'presence-callback-account-connector');return{db,auth,database:db.getDatabase(instance),session:auth.getAuth(instance)};}).catch(e=>{runtime=null;throw e;});return runtime;}
export function createAccountConnection({storage=globalThis.localStorage,loadFirebase:load=loadFirebase,target=globalThis.window,timeoutMs=18000}={}){
 let generation=0,busy=false;
 const snapshot=()=>KEYS.map(key=>storage.getItem(key));
 const bounded=promise=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('callback/timeout','연결 시간이 초과됐어요. 기존 기록은 유지됩니다.')),timeoutMs);})]).finally(()=>clearTimeout(timer));};
 return{
  cancel(){generation++;},
  async connect(loginId,password){
   if(busy)throw fail('callback/busy','계정을 확인하고 있어요. 잠시 기다려 주세요.');
   const login=String(loginId||'').trim();if(!login||!password)throw fail('callback/credentials','아이디와 비밀번호를 입력해 주세요.');
   const before=snapshot(),existing=identity(storage),ticket=++generation;let activeSession=null,authUid='';busy=true;
   const guard=()=>{if(authUid&&activeSession?.currentUser?.uid!==authUid)throw fail('callback/connection-changed','로그인 세션이 변경됐어요. 다시 연결해 주세요.');if(ticket!==generation)throw fail('callback/connection-changed','연결 요청이 취소됐어요.');if(JSON.stringify(snapshot())!==JSON.stringify(before))throw fail('callback/connection-changed','연결된 계정이 바뀌었어요. 기존 기록은 유지됩니다.');};
   try{
    const f=await bounded(load());guard();
    if(f.session.authStateReady)await bounded(f.session.authStateReady());guard();
    const anonymous=f.session.currentUser||(await bounded(f.auth.signInAnonymously(f.session))).user;activeSession=f.session;authUid=anonymous.uid;guard();
    const read=async path=>{const value=await bounded(f.db.get(f.db.ref(f.database,path)));guard();return value.val();};
    const idKey=login.toLowerCase().replace(/[.#$\/\[\]]/g,'_'),uid=await read('loginIndex/'+idKey);if(!validUid(uid))throw fail('callback/credentials','아이디 또는 비밀번호를 확인해 주세요.');
    if(existing&&existing.uid!==uid)throw fail('callback/account-changed','이 기기는 다른 개인 계정에 연결되어 있어요. 기존 연결을 유지합니다.');
    try{guard();await bounded(f.db.set(f.db.ref(f.database,'authSessions/'+anonymous.uid),{idKey,userUid:uid,proof:proofOf(password),createdAt:Date.now()}));}catch(e){if(/permission|denied/i.test(String(e.code)+' '+String(e.message)))throw fail('callback/credentials','아이디 또는 비밀번호를 확인해 주세요.');throw e;}guard();
    const [claim,user]=await Promise.all([read('authSessions/'+anonymous.uid),read('users/'+uid)]);guard();
    if(claim?.userUid!==uid||user?.status!=='active')throw fail('callback/inactive','활성 계정의 로그인 상태를 확인해 주세요.');
    const profile=await read('callbackProfiles/'+uid);if(!profile)throw fail('callback/profile-missing','개인 콜백 연결 정보가 아직 없어요. 관리자에게 개인 콜백 연결을 요청해 주세요.');
    if(profile.status!=='active'||profile.uid&&profile.uid!==uid)throw fail('callback/profile-inactive','개인 콜백 연결이 비활성 상태예요. 관리자에게 확인해 주세요.');
    if(!validKey(profile.accessKey))throw fail('callback/profile-inactive','유효한 개인 콜백 연결 정보가 없어요. 관리자에게 확인해 주세요.');
    const [freshClaim,freshUser,freshProfile]=await Promise.all([read('authSessions/'+anonymous.uid),read('users/'+uid),read('callbackProfiles/'+uid)]);guard();
    if(freshClaim?.userUid!==uid||freshUser?.status!=='active'||freshProfile?.status!=='active'||freshProfile?.accessKey!==profile.accessKey)throw fail('callback/expired','계정 연결 정보가 변경됐어요. 다시 확인해 주세요.');
    const name=typeof freshUser.name==='string'?freshUser.name.trim():'';if(!name)throw fail('callback/inactive','계정 이름을 확인할 수 없어요.');
    if(existing?.uid===uid&&existing.key===profile.accessKey)return{connected:true,uid,name,alreadyConnected:true};
    const values=[JSON.stringify({uid,name}),profile.accessKey,JSON.stringify({u:uid,n:name,k:profile.accessKey,savedAt:Date.now()}),uid==='admin'?null:'1'];guard();
    try{KEYS.forEach((key,i)=>{if(values[i]===null)storage.removeItem(key);else storage.setItem(key,values[i]);});}catch(cause){for(let i=0;i<KEYS.length;i++){try{if(before[i]===null)storage.removeItem(KEYS[i]);else storage.setItem(KEYS[i],before[i]);}catch{}}throw fail('callback/storage','이 기기에 연결을 저장하지 못했어요. 기존 기록은 변경하지 않았습니다.');}
    // No access key is included in the URL or event payload.
    if(target?.dispatchEvent){try{target.dispatchEvent(new StorageEvent('storage',{key:KEYS[0],oldValue:before[0],newValue:values[0],storageArea:storage}));}catch{const event=new Event('storage');Object.defineProperty(event,'key',{value:KEYS[0]});target.dispatchEvent(event);}target.dispatchEvent(new CustomEvent('presence-callback-connected',{detail:{uid,name}}));target.dispatchEvent(new Event('focus'));}
    return{connected:true,uid,name,alreadyConnected:false};
   }catch(e){if(e?.code)throw e;throw fail('callback/connection','계정 연결을 확인하지 못했어요. 기존 기록은 유지됩니다.');}finally{busy=false;}
  }
 };
}
