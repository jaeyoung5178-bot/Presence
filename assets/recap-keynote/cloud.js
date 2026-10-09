import {clone, validate, recruitingSummary} from './model.js?v=20261009-views-1';

const CFG = {
  apiKey:'AIzaSyCYKKnK8myrSM-eip9HEJxYRq_hzpfPUY0',
  authDomain:'presence-team.firebaseapp.com',
  databaseURL:'https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:'presence-team',
  appId:'1:1056684483470:web:1f50113d410b53458d3adf',
};
const VERSION = '10.12.0';
const validMonth = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''));
const error = (code,message) => Object.assign(new Error(message),{code});
const proofOf = password => {
  let h = 5381;
  for (const c of String(password || '')) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
};
export function allowed(user) {
  return !!user && user.status === 'active' && (user.uid === 'admin' || ['TL','AOP','OP','OWNER'].includes(String(user.role || '').toUpperCase()));
}
let runtime;
async function firebase() {
  if (!runtime) runtime = (async () => {
    const [app,db,auth] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-database.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`),
    ]);
    const instance = app.getApps().find(a => a.name === 'recapStudio') || app.initializeApp(CFG,'recapStudio');
    return {db,auth,database:db.getDatabase(instance),session:auth.getAuth(instance)};
  })().catch(cause => {runtime = null; throw cause;});
  return runtime;
}
function readWithin(promise, label, ms = 18000) {
  let timer;
  return Promise.race([promise,new Promise((_,reject) => {
    timer = setTimeout(() => reject(error('recap/timeout',`${label} 연결 시간이 초과되었습니다. 다시 시도해 주세요.`)),ms);
  })]).finally(() => clearTimeout(timer));
}

// Only this gateway touches Firebase. Workbook source paths are read-only here.
export function gateway() {
  let current = null;
  let generation = 0;
  const rawGet = async path => {
    const f = await firebase();
    return readWithin(f.db.get(f.db.ref(f.database,path)).then(s => s.val()),path);
  };
  const ensureAnon = async () => {
    const f = await firebase();
    if (f.session.authStateReady) await readWithin(f.session.authStateReady(),'인증');
    if (f.session.currentUser) return f.session.currentUser;
    return (await readWithin(f.auth.signInAnonymously(f.session),'인증')).user;
  };
  const readProfile = async uid => {
    const profile = await rawGet(`users/${uid}`);
    // The database key is the authenticated identity; never trust a mismatching profile uid.
    return profile ? {...profile,uid} : null;
  };
  const requireAllowed = async () => {
    if (!allowed(current)) throw error('recap/forbidden','리캡은 활성 관리자·TL·AOP·OP 계정만 사용할 수 있습니다.');
    const uid = current.uid, token = generation, f = await firebase();
    const anonymous = f.session.currentUser;
    if (!anonymous) {current = null; throw error('recap/forbidden','다시 로그인해 주세요.');}
    const [session,fresh] = await Promise.all([rawGet(`authSessions/${anonymous.uid}`),readProfile(uid)]);
    if (token !== generation || session?.userUid !== uid || !allowed(fresh)) {
      current = null;
      throw error('recap/forbidden','계정의 리캡 접근 권한을 확인해 주세요.');
    }
    current = fresh;
    return fresh;
  };
  const checkMonth = month => {
    if (!validMonth(month)) throw error('recap/validation','올바른 월을 선택해 주세요.');
  };
  const checkDraft = draft => {
    const errors = validate(draft);
    if (errors.length) throw Object.assign(error('recap/validation',errors.join('\n')),{errors});
  };

  return {
    async restore() {
      const token = ++generation, anonymous = await ensureAnon();
      const saved = await rawGet(`authSessions/${anonymous.uid}`);
      if (!saved?.userUid) {current = null; return null;}
      const user = await readProfile(saved.userUid);
      if (token !== generation) return null;
      if (!allowed(user)) {current = null; return null;}
      current = user;
      return clone(user);
    },
    async login(loginId,password) {
      const name = String(loginId || '').trim();
      if (!name || !password) throw error('recap/credentials','아이디와 비밀번호를 입력해 주세요.');
      const token = ++generation;
      current = null;
      const anonymous = await ensureAnon();
      const key = name.toLowerCase().replace(/[.#$\/\[\]]/g,'_');
      const uid = await rawGet(`loginIndex/${key}`);
      if (typeof uid !== 'string' || !uid) throw error('recap/credentials','아이디 또는 비밀번호를 확인해 주세요.');
      const f = await firebase();
      try {
        await f.db.set(f.db.ref(f.database,`authSessions/${anonymous.uid}`),{idKey:key,userUid:uid,proof:proofOf(password),createdAt:Date.now()});
      } catch (cause) {
        if (/permission|denied/i.test(`${cause.code} ${cause.message}`)) throw error('recap/credentials','아이디 또는 비밀번호를 확인해 주세요.');
        throw cause;
      }
      const user = await readProfile(uid);
      if (token !== generation) throw error('recap/superseded','새 로그인 요청으로 변경되었습니다.');
      if (!allowed(user)) throw error('recap/forbidden','리캡은 활성 관리자·TL·AOP·OP 계정만 사용할 수 있습니다.');
      current = user;
      return clone(user);
    },
    async read(month,published = false) {
      checkMonth(month);
      await requireAllowed();
      const token = generation, path = `recaps/${published ? 'published' : 'keynote'}/${month}`;
      const snapshot = await rawGet(path);
      if (token !== generation || !allowed(current)) throw error('recap/superseded','세션이 변경되어 열람을 취소했습니다.');
      // A saved reader never fetches the workbook or reconciles live source values.
      return {state:{},saved:published ? null : snapshot,published:published ? snapshot : null,legacy:null,warnings:[]};
    },
    async list() {
      await requireAllowed();
      const token = generation;
      const paths = ['recaps/keynote','recaps/published'];
      const results = await Promise.allSettled(paths.map(rawGet));
      if (token !== generation || !allowed(current)) throw error('recap/superseded','세션이 변경되어 목록 불러오기를 취소했습니다.');
      const values = [], warnings = [];
      results.forEach((result,i) => {
        if (result.status === 'fulfilled') values[i] = result.value || {};
        else {values[i] = null;warnings.push(`${paths[i]} 목록을 불러오지 못했습니다. 다시 시도해 주세요.`);}
      });
      if (values.every(v => v === null)) throw error('recap/load',warnings.join('\n'));
      return {saved:values[0],published:values[1],warnings};
    },
    async load(month) {
      checkMonth(month);
      await requireAllowed();
      const token = generation;
      // Never read all recaps: each month stays independent and sensitive sources are least-scope.
      const keys = ['users','sales','memberInfo','dossier','removedMembers','weeklyProfitRecaps','profitMonthlyBep','recruit'];
      const tasks = [...keys,`recaps/keynote/${month}`,`recaps/monthly/${month}`,`recaps/published/${month}`];
      const settled = await Promise.allSettled(tasks.map(rawGet));
      if (token !== generation || !allowed(current)) throw error('recap/superseded','세션이 변경되어 불러오기를 취소했습니다.');
      const warnings = [], state = {}, documents = {};
      for (let i = 0; i < tasks.length; i++) {
        const path = tasks[i], result = settled[i];
        if (result.status === 'rejected') {
          if (['users','sales',`recaps/keynote/${month}`].includes(path)) {
            throw error('recap/load',`${path} 데이터를 불러오지 못했습니다. 빈 데이터로 덮어쓰지 않도록 작업을 중단했습니다.`);
          }
          const message = path === 'weeklyProfitRecaps' || path === 'profitMonthlyBep'
            ? `${path}: 급여 리캡 읽기 권한 또는 연결을 확인해 주세요. 미확인 수치는 —로 표시됩니다.`
            : `${path}: 원본을 불러오지 못했습니다. 해당 항목을 확인해 주세요.`;
          warnings.push(message);
          if (keys.includes(path)) state[path] = null;
          else documents[path] = null;
        } else if (keys.includes(path)) state[path] = result.value ?? {};
        else documents[path] = result.value;
      }
      state.sourceAt = Date.now();
      state.sourceWarnings = warnings;
      state.current = clone(current);
      return {state,saved:documents[`recaps/keynote/${month}`] || null,
        legacy:documents[`recaps/monthly/${month}`] || null,
        published:documents[`recaps/published/${month}`] || null,warnings};
    },
    async save(draft,revision = draft?.revision ?? 0) {
      checkDraft(draft);
      const user = await requireAllowed(), token = generation;
      const expected = Number(revision);
      if (!Number.isInteger(expected) || expected < 0) throw error('recap/validation','저장 버전을 확인해 주세요.');
      const f = await firebase(), reference = f.db.ref(f.database,`recaps/keynote/${draft.month}`);
      // Seed the transaction cache, and detect a conflict before a possible local-null callback.
      const existing = await readWithin(f.db.get(reference),'리캡 버전');
      if (Number(existing.val()?.revision || 0) !== expected) throw error('recap/conflict','다른 창에서 이 달의 리캡이 변경되었습니다. 현재 내용을 복사한 뒤 다시 불러와 주세요.');
      const next = {...clone(draft),version:1,revision:expected + 1,updatedAt:Date.now(),updatedBy:user.uid};
      const result = await f.db.runTransaction(reference,remote => {
        if (generation !== token || !allowed(current) || Number(remote?.revision || 0) !== expected) return undefined;
        return next;
      },{applyLocally:false});
      if (!result.committed) throw error('recap/conflict','저장 중 다른 변경이 감지되었습니다. 다시 불러온 뒤 저장해 주세요.');
      // Return the full submitted shape; Firebase omits null object fields and empty arrays.
      return clone(next);
    },
    async publish(draft) {
      checkDraft(draft);
      const user = await requireAllowed(), token = generation;
      const f = await firebase();
      const live = await rawGet(`recaps/keynote/${draft.month}`);
      if (!live || Number(live.revision || 0) !== Number(draft.revision || 0)) throw error('recap/conflict','현재 버전을 먼저 저장한 뒤 발행해 주세요.');
      const reference = f.db.ref(f.database,`recaps/published/${draft.month}`);
      await readWithin(f.db.get(reference),'발행 리캡');
      const snapshot = clone(draft), publishedAt = Date.now(), recruiting = recruitingSummary(draft.recruiting);
      const result = await f.db.runTransaction(reference,previous => {
        if (generation !== token || !allowed(current)) return undefined;
        // Preserve old monthly archive fields while attaching the new frozen keynote snapshot.
        return {...(previous || {}),month:draft.month,teamName:draft.teamName || 'Presence',leader:draft.leader || '',
          headline:draft.headline || '',weeks:draft.weeks,members:draft.members,
          interviews:recruiting.booking,showups:recruiting.showup,starters:recruiting.starter,
          updatedAt:publishedAt,publishedAt,publishedBy:user.uid,keynote:snapshot};
      },{applyLocally:false});
      if (!result.committed) throw error('recap/conflict','세션이 변경되어 발행을 취소했습니다.');
      return result.snapshot.val();
    },
    async logout() {
      current = null; generation++;
      const f = await firebase(), anonymous = f.session.currentUser;
      // Signing out always happens, even if clearing the server session fails.
      try {if (anonymous) await readWithin(f.db.set(f.db.ref(f.database,`authSessions/${anonymous.uid}`),null),'로그아웃 세션',3000);}
      catch (_) { /* Local sign-out must complete even when the network cannot remove the old anonymous session. */ }
      finally {await f.auth.signOut(f.session);}
    },
  };
}
