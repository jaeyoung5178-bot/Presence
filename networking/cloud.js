import { auth, firebase } from '../recruiting/store.js?v=20261025-1';
export { auth };
const DATABASE = 'https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app';
const safeKey = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
function decode(id, document) {
  if (!safeKey(id) || !Number.isInteger(document?.revision) || document.revision < 1 || typeof document.deleted !== 'boolean') throw Error('기록 버전을 확인해주세요.');
  if (document.deleted) return null;
  const record = JSON.parse(document.recordJson);
  if (!record || record.id !== id || !['mine','team'].includes(record.scope) || typeof record.title !== 'string' || typeof record.owner !== 'string' || typeof record.date !== 'string' || !Number.isInteger(record.count) || !Number.isInteger(record.duration)) throw Error('기록 형식을 확인해주세요.');
  ['photos','captures'].forEach(key => { if (!Array.isArray(record[key]) || record[key].length > 40) throw Error('사진 목록을 확인해주세요.'); record[key] = record[key].map(image => { if (!safeKey(image?.id) || typeof image.name !== 'string' || typeof image.thumb !== 'string' || image.thumb.length > 40000 || (image.thumb && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image.thumb))) throw Error('사진 정보를 확인해주세요.'); return {id:image.id,name:image.name,thumb:image.thumb}; }); });
  if (record.photos.length + record.captures.length > 40) throw Error('사진 개수를 확인해주세요.');
  return {...record,revision:document.revision};
}
export class ConflictError extends Error { constructor() { super('다른 기기에서 이 기록이 바뀌었어요. 작성 내용을 유지했으니 최신 기록을 확인해주세요.'); this.name = 'ConflictError'; } }

/* Dependency injection keeps tests completely isolated from production Firebase. */
export async function createNetworkingCloud(user, onData, onState, { getFirebase = firebase, fetchImpl = (...args) => fetch(...args), timeoutMs = 20000, online = () => navigator.onLine } = {}) {
  if (!safeKey(user?.uid)) throw Error('계정을 확인해주세요.');
  const f = await getFirebase(), root = `userPreferences/${user.uid}/networkingArchive`;
  let stopped = false;
  const photoCache = new Map();
  const assertAccount = async () => {
    if (stopped || !f.auth.currentUser) throw Error('로그인이 만료됐어요. 다시 로그인해주세요.');
    if (!online()) throw Error('인터넷 연결을 확인해주세요. 아직 서버에 저장되지 않았어요.');
    let timer; const snapshot = await Promise.race([f.d.get(f.d.ref(f.db,`authSessions/${f.auth.currentUser.uid}`)),new Promise((_,reject) => { timer = setTimeout(() => reject(Error('계정 연결 시간이 초과됐어요. 다시 시도해주세요.')),timeoutMs); })]).finally(() => clearTimeout(timer));
    if (stopped || snapshot.val()?.userUid !== user.uid) throw Error('연결 계정이 바뀌었어요. 다시 로그인해주세요.');
  };
  async function request(path, options = {}, retry = true) {
    if (stopped || !f.auth.currentUser) throw Error('로그인이 만료됐어요. 다시 로그인해주세요.');
    if (!online()) throw Error('인터넷 연결을 확인해주세요. 아직 서버에 저장되지 않았어요.');
    const authUid = f.auth.currentUser.uid, token = await f.auth.currentUser.getIdToken(!retry), controller = new AbortController();
    if (stopped || f.auth.currentUser?.uid !== authUid) throw Error('연결 계정이 바뀌었어요.');
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${DATABASE}/${path}.json?auth=${encodeURIComponent(token)}`,{ cache:'no-store', ...options, signal:controller.signal });
      if (stopped) throw Error('연결 계정이 바뀌었어요.');
      if (response.status === 401 && retry) return request(path, options, false);
      if (!response.ok && response.status !== 412) throw Error(response.status === 401 || response.status === 403 ? '계정 접근 권한을 확인해주세요. 다시 로그인해주세요.' : '서버에 연결하지 못했어요. 작성 내용은 유지돼요.');
      const value = await response.json();
      if (stopped || f.auth.currentUser?.uid !== authUid) throw Error('연결 계정이 바뀌었어요.');
      return { ok:response.ok,status:response.status,value,etag:response.headers.get('ETag') };
    } finally { clearTimeout(timer); }
  }
  const stopRecords = f.d.onValue(f.d.ref(f.db,`${root}/records`),snapshot => {
    if (stopped) return;
    const values = [];
    try { Object.entries(snapshot.val() || {}).forEach(([id,document]) => { const record = decode(id,document); if (record) values.push(record); }); onData(values); onState('ready','사진과 기록이 계정에 연결됐어요.'); }
    catch { onState('error','일부 서버 기록을 읽지 못했어요. 백업 후 다시 확인해주세요.'); }
  },() => { if (!stopped) onState('error','연결을 확인하지 못했어요. 다시 로그인해주세요.'); });
  const stopConnected = f.d.onValue(f.d.ref(f.db,'.info/connected'),snapshot => { if (!stopped) onState(snapshot.val() ? 'connected' : 'offline',snapshot.val() ? '서버에 연결됐어요.' : '연결 확인 중 · 저장 전 인터넷 연결을 확인해주세요.'); });
  const stopSession = f.d.onValue(f.d.ref(f.db,`authSessions/${f.auth.currentUser.uid}`),snapshot => { if (!stopped && snapshot.val()?.userUid !== user.uid) onState('signedout','연결 계정이 바뀌었어요. 다시 로그인해주세요.'); },() => { if (!stopped) onState('signedout','계정 연결이 만료됐어요. 다시 로그인해주세요.'); });
  const stopAuth = f.h?.onAuthStateChanged?.(f.auth,account => { if (!stopped && !account) onState('signedout','로그아웃됐어요. 다시 로그인해주세요.'); }) || (() => {});
  async function writeRecord(id, record, expected, deleted = false) {
    if (!safeKey(id)) throw Error('기록 ID를 확인해주세요.');
    await assertAccount();
    const path = `${root}/records/${id}`, before = await request(path,{headers:{'X-Firebase-ETag':'true'}});
    if (!before.etag) throw Error('서버의 최신 버전을 확인하지 못했어요. 연결 후 다시 시도해주세요.');
    if (Number(before.value?.revision || 0) !== expected || (!deleted && before.value?.deleted)) throw new ConflictError();
    const operationId = crypto.randomUUID(), document = { revision:expected+1, deleted, updatedAt:Date.now(), operationId };
    if (!deleted) document.recordJson = JSON.stringify(record);
    let result;
    try { result = await request(path,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':before.etag},body:JSON.stringify(document)}); }
    catch (error) {
      try { const latest = await request(path); if (latest.value?.operationId === operationId) return { ...record, revision:expected+1 }; } catch {}
      throw Error('서버 저장 여부를 확인하지 못했어요. 작성 내용은 유지했으니 연결 후 최신 기록을 확인해주세요.');
    }
    if (result.status === 412) throw new ConflictError();
    return { ...record,revision:expected+1 };
  }
  return {
    async photo(id) { if (!safeKey(id)) throw Error('사진 ID를 확인해주세요.'); if (photoCache.has(id)) return photoCache.get(id); const result = await request(`${root}/photos/${id}`); if (typeof result.value?.src !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(result.value.src)) throw Error('사진을 불러오지 못했어요.'); photoCache.set(id,result.value.src); return result.value.src; },
    async uploadPhoto(image) { if (!safeKey(image.id) || typeof image.src !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image.src) || image.src.length > 4*1024*1024) throw Error('사진이 너무 커요. 다른 사진을 선택해주세요.'); await assertAccount(); const result = await request(`${root}/photos/${image.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({src:image.src,name:image.name,createdAt:Date.now()})}); if (!result.ok) throw Error('사진을 저장하지 못했어요.'); photoCache.set(image.id,image.src); return {id:image.id,name:image.name,thumb:image.thumb || ''}; },
    save: (record, expected) => writeRecord(record.id,record,expected),
    remove: (id, expected) => writeRecord(id,null,expected,true),
    async exists(id) { if (!safeKey(id)) throw Error('기록 ID를 확인해주세요.'); return (await request(`${root}/records/${id}`)).value !== null; },
    close() { stopped = true; stopRecords(); stopConnected(); stopSession(); stopAuth(); photoCache.clear(); },
  };
}
