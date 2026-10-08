// A separate Firebase app keeps paper-sheet authentication independent from Field Callback OS.
const DATABASE = 'https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app';
const CONFIG = {
  apiKey: 'AIzaSyCYKKnK8myrSM-eip9HEJxYRq_hzpfPUY0', authDomain: 'presence-team.firebaseapp.com',
  databaseURL: DATABASE, projectId: 'presence-team', storageBucket: 'presence-team.appspot.com',
  messagingSenderId: '1056684483470', appId: '1:1056684483470:web:1f50113d410b53458d3adf',
};
const validUid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(value);

export class IdentityChangedError extends Error {
  constructor() { super('연결 계정이 바뀌었어요. 현재 계정의 기록을 다시 열어주세요.'); this.name = 'IdentityChangedError'; }
}

// Only established local callback credentials are considered; URL parameters never establish identity.
export function readAccountIdentity(storage = globalThis.localStorage) {
  let who, key = '', launch;
  try {
    const raw = storage.getItem('fcos_hub_identity');
    if (raw) {
      who = JSON.parse(raw);
      key = storage.getItem('fcos_callback_access_key') || '';
    } else {
      launch = JSON.parse(storage.getItem('fcos_personal_launch_v2') || 'null');
      who = launch && { uid: launch.u, name: launch.n };
      key = launch?.k || '';
    }
  } catch { return { namespace: 'guest', uid: '', name: '', accessKey: '', signature: 'guest' }; }
  if (!validUid(who?.uid) || typeof key !== 'string' || !key || key.length > 2048) {
    return { namespace: 'guest', uid: '', name: '', accessKey: '', signature: 'guest' };
  }
  return { namespace: `user:${who.uid}`, uid: who.uid, name: typeof who.name === 'string' ? who.name.slice(0, 500) : '', accessKey: key, signature: JSON.stringify([who.uid, key]) };
}

async function loadFirebase() {
  const [app, auth] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
  ]);
  return { ...app, ...auth };
}

// RTDB removes object properties whose values are null. Keep the validated sheet as a JSON string
// so blank count cells, empty goals and photo sources round-trip without becoming malformed.
function decodeDocument(value) {
  if (!value || typeof value !== 'object' || typeof value.sheetJson !== 'string') return value;
  try {
    const { sheetJson, ...document } = value;
    return { ...document, sheet: JSON.parse(sheetJson) };
  } catch { return value; } // The storage validator preserves an invalid remote record instead of replacing it.
}
function encodeDocument(value) {
  const { sheet, ...document } = value;
  return sheet ? { ...document, sheetJson: JSON.stringify(sheet) } : document;
}

export function createCloudClient({ readIdentity = readAccountIdentity, fetchImpl = (...args) => fetch(...args), loadFirebase: load = loadFirebase, timeoutMs = 12000 } = {}) {
  let ready = null, readySignature = '', activeAuth = null, activeUser = null;
  const assertIdentity = context => { if (readIdentity().signature !== context.signature) throw new IdentityChangedError(); };
  const bounded = promise => {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('서버 연결 시간이 초과됐어요. 이 브라우저의 기록은 유지돼요.')), timeoutMs); })]).finally(() => clearTimeout(timer));
  };
  const url = (path, token) => `${DATABASE}/${path}.json?auth=${encodeURIComponent(token)}`;
  async function request(context, path, token, options = {}) {
    assertIdentity(context);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url(path, token), { cache: 'no-store', ...options, signal: controller.signal });
      const body = await response.text();
      assertIdentity(context);
      let data = null;
      if (body) {
        try { data = JSON.parse(body); } catch { throw new Error('서버 응답을 확인할 수 없어요. 저장된 기록은 유지돼요.'); }
      }
      return { status: response.status, ok: response.ok, data, etag: response.headers.get('ETag') };
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('서버 연결 시간이 초과됐어요. 이 브라우저의 기록은 유지돼요.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function serverError(status) {
    return new Error(status === 401 || status === 403
      ? '계정 연결을 확인할 수 없어요. 워크북의 개인 콜백 링크를 다시 열어주세요.'
      : `서버에 연결하지 못했어요 (${status}). 이 브라우저의 기록은 유지돼요.`);
  }
  async function authenticate(context) {
    if (!context.uid || !context.accessKey) throw new Error('워크북의 개인 콜백 링크를 먼저 열어 계정을 연결해 주세요.');
    assertIdentity(context);
    const sdk = await bounded(load());
    assertIdentity(context);
    let app;
    try { app = sdk.getApp('presence-paper-sheets'); } catch { app = sdk.initializeApp(CONFIG, 'presence-paper-sheets'); }
    const auth = sdk.getAuth(app);
    await bounded(sdk.setPersistence(auth, sdk.browserLocalPersistence));
    await bounded(auth.authStateReady());
    assertIdentity(context);
    let user = auth.currentUser || (await bounded(sdk.signInAnonymously(auth))).user;
    assertIdentity(context);
    let token = await bounded(user.getIdToken());
    assertIdentity(context);
    // An existing immutable session can belong to a previously selected account. Rotate only this
    // dedicated anonymous identity; never delete or mutate the legacy callback application's session.
    const session = await request(context, `callbackSessions/${user.uid}`, token);
    if (!session.ok) throw serverError(session.status);
    if (session.data && (session.data.userUid !== context.uid || session.data.accessKey !== context.accessKey)) {
      await bounded(sdk.signOut(auth));
      assertIdentity(context);
      user = (await bounded(sdk.signInAnonymously(auth))).user;
      assertIdentity(context);
      token = await bounded(user.getIdToken());
    }
    const claimed = await request(context, `callbackSessions/${user.uid}`, token, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userUid: context.uid, accessKey: context.accessKey, createdAt: Date.now(), device: 'presence-paper-sheets-v1' }),
    });
    if (!claimed.ok) throw serverError(claimed.status);
    assertIdentity(context);
    activeAuth = auth;
    activeUser = user;
    return user;
  }
  async function ensure(context) {
    assertIdentity(context);
    if (!ready || readySignature !== context.signature || (activeAuth && activeAuth.currentUser?.uid !== activeUser?.uid)) {
      readySignature = context.signature;
      const attempt = authenticate(context);
      ready = attempt;
      attempt.catch(() => { if (ready === attempt) ready = null; });
    }
    const user = await ready;
    assertIdentity(context);
    return user;
  }
  async function authenticated(context, path, options) {
    const user = await ensure(context);
    let token = await bounded(user.getIdToken());
    assertIdentity(context);
    let response = await request(context, path, token, options);
    if (response.status === 401) {
      token = await bounded(user.getIdToken(true));
      assertIdentity(context);
      response = await request(context, path, token, options);
    }
    if (!response.ok && response.status !== 412) throw serverError(response.status);
    return response;
  }
  function path(context, id = '') {
    if (!validUid(context.uid) || (id && !/^[A-Za-z0-9_-]{1,180}$/.test(id))) throw new Error('기록 ID가 올바르지 않아요.');
    return `callbacksheets/${context.uid}/_paperSheets${id ? `/${id}` : ''}`;
  }
  return {
    async readAll(context) {
      const response = await authenticated(context, path(context));
      if (!response.data) return {};
      if (typeof response.data !== 'object' || Array.isArray(response.data)) return response.data;
      return Object.fromEntries(Object.entries(response.data).map(([id, document]) => [id, decodeDocument(document)]));
    },
    async read(id, context) {
      const response = await authenticated(context, path(context, id), { headers: { 'X-Firebase-ETag': 'true' } });
      return { ...response, data: decodeDocument(response.data) };
    },
    async write(id, value, etag, context) {
      if (!etag) throw new Error('서버 기록 버전을 확인할 수 없어 덮어쓰지 않았어요.');
      return authenticated(context, path(context, id), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': etag, 'X-Firebase-ETag': 'true' }, body: JSON.stringify(encodeDocument(value)) });
    },
  };
}
