import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const runtime = process.env.CODEX_NODE_RUNTIME || '/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(`${process.env.CALLBACK_QA_URL || 'http://127.0.0.1:8768'}/callback/sheets/sheet-model.js`);
  const report = await page.evaluate(async () => {
    const { createSheetStorage } = await import('/callback/sheets/storage.js');
    const { createCloudClient, readAccountIdentity } = await import('/callback/sheets/cloud.js');
    const { createSheet } = await import('/callback/sheets/sheet-model.js');
    const checks = [];
    function check(condition, message) { if (!condition) throw new Error(message); checks.push(message); }
    const guest = { namespace: 'guest', uid: '', name: '', accessKey: '', signature: 'guest' };
    const alice = { namespace: 'user:qa-alice', uid: 'qa-alice', name: 'QA', accessKey: 'mock-key', signature: 'qa-alice-key' };
    const bob = { namespace: 'user:qa-bob', uid: 'qa-bob', name: 'QA2', accessKey: 'mock-key2', signature: 'qa-bob-key' };
    let identity = guest;
    let writes = 0, failCloud = false, beforeWrite = null;
    const remote = new Map();
    const copy = v => JSON.parse(JSON.stringify(v));
    const cloud = {
      async readAll(ctx) { if (failCloud) throw new Error('mock offline'); return copy(Object.fromEntries([...remote].filter(([key]) => key.startsWith(ctx.uid + '/')).map(([key, value]) => [key.split('/')[1], value]))); },
      async read(id, ctx) { if (failCloud) throw new Error('mock offline'); const value = remote.get(ctx.uid + '/' + id) || null; return { ok: true, status: 200, data: copy(value), etag: value?.revision || 'null_etag' }; },
      async write(id, value, etag, ctx) {
        if (failCloud) throw new Error('mock offline');
        if (beforeWrite) { const action = beforeWrite; beforeWrite = null; await action(); }
        const key = ctx.uid + '/' + id;
        if ((remote.get(key)?.revision || 'null_etag') !== etag) return { ok: false, status: 412 };
        writes++; remote.set(key, copy(value)); return { ok: true, status: 200 };
      },
    };
    const dbName = `qa-paper-storage-${crypto.randomUUID()}`;
    const options = { dbName, readIdentity: () => identity, cloud, eventTarget: null, broadcast: null };
    const store = createSheetStorage(options);
    let first = createSheet(); first.meta.name = '이름 <script>는 텍스트'; first.rows[0].contact = 7;
    let saved = await store.saveSheet(first);
    check(saved.localSaved && !saved.cloudSaved && writes === 0, 'guest save is durable without cloud upload');
    first = saved.sheet;
    const other = await store.saveSheet(createSheet());
    check((await store.loadSheets()).length === 2 && other.sheet.id !== first.id, 'same-date records retain independent IDs');
    const stale = copy(first);
    first.meta.theme = '새 수정'; saved = await store.saveSheet(first); first = saved.sheet;
    stale.meta.theme = '다른 탭 수정';
    const forked = await store.saveSheet(stale);
    check(forked.conflict && forked.sheet.id !== first.id && (await store.loadSheets()).length === 3, 'stale local tab preserves edit as a new sheet');
    await store.saveDraft(first);
    check((await createSheetStorage(options).loadDraft()).rows[0].contact === 7, 'draft survives a new storage instance');
    identity = alice;
    check((await store.loadSheets()).length === 0 && await store.loadDraft() === null, 'account namespaces isolate archives and drafts');
    let guarded = false;
    try { await store.saveSheet(first, { owner: 'guest' }); } catch (error) { guarded = error.name === 'IdentityChangedError'; }
    check(guarded, 'old editor owner cannot write into a newly selected account');
    await store.syncSheets();
    check(writes === 0, 'connecting an account never uploads guest records');
    let accountSheet = (await store.saveSheet(createSheet())).sheet;
    check(remote.has(alice.uid + '/' + accountSheet.id) && store.getStorageStatus().mode === 'connected', 'authenticated explicit save is acknowledged by cloud');
    failCloud = true; accountSheet.rows[0].close = 3;
    saved = await store.saveSheet(accountSheet); accountSheet = saved.sheet;
    check(saved.localSaved && !saved.cloudSaved && saved.status.pending === 1, 'cloud failure keeps successful local save and pending status');
    failCloud = false;
    const remoteKey = alice.uid + '/' + accountSheet.id;
    remote.get(remoteKey).revision = crypto.randomUUID();
    remote.get(remoteKey).sheet.meta.theme = '다른 기기의 변경';
    await store.syncSheets();
    const merged = await store.loadSheets();
    check(merged.length === 2 && merged.find(s => s.id === accountSheet.id).meta.theme === '다른 기기의 변경' && merged.some(s => s.id !== accountSheet.id && s.rows[0].close === 3), 'remote edit conflict retains server version and offline copy');
    const copiedSheet = merged.find(s => s.id !== accountSheet.id);
    await store.deleteSheet(copiedSheet.id);
    check(remote.get(alice.uid + '/' + copiedSheet.id).deleted && (await store.loadSheets()).length === 1, 'deletion persists a tombstone and hides deleted sheet');
    const resurrect = await store.saveSheet(copiedSheet);
    check(resurrect.sheet.id !== copiedSheet.id && remote.get(alice.uid + '/' + copiedSheet.id).deleted, 'stale edits do not resurrect a deleted ID');
    accountSheet = (await store.loadSheets()).find(s => s.id === accountSheet.id);
    beforeWrite = async () => { remote.get(remoteKey).revision = crypto.randomUUID(); remote.get(remoteKey).sheet.meta.theme = 'ETag 경쟁'; };
    accountSheet.meta.theme = '동시 저장';
    const race = await store.saveSheet(accountSheet);
    check(race.conflict && remote.get(remoteKey).sheet.meta.theme === 'ETag 경쟁', 'ETag 412 does not overwrite a concurrent remote save');
    const originalReadAll = cloud.readAll;
    cloud.readAll = async ctx => { const response = await originalReadAll(ctx); identity = bob; return response; };
    let switchRejected = false;
    try { await store.syncSheets(); } catch (error) { switchRejected = error.name === 'IdentityChangedError'; }
    cloud.readAll = originalReadAll;
    check(switchRejected && (await store.loadSheets()).length === 0, 'account switch during cloud response cannot leak records into another namespace');
    const badIdb = { open() { throw new DOMException('full', 'QuotaExceededError'); } };
    const failing = createSheetStorage({ ...options, indexedDB: badIdb });
    let quota = false;
    try { await failing.saveSheet(createSheet()); } catch (error) { quota = error.message.includes('저장 공간'); }
    check(quota, 'quota failures reject save instead of reporting false success');
    const kv = new Map([['fcos_hub_identity', JSON.stringify({ uid: 'admin', name: 'fake' })]]);
    const local = { getItem: key => kv.get(key) || null };
    check(readAccountIdentity(local).namespace === 'guest', 'identity without personal access key stays local');
    kv.set('fcos_callback_access_key', 'key'); kv.set('fcos_hub_identity', JSON.stringify({ uid: '../admin' }));
    check(readAccountIdentity(local).namespace === 'guest', 'path-injection account IDs are rejected');

    const canvas = window.document.createElement('canvas'); canvas.width = 40; canvas.height = 60;
    const pen = canvas.getContext('2d'); pen.fillStyle = '#faf5e9'; pen.fillRect(0, 0, 40, 60); pen.fillStyle = '#253040'; pen.fillText('QA', 5, 20);
    const photo = createSheet(); photo.id = 'photo-' + 'a'.repeat(64);
    photo.source = { type: 'photo', imageDataUrl: canvas.toDataURL('image/png'), filename: 'synthetic-qa.png', notes: 'Synthetic fixture; no personal photo', duplicateCount: 0, dateBasis: 'written' };
    identity = guest;
    const photoStore = createSheetStorage({ ...options, dbName: dbName + '-photo' });
    const original = await photoStore.saveSheet(photo, { importOriginal: true });
    let transcribed = original.sheet; transcribed.rows[0].contact = 22; transcribed.meta.theme = 'User transcription';
    transcribed = (await photoStore.saveSheet(transcribed)).sheet;
    const reimport = await photoStore.saveSheet(photo, { importOriginal: true });
    check(reimport.skipped && reimport.sheet.rows[0].contact === 22 && reimport.sheet.updatedAt === transcribed.updatedAt && (await photoStore.loadSheets()).length === 1, 'reimported photo preserves typed edits and does not create a fork');
    const collision = copy(photo); pen.fillStyle = 'red'; pen.fillRect(0, 0, 20, 20); collision.source.imageDataUrl = canvas.toDataURL('image/png');
    let rejectedCollision = false;
    try { await photoStore.saveSheet(collision, { importOriginal: true }); } catch (error) { rejectedCollision = error.name === 'PhotoImportConflictError' && error.message.includes('다른 사진'); }
    check(rejectedCollision && (await photoStore.loadSheets())[0].rows[0].contact === 22, 'same photo ID with different image bytes fails clearly without modifying existing record');
    await photoStore.deleteSheet(photo.id);
    const deletedImport = await photoStore.saveSheet(photo, { importOriginal: true });
    check(deletedImport.skipped && deletedImport.deleted && (await photoStore.loadSheets()).length === 0, 'reimport does not resurrect an intentionally deleted photo');
    identity = alice;
    const remotePhoto = copy(photo); remotePhoto.rows[0].close = 33;
    remote.set(alice.uid + '/' + photo.id, { version: 1, revision: crypto.randomUUID(), deleted: false, updatedAt: remotePhoto.updatedAt, sheet: remotePhoto });
    const fresh = createSheetStorage({ ...options, dbName: dbName + '-fresh-photo' });
    const remoteReimport = await fresh.saveSheet(photo, { importOriginal: true });
    check(remoteReimport.skipped && remoteReimport.sheet.rows[0].close === 33 && (await fresh.loadSheets()).filter(s => s.id === photo.id).length === 1, 'fresh-browser photo import preserves existing remote transcriptions');
    const racePhoto = copy(photo); racePhoto.id = 'photo-' + 'b'.repeat(64);
    beforeWrite = async () => { const latest = copy(racePhoto); latest.rows[0].stop = 44; remote.set(alice.uid + '/' + racePhoto.id, { version: 1, revision: crypto.randomUUID(), deleted: false, updatedAt: latest.updatedAt, sheet: latest }); };
    const photoRace = await fresh.saveSheet(racePhoto, { importOriginal: true });
    check(photoRace.skipped && !photoRace.conflict && photoRace.sheet.rows[0].stop === 44, 'concurrent same-original ETag import keeps remote edits without creating a duplicate');

    // Exercise cloud auth and RTDB's actual wire format without sending network requests.
    identity = alice;
    const calls = [], wire = new Map(); let authReady = false, anonymousSignins = 0;
    const user = { uid: 'auth-paper-qa', getIdToken: async () => 'mock-token' };
    const auth = { currentUser: null, async authStateReady() { authReady = true; this.currentUser = user; } };
    const sdk = { getApp: () => ({}), initializeApp: () => ({}), getAuth: () => auth, browserLocalPersistence: 'local', setPersistence: async () => {}, signOut: async () => { auth.currentUser = null; }, signInAnonymously: async () => { anonymousSignins++; if (!authReady) throw new Error('auth race'); auth.currentUser = user; return { user }; } };
    const client = createCloudClient({ readIdentity: () => identity, loadFirebase: async () => sdk, fetchImpl: async (url, config) => {
      const path = new URL(url).pathname;
      calls.push({ path, method: config.method || 'GET' });
      if (config.method === 'PUT') wire.set(path, JSON.parse(config.body));
      const result = wire.get(path) || null;
      return new Response(JSON.stringify(result), { status: 200, headers: { ETag: 'qa-etag' } });
    } });
    const wireSheet = createSheet();
    const document = { version: 1, revision: crypto.randomUUID(), deleted: false, updatedAt: wireSheet.updatedAt, sheet: wireSheet };
    await client.write(wireSheet.id, document, 'null_etag', alice);
    const decoded = await client.read(wireSheet.id, alice);
    check(authReady && anonymousSignins === 0, 'Firebase persisted auth settles before considering anonymous sign-in');
    check(typeof [...wire.values()].find(v => v.sheetJson)?.sheetJson === 'string' && decoded.data.sheet.rows[0].contact === null, 'cloud wire preserves null numeric cells through sheetJson');
    check(calls.every(call => call.path.startsWith('/callbackSessions/auth-paper-qa') || call.path.startsWith('/callbacksheets/qa-alice/_paperSheets/')), 'cloud only accesses own dedicated auth session and private paper archive');
    check(!calls.some(call => call.method === 'DELETE'), 'cloud never mutates or deletes legacy callback sessions');
    let noEtag = false;
    try { await client.write(wireSheet.id, document, null, alice); } catch { noEtag = true; }
    check(noEtag, 'missing ETag cannot trigger an unconditional overwrite');
    return checks;
  });
  assert.ok(report.length >= 20);
  console.log(JSON.stringify({ passed: report.length, checks: report }, null, 2));
} finally { await browser.close(); }
