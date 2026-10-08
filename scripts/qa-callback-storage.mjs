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
    let writes = 0, archiveReads = 0, failCloud = false, beforeWrite = null;
    const remote = new Map();
    const copy = v => JSON.parse(JSON.stringify(v));
    const cloud = {
      async readAll(ctx) { archiveReads++; if (failCloud) throw new Error('mock offline'); return copy(Object.fromEntries([...remote].filter(([key]) => key.startsWith(ctx.uid + '/')).map(([key, value]) => [key.split('/')[1], value]))); },
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
    archiveReads = 0;
    await store.syncSheets();
    check(writes === 0, 'connecting an account never uploads guest records');
    check(archiveReads === 1, 'clean account sync downloads the archive only once');
    archiveReads = 0;
    let accountSheet = (await store.saveSheet(createSheet())).sheet;
    check(remote.has(alice.uid + '/' + accountSheet.id) && store.getStorageStatus().mode === 'connected', 'authenticated explicit save is acknowledged by cloud');
    check(archiveReads === 2, 'pending save retains the final archive reconciliation after upload');
    failCloud = true; accountSheet.rows[0].close = 3;
    saved = await store.saveSheet(accountSheet); accountSheet = saved.sheet;
    check(saved.localSaved && !saved.cloudSaved && saved.status.pending === 1, 'cloud failure keeps successful local save and pending status');
    failCloud = false;
    const remoteKey = alice.uid + '/' + accountSheet.id;
    remote.get(remoteKey).revision = crypto.randomUUID();
    remote.get(remoteKey).sheet.meta.theme = '다른 기기의 변경';
    archiveReads = 0;
    await store.syncSheets();
    const merged = await store.loadSheets();
    check(merged.length === 2 && merged.find(s => s.id === accountSheet.id).meta.theme === '다른 기기의 변경' && merged.some(s => s.id !== accountSheet.id && s.rows[0].close === 3), 'remote edit conflict retains server version and offline copy');
    check(archiveReads === 2, 'conflicting pending edits retain both archive reads and reconcile forked records');
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

    let cleanReads = 0, cleanFails = false;
    const cleanDocument = { version: 1, revision: crypto.randomUUID(), deleted: false, updatedAt: photo.updatedAt, sheet: copy(photo) };
    const readOnlyCloud = {
      async readAll() { cleanReads++; if (cleanFails) throw new Error('mock timeout'); return { [photo.id]: copy(cleanDocument) }; },
      async read() { throw new Error('clean sync must not request individual uploads'); },
      async write() { throw new Error('clean sync must not write'); },
    };
    const readOnlyStore = createSheetStorage({ ...options, dbName: dbName + '-read-only', cloud: readOnlyCloud });
    await readOnlyStore.syncSheets();
    const cleanPhoto = (await readOnlyStore.loadSheets())[0];
    check(cleanReads === 1 && cleanPhoto.source.imageDataUrl === photo.source.imageDataUrl && readOnlyStore.getStorageStatus().pending === 0, 'fresh-device read-only sync keeps the complete original photo after one archive download');
    cleanFails = true;
    await readOnlyStore.syncSheets();
    check(readOnlyStore.getStorageStatus().phase === 'error' && (await readOnlyStore.loadSheets())[0].source.imageDataUrl === photo.source.imageDataUrl, 'failed clean sync leaves the previously downloaded original photo intact');
    cleanFails = false;
    cleanDocument.deleted = true; delete cleanDocument.sheet;
    cleanDocument.revision = crypto.randomUUID(); cleanDocument.updatedAt = new Date(Date.now() + 1000).toISOString();
    cleanReads = 0;
    await readOnlyStore.syncSheets();
    check(cleanReads === 1 && (await readOnlyStore.loadSheets()).length === 0, 'one-pass clean sync also applies remote tombstones without resurrecting deleted photos');

    // Calendar backfill may add a verified count, but never overwrite transcriptions or known counts.
    identity = guest;
    const countsStore = createSheetStorage({ ...options, dbName: dbName + '-photo-counts' });
    const countOriginal = copy(photo); countOriginal.id = 'photo-' + 'c'.repeat(64); countOriginal.source.donorCount = null;
    let countSaved = await countsStore.saveSheet(countOriginal, { importOriginal: true });
    countSaved.sheet.rows[0].contact = 61; countSaved.sheet.review.pitch.good = '기존 수기 전사 유지';
    countSaved = await countsStore.saveSheet(countSaved.sheet);
    const withCount = copy(countOriginal); withCount.source.donorCount = 3; withCount.rows[0].contact = 999;
    const localFilled = await countsStore.saveSheet(withCount, { importOriginal: true });
    check(localFilled.metadataFilled && localFilled.sheet.source.donorCount === 3 && localFilled.sheet.rows[0].contact === 61 && localFilled.sheet.review.pitch.good === '기존 수기 전사 유지' && (await countsStore.loadSheets()).length === 1, 'photo count fills only missing local metadata and preserves edited rows/reviews without duplicates');
    withCount.source.donorCount = 9;
    const knownLocal = await countsStore.saveSheet(withCount, { importOriginal: true });
    check(knownLocal.skipped && knownLocal.sheet.source.donorCount === 3, 'reimport cannot replace an already known local photo count');
    await countsStore.deleteSheet(countOriginal.id);
    check((await countsStore.saveSheet(withCount, { importOriginal: true })).deleted && (await countsStore.loadSheets()).length === 0, 'count backfill cannot resurrect a local photo tombstone');

    identity = alice;
    const countCloud = createSheetStorage({ ...options, dbName: dbName + '-cloud-photo-counts' });
    function remoteCountPhoto(letter, count) {
      const sheet = copy(photo); sheet.id = 'photo-' + letter.repeat(64); sheet.rows[0].contact = 72; sheet.review.loa.good = '서버에서 작성한 내용';
      if (count !== undefined) sheet.source.donorCount = count;
      remote.set(alice.uid + '/' + sheet.id, { version: 1, revision: crypto.randomUUID(), deleted: false, updatedAt: sheet.updatedAt, sheet });
      const incoming = copy(sheet); incoming.rows[0].contact = 999; incoming.review.loa.good = '가져온 파일의 오래된 내용'; incoming.source.donorCount = 7;
      return incoming;
    }
    const cloudCountInput = remoteCountPhoto('d');
    const cloudFilled = await countCloud.saveSheet(cloudCountInput, { importOriginal: true });
    check(cloudFilled.cloudSaved && cloudFilled.metadataFilled && !cloudFilled.conflict && cloudFilled.sheet.source.donorCount === 7 && cloudFilled.sheet.rows[0].contact === 72 && cloudFilled.sheet.review.loa.good === '서버에서 작성한 내용', 'fresh-browser count backfill preserves all existing remote transcriptions');
    const knownZeroInput = remoteCountPhoto('e', 0);
    const zeroPreserved = await countCloud.saveSheet(knownZeroInput, { importOriginal: true });
    check(zeroPreserved.skipped && zeroPreserved.sheet.source.donorCount === 0, 'known remote zero is authoritative and is never replaced by imported count');
    const raceCountInput = remoteCountPhoto('f');
    beforeWrite = async () => { const value = copy(remote.get(alice.uid + '/' + raceCountInput.id)); value.revision = crypto.randomUUID(); value.sheet.rows[0].stop = 88; remote.set(alice.uid + '/' + raceCountInput.id, value); };
    const raceCountFilled = await countCloud.saveSheet(raceCountInput, { importOriginal: true });
    check(raceCountFilled.cloudSaved && !raceCountFilled.conflict && raceCountFilled.sheet.source.donorCount === 7 && raceCountFilled.sheet.rows[0].stop === 88 && (await countCloud.loadSheets()).filter(s => s.id === raceCountInput.id).length === 1, 'ETag-racing count backfill retries against newest remote edits without forking');
    const raceKnownCount = remoteCountPhoto('h');
    beforeWrite = async () => { const value = copy(remote.get(alice.uid + '/' + raceKnownCount.id)); value.revision = crypto.randomUUID(); value.sheet.source.donorCount = 0; remote.set(alice.uid + '/' + raceKnownCount.id, value); };
    const wonKnownCount = await countCloud.saveSheet(raceKnownCount, { importOriginal: true });
    check(wonKnownCount.sheet.source.donorCount === 0 && !wonKnownCount.conflict, 'a concurrently verified count wins over backfill after ETag retry');
    const raceDeletedCount = remoteCountPhoto('i');
    beforeWrite = async () => { remote.set(alice.uid + '/' + raceDeletedCount.id, { version: 1, revision: crypto.randomUUID(), deleted: true, updatedAt: new Date().toISOString() }); };
    const wonDeletedCount = await countCloud.saveSheet(raceDeletedCount, { importOriginal: true });
    check(wonDeletedCount.deleted && !wonDeletedCount.conflict && !(await countCloud.loadSheets()).some(s => s.id === raceDeletedCount.id), 'a concurrent remote tombstone stops count backfill without resurrection or fork');
    const pendingCountInput = remoteCountPhoto('g');
    let pendingCountSaved = await countCloud.saveSheet({ ...copy(pendingCountInput), source: { ...copy(pendingCountInput.source), donorCount: null } }, { importOriginal: true });
    pendingCountSaved.sheet.rows[0].close = 83;
    await countCloud.saveSheet(pendingCountSaved.sheet, { deferSync: true });
    await countCloud.saveSheet(pendingCountInput, { importOriginal: true, deferSync: true });
    await countCloud.syncSheets();
    const pendingCountRemote = remote.get(alice.uid + '/' + pendingCountInput.id).sheet;
    check(pendingCountRemote.rows[0].close === 83 && pendingCountRemote.source.donorCount === 7 && (await countCloud.loadSheets()).filter(s => s.id === pendingCountInput.id).length === 1, 'count backfill also retains already pending local edits and safely rebases its metadata-only write');
    await countCloud.deleteSheet(cloudCountInput.id);
    const remoteDeletedCount = await countCloud.saveSheet(cloudCountInput, { importOriginal: true });
    check(remoteDeletedCount.deleted && remote.get(alice.uid + '/' + cloudCountInput.id).deleted, 'synced imported photos can be deleted and count reimport does not resurrect them');

    // Repeat OCR imports fill only empty metadata, including across server races.
    const transcript = () => ({ version: 1, status: 'partial', totals: { contact: 31, stop: 17, presentation: 13, close: 13, rehash: 0 }, goals: { contact: 50, stop: 25, presentation: 16, close: 16, rehash: 3 }, review: { loa: { good: '전환율 좋음', bad: '' }, pitch: { good: '', bad: '질문 후 경청하기' }, attitude: { good: '밝게 인사함', bad: '' } }, notes: '검수된 구간만 포함' });
    identity = guest;
    const textStore = createSheetStorage({ ...options, dbName: dbName + '-photo-text' });
    const textPhoto = copy(photo); textPhoto.id = 'photo-text-local';
    let textSaved = await textStore.saveSheet(textPhoto, { importOriginal: true });
    textSaved.sheet.rows[0].contact = 62; textSaved.sheet.review.pitch.bad = '직접 입력한 개선점';
    await textStore.saveSheet(textSaved.sheet);
    const incomingText = copy(textPhoto); incomingText.source.transcription = transcript(); incomingText.source.donorCount = 4;
    const textFilled = await textStore.saveSheet(incomingText, { importOriginal: true });
    check(textFilled.metadataFilled && textFilled.sheet.source.transcription.totals.rehash === 0 && textFilled.sheet.rows[0].contact === 62 && textFilled.sheet.review.pitch.bad === '직접 입력한 개선점' && (await textStore.loadSheets()).length === 1, 'OCR enrichment preserves manual rows and review while adding verified zero without duplicates');
    const textAgain = copy(incomingText); textAgain.source.transcription.totals.rehash = 8; textAgain.source.transcription.review.pitch.bad = '가져온 다른 문장'; textAgain.source.donorCount = 9;
    const unchangedText = await textStore.saveSheet(textAgain, { importOriginal: true });
    check(unchangedText.skipped && unchangedText.sheet.source.transcription.totals.rehash === 0 && unchangedText.sheet.source.transcription.review.pitch.bad === '질문 후 경청하기' && unchangedText.sheet.source.donorCount === 4, 'repeat OCR preserves known zero, existing transcription text and donor metadata');
    textAgain.source.transcription.review.loa.bad = '빈 칸에 추가 검수 내용';
    const completedText = await textStore.saveSheet(textAgain, { importOriginal: true });
    check(completedText.metadataFilled && completedText.sheet.source.transcription.review.loa.bad === '빈 칸에 추가 검수 내용' && completedText.sheet.source.transcription.status === 'partial' && completedText.sheet.source.transcription.notes === '검수된 구간만 포함', 'incremental OCR fills missing review only without upgrading its existing verification status');
    await textStore.deleteSheet(textPhoto.id);
    check((await textStore.saveSheet(incomingText, { importOriginal: true })).deleted && (await textStore.loadSheets()).length === 0, 'OCR cannot resurrect a deleted local photo');

    identity = alice;
    const textCloud = createSheetStorage({ ...options, dbName: dbName + '-cloud-photo-text' });
    const remoteTextInput = remoteCountPhoto('t'); delete remoteTextInput.source.donorCount;
    const existingText = transcript(); existingText.totals.contact = 0; existingText.totals.stop = null; existingText.review.pitch.bad = '서버에서 검수한 문장'; existingText.review.attitude.good = '';
    remote.get(alice.uid + '/' + remoteTextInput.id).sheet.source.transcription = existingText;
    remoteTextInput.source.transcription = transcript();
    const cloudTextFilled = await textCloud.saveSheet(remoteTextInput, { importOriginal: true });
    check(cloudTextFilled.cloudSaved && cloudTextFilled.metadataFilled && cloudTextFilled.sheet.source.transcription.totals.contact === 0 && cloudTextFilled.sheet.source.transcription.totals.stop === 17 && cloudTextFilled.sheet.source.transcription.review.pitch.bad === '서버에서 검수한 문장' && cloudTextFilled.sheet.source.transcription.review.attitude.good === '밝게 인사함' && cloudTextFilled.sheet.rows[0].contact === 72 && cloudTextFilled.sheet.review.loa.good === '서버에서 작성한 내용', 'remote OCR merge fills null cells but preserves remote known zeros, review and editable fields');
    const raceTextInput = remoteCountPhoto('u'); delete raceTextInput.source.donorCount; raceTextInput.source.transcription = transcript();
    beforeWrite = async () => { const latest = copy(remote.get(alice.uid + '/' + raceTextInput.id)); latest.revision = crypto.randomUUID(); latest.sheet.source.transcription = transcript(); latest.sheet.source.transcription.totals.contact = 0; latest.sheet.source.transcription.totals.stop = null; latest.sheet.source.transcription.review.pitch.bad = '동시 검수한 문장'; latest.sheet.rows[0].close = 87; remote.set(alice.uid + '/' + raceTextInput.id, latest); };
    const racedText = await textCloud.saveSheet(raceTextInput, { importOriginal: true });
    check(racedText.cloudSaved && !racedText.conflict && racedText.sheet.source.transcription.totals.contact === 0 && racedText.sheet.source.transcription.totals.stop === 17 && racedText.sheet.source.transcription.review.pitch.bad === '동시 검수한 문장' && racedText.sheet.rows[0].close === 87 && (await textCloud.loadSheets()).filter(s => s.id === raceTextInput.id).length === 1, 'ETag retry preserves concurrent OCR edits and fills only still-missing values without a fork');
    const deletedTextInput = remoteCountPhoto('v'); deletedTextInput.source.transcription = transcript();
    beforeWrite = async () => { remote.set(alice.uid + '/' + deletedTextInput.id, { version: 1, revision: crypto.randomUUID(), deleted: true, updatedAt: new Date().toISOString() }); };
    const deletedTextResult = await textCloud.saveSheet(deletedTextInput, { importOriginal: true });
    check(deletedTextResult.deleted && !deletedTextResult.conflict && !(await textCloud.loadSheets()).some(s => s.id === deletedTextInput.id), 'a concurrent server deletion cancels OCR enrichment without resurrection');
    const pendingTextInput = remoteCountPhoto('w'); delete pendingTextInput.source.donorCount;
    const pendingTextSaved = await textCloud.saveSheet(pendingTextInput, { importOriginal: true });
    pendingTextSaved.sheet.rows[0].close = 86; pendingTextSaved.sheet.review.attitude.bad = '동기화 대기 중 직접 작성';
    await textCloud.saveSheet(pendingTextSaved.sheet, { deferSync: true });
    pendingTextInput.source.transcription = transcript();
    await textCloud.saveSheet(pendingTextInput, { importOriginal: true, deferSync: true });
    await textCloud.syncSheets();
    const pendingTextRemote = remote.get(alice.uid + '/' + pendingTextInput.id).sheet;
    check(pendingTextRemote.rows[0].close === 86 && pendingTextRemote.review.attitude.bad === '동기화 대기 중 직접 작성' && pendingTextRemote.source.transcription.totals.contact === 31 && (await textCloud.loadSheets()).filter(s => s.id === pendingTextInput.id).length === 1, 'OCR enrichment rebases safely while retaining already-pending manual edits');

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

    const savedCredentials = new Map([
      ['fcos_hub_identity', JSON.stringify({ uid: alice.uid, name: alice.name })],
      ['fcos_callback_access_key', 'old-mock-key'],
      ['fcos_personal_launch_v2', JSON.stringify({ u: alice.uid, n: alice.name, k: 'new-mock-key' })],
    ]);
    const credentialStorage = { getItem: key => savedCredentials.get(key) || null };
    const remembered = readAccountIdentity(credentialStorage);
    check(remembered.uid === alice.uid && remembered.accessKey === 'old-mock-key' && remembered.fallbackAccessKey === 'new-mock-key', 'same-account remembered launch is an explicit fallback without replacing active identity');
    savedCredentials.set('fcos_personal_launch_v2', JSON.stringify({ u: bob.uid, n: bob.name, k: 'bob-only-key' }));
    check(!readAccountIdentity(credentialStorage).fallbackAccessKey, 'a different account remembered launch can never supply a fallback key');
    savedCredentials.delete('fcos_callback_access_key');
    check(readAccountIdentity(credentialStorage).namespace === 'guest', 'missing active key cannot adopt another account remembered launch');
    savedCredentials.set('fcos_personal_launch_v2', JSON.stringify({ u: alice.uid, n: alice.name, k: 'new-mock-key' }));
    check(readAccountIdentity(credentialStorage).accessKey === 'new-mock-key', 'missing key recovers only from an exact same-account remembered launch');

    function authFixture() {
      let fresh = 0, forced = 0;
      const makeUser = () => ({ uid: `paper-auth-${fresh}`, getIdToken: async force => { if (force) forced++; return force ? 'fresh-mock-token' : 'cached-mock-token'; } });
      const auth = { currentUser: makeUser(), async authStateReady() {} };
      return { auth, forced: () => forced, sdk: { getApp: () => ({}), initializeApp: () => ({}), getAuth: () => auth, browserLocalPersistence: 'local', setPersistence: async () => {}, signOut: async () => { auth.currentUser = null; }, signInAnonymously: async () => { fresh++; auth.currentUser = makeUser(); return { user: auth.currentUser }; } } };
    }
    const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ETag: 'test-etag' } });
    const matching = { userUid: alice.uid, accessKey: alice.accessKey, createdAt: 1 };
    const scheduledDelays = [], originalSetTimeout = globalThis.setTimeout;
    const slowFixture = authFixture();
    const archiveClient = createCloudClient({ readIdentity: () => alice, loadFirebase: async () => slowFixture.sdk, fetchImpl: async url => jsonResponse(new URL(url).pathname.startsWith('/callbackSessions/') ? matching : {}) });
    try {
      globalThis.setTimeout = (callback, delay, ...args) => { scheduledDelays.push(delay); return originalSetTimeout(callback, delay, ...args); };
      await archiveClient.readAll(alice);
    } finally { globalThis.setTimeout = originalSetTimeout; }
    check(scheduledDelays.length >= 2 && scheduledDelays.every(delay => delay === 45000), 'default archive client allows 45 seconds for session setup and archive transfer');
    const timeoutFixture = authFixture(); let timeoutMessage = '';
    const timeoutClient = createCloudClient({ readIdentity: () => alice, timeoutMs: 5, loadFirebase: async () => timeoutFixture.sdk, fetchImpl: (url, config) => new URL(url).pathname.startsWith('/callbackSessions/')
      ? Promise.resolve(jsonResponse(matching))
      : new Promise((resolve, reject) => config.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })) });
    try { await timeoutClient.readAll(alice); } catch (error) { timeoutMessage = error.message; }
    check(timeoutMessage.includes('연결 시간이 초과') && timeoutMessage.includes('기록은 유지'), 'bounded transfer timeout aborts the request and truthfully preserves local records');
    let sessionGets = 0, matchingPuts = 0;
    const expired = authFixture();
    const expiredClient = createCloudClient({ readIdentity: () => alice, loadFirebase: async () => expired.sdk, fetchImpl: async (url, opts) => {
      if (new URL(url).pathname.startsWith('/callbackSessions/')) {
        if (opts.method === 'PUT') { matchingPuts++; return jsonResponse({}, 403); }
        sessionGets++; return sessionGets === 1 ? jsonResponse({ error: 'expired test token' }, 401) : jsonResponse(matching);
      }
      return jsonResponse({});
    } });
    await expiredClient.readAll(alice);
    check(sessionGets === 2 && expired.forced() === 1, 'initial session lookup retries a 401 once with a refreshed Firebase token');
    check(matchingPuts === 0, 'matching persisted callback session is reused without re-registering or mutating it');

    const claimExpired = authFixture(); let claimPuts = 0;
    const claimRetryClient = createCloudClient({ readIdentity: () => alice, loadFirebase: async () => claimExpired.sdk, fetchImpl: async (url, opts) => {
      if (!new URL(url).pathname.startsWith('/callbackSessions/')) return jsonResponse({});
      if (opts.method !== 'PUT') return jsonResponse(null);
      claimPuts++; return claimPuts === 1 ? jsonResponse({}, 401) : jsonResponse({});
    } });
    await claimRetryClient.readAll(alice);
    check(claimPuts === 2 && claimExpired.forced() === 1, 'initial session registration retries a 401 once with a refreshed token');

    const recoveryIdentity = { ...remembered };
    for (const existingOldSession of [false, true]) {
      const recovery = authFixture(), sessions = new Map();
      if (existingOldSession) sessions.set(recovery.auth.currentUser.uid, { userUid: recoveryIdentity.uid, accessKey: recoveryIdentity.accessKey });
      const registrations = []; let deletes = 0;
      const recoveryClient = createCloudClient({ readIdentity: () => recoveryIdentity, loadFirebase: async () => recovery.sdk, fetchImpl: async (url, opts) => {
        const path = new URL(url).pathname;
        if (opts.method === 'DELETE') deletes++;
        if (path.startsWith('/callbackSessions/')) {
          const uid = path.split('/').at(-1).replace(/\.json$/, '');
          if (opts.method !== 'PUT') return jsonResponse(sessions.get(uid) || null);
          const value = JSON.parse(opts.body); registrations.push(value);
          if (value.accessKey !== 'new-mock-key') return jsonResponse({}, 403);
          sessions.set(uid, value); return jsonResponse(value);
        }
        const active = sessions.get(recovery.auth.currentUser.uid);
        return active?.accessKey === 'new-mock-key' ? jsonResponse({}) : jsonResponse({}, 403);
      } });
      await recoveryClient.readAll(recoveryIdentity);
      check(deletes === 0 && registrations.every(value => value.userUid === alice.uid) && registrations.at(-1)?.accessKey === 'new-mock-key', existingOldSession
        ? 'revoked matching session recovers with same-account remembered key without deleting old sessions'
        : 'rejected old key recovers with only the same-account remembered key');
    }
    const deniedFixture = authFixture(); let deniedRequests = 0, deniedMessage = '';
    const deniedClient = createCloudClient({ readIdentity: () => alice, loadFirebase: async () => deniedFixture.sdk, fetchImpl: async () => { deniedRequests++; return jsonResponse({ error: 'mock-token mock-key should not be surfaced' }, 401); } });
    try { await deniedClient.readAll(alice); } catch (error) { deniedMessage = error.message; }
    check(deniedRequests === 2 && deniedMessage.includes('세션 조회') && deniedMessage.includes('401') && !deniedMessage.includes('mock-key') && !deniedMessage.includes('mock-token'), 'auth failure has bounded retries and sanitized phase/status without credentials or server body');
    return checks;
  });
  assert.ok(report.length >= 20);
  console.log(JSON.stringify({ passed: report.length, checks: report }, null, 2));
} finally { await browser.close(); }
