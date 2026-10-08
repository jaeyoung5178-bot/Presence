import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSheet, validateSheet } from '../callback/sheets/sheet-model.js';
import { createCloudClient } from '../callback/sheets/cloud.js';
import { analyze, filterAuthor, uniqueRecords } from '../callback/analysis/analysis-model.js';
import { mergeAnalysisSources, mergeAnalysisProjections } from '../callback/analysis/analysis-sources.js';
import { ANALYSIS_INDEX_KEY, projectCanonicalDocuments, projectLocalAnalysisRows, projectAnalysisRecord, createAnalysisIndex, decodeAnalysisIndex, validateAnalysisRecord } from '../callback/analysis/analysis-projection.js';

const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const copy = value => structuredClone(value);
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lU8AAAAASUVORK5CYII=';
const identity = { uid: 'index-qa', namespace: 'user:index-qa', name: 'QA', accessKey: 'synthetic-only', signature: 'index-qa-key' };
function sheet(id, date = '2024-05-01') { const value = createSheet(new Date(`${date}T12:00:00Z`)); value.id = id; value.meta.name = '재영'; return value; }
function doc(value, deleted = false) { return { version: 1, revision: `rev-${value.id}`, updatedAt: value.updatedAt, deleted, ...(deleted ? {} : { sheet: value }) }; }
function wire(documents) { return Object.fromEntries(Object.entries(documents).map(([id, document]) => { const { sheet, ...rest } = document; return [id, sheet ? { ...rest, sheetJson: JSON.stringify(sheet) } : rest]; })); }
const manual = sheet('manual'); Object.assign(manual.rows[0], { contact: 7, stop: 3, presentation: 0, close: null, rehash: 0 }); manual.review.pitch.bad = '질문 후 경청하기';
const photo = sheet('photo', '2024-05-02');
photo.source = { type: 'photo', imageDataUrl: png, filename: 'synthetic.png', duplicateCount: 1, notes: '', dateBasis: 'capture', donorCount: 8, transcription: { version: 1, status: 'partial', totals: { contact: 40, stop: 20, presentation: null, close: 0, rehash: null }, review: { loa: { good: '기회량을 유지', bad: '' }, pitch: { good: '', bad: '설명을 짧게' }, attitude: { good: '끝까지 인사', bad: '' } } } };
const duplicate = copy(photo); duplicate.id = 'photo-duplicate'; duplicate.updatedAt = '2024-05-03T12:00:00.000Z';
const deleted = sheet('deleted');
const canonical = { manual: doc(manual), photo: doc(photo), 'photo-duplicate': doc(duplicate), deleted: doc(deleted, true) };
const original = JSON.stringify(canonical), projected = await projectCanonicalDocuments(wire(canonical));
check('all canonical documents, including tombstones, are projected', projected.invalid === 0 && Object.keys(projected.documents).length === 4 && projected.documents.deleted.deleted);
check('projection removes original image bytes and retains null/zero/date/review', !JSON.stringify(projected).includes('imageDataUrl') && projected.documents.photo.analysisRecord.source.transcription.totals.rehash === null && projected.documents.photo.analysisRecord.source.dateBasis === 'capture' && projected.documents.manual.analysisRecord.rows[0].presentation === 0);
check('digest is over the exact UTF8 data URL string', projected.documents.photo.analysisRecord.source.imageDigest === 'sha256-data-url-utf8:' + createHash('sha256').update(png).digest('hex'));
check('original source is unchanged and photo DTO cannot validate as a writable original', JSON.stringify(canonical) === original && !validateSheet(projected.documents.photo.analysisRecord).valid);
check('DTO validator rejects original image payload and malformed source digest', !validateAnalysisRecord({ ...projected.documents.photo.analysisRecord, source: { ...projected.documents.photo.analysisRecord.source, imageDataUrl: png } }) && !validateAnalysisRecord({ ...projected.documents.photo.analysisRecord, source: { ...projected.documents.photo.analysisRecord.source, imageDigest: '' } }));
const index = createAnalysisIndex(projected.documents, { uid: identity.uid, sourceEtag: '"source-v1"' });
check('sidecar round-trip preserves documentsJson nulls without original sheet fields', JSON.stringify(decodeAnalysisIndex(index, identity)) === JSON.stringify(projected.documents) && !Object.values(projected.documents).some(value => 'sheet' in value));
for (const mutate of [i => i.version++, i => i.sourcePath = 'callbacksheets/other/_paperSheets', i => i.sourceEtag = '', i => i.documentCount++, i => i.documentsJson = '{}', i => i.documentsJson = '{', i => i.documentsJson = JSON.stringify({ broken: {} }), i => i.documentsJson = JSON.stringify({ manual: { ...projected.documents.manual, revision: '../invalid' } })]) {
  const invalid = copy(index); mutate(invalid); check('invalid/foreign/mismatched index rejected', (() => { try { decodeAnalysisIndex(invalid, identity); return false; } catch { return true; } })());
}
const fullRecords = Object.values(canonical).filter(value => !value.deleted).map(value => value.sheet), dtoRecords = Object.values(projected.documents).filter(value => !value.deleted).map(value => value.analysisRecord);
for (const period of ['week', 'month', 'quarter', 'half', 'year']) for (const author of ['*', 'name:임재영', 'unknown']) check(`full/DTO analysis equal: ${period}/${author}`, JSON.stringify(analyze(filterAuthor(fullRecords, author), '2024-05-02', period)) === JSON.stringify(analyze(filterAuthor(dtoRecords, author), '2024-05-02', period)));
check('same-photo DTOs deduplicate while preserving original latest-first semantics', uniqueRecords(dtoRecords).length === uniqueRecords(fullRecords).length && uniqueRecords(dtoRecords).find(value => value.source).id === 'photo-duplicate');

const pending = copy(manual); pending.rows[0].contact = 2;
for (const [name, localRows, remote] of [
  ['pending edit', [{ id: manual.id, pending: true, document: doc(pending) }], canonical],
  ['local tombstone', [{ id: manual.id, pending: true, document: doc(manual, true) }], canonical],
  ['server tombstone', [{ id: deleted.id, pending: true, document: doc(deleted) }], canonical],
  ['local-only', [{ id: manual.id, pending: false, document: doc(manual) }], {}],
]) {
  const local = await projectLocalAnalysisRows(localRows), remoteProjection = await projectCanonicalDocuments(remote);
  const expected = mergeAnalysisSources(localRows, remote), actual = mergeAnalysisProjections(local, remoteProjection);
  check(`${name} merge preserves prior results`, JSON.stringify(analyze(expected.records, '2024-05-02')) === JSON.stringify(analyze(actual.records, '2024-05-02')) && expected.pending === actual.pending && expected.remoteRecords === actual.remoteRecords);
}
const localPhoto = copy(photo); delete localPhoto.source.transcription; localPhoto.rows[0].contact = 5;
const localPhotoRows = [{ id: photo.id, pending: true, document: doc(localPhoto) }];
const same = mergeAnalysisProjections(await projectLocalAnalysisRows(localPhotoRows), await projectCanonicalDocuments({ photo: doc(photo) }));
check('same filename and computed digest may fill missing transcription without replacing manual rows', same.records[0].source.transcription.totals.contact === 40 && same.records[0].rows[0].contact === 5 && !localPhoto.source.transcription);
const different = copy(photo); different.source.imageDataUrl = png.replace('mP8/', 'mP9/');
const mismatch = mergeAnalysisProjections(await projectLocalAnalysisRows(localPhotoRows), await projectCanonicalDocuments({ photo: doc(different) }));
check('same filename but different image bytes never merge transcription', !mismatch.records[0].source.transcription);
const mixed = mergeAnalysisProjections(await projectLocalAnalysisRows([{ id: duplicate.id, pending: true, document: doc(duplicate) }]), await projectCanonicalDocuments({ photo: doc(photo) }));
check('local originals and remote DTOs share one digest dedupe key', uniqueRecords(mixed.records).length === 1);

function fixture(options = {}) {
  let who = identity, indexValue = options.index === undefined ? copy(index) : copy(options.index), indexEtag = '"index-v1"', sourceValue = wire(canonical), sourceEtag = '"source-v1"';
  const calls = []; let fullBytes = 0;
  const user = { uid: 'analysis-index-session', getIdToken: async () => 'synthetic-token' }, auth = { currentUser: user, authStateReady: async () => {} };
  const sdk = { getApp: () => ({}), initializeApp: () => ({}), getAuth: () => auth, setPersistence: async () => {}, browserLocalPersistence: {}, signInAnonymously: async () => ({ user }), signOut: async () => {} };
  const client = createCloudClient({ readIdentity: () => who, loadFirebase: async () => sdk, timeoutMs: 50, fetchImpl: async (url, request) => {
    const path = new URL(url).pathname, method = request.method || 'GET'; calls.push({ path, method, headers: request.headers || {} });
    const response = (data, status = 200, etag = null) => new Response(status === 304 ? null : JSON.stringify(data), { status, headers: etag ? { ETag: etag } : {} });
    if (path.startsWith('/callbackSessions/')) return response({ userUid: who.uid, accessKey: who.accessKey });
    if (path.endsWith(`/${ANALYSIS_INDEX_KEY}.json`)) {
      if (options.indexNetwork) throw new TypeError('synthetic offline');
      if (options.indexDenied) return response({}, 403);
      if (method === 'PUT') {
        if (options.putGate) await options.putGate;
        if (options.putFail) return response({}, options.putFail);
        if (request.headers['If-Match'] !== indexEtag) return response({}, 412);
        indexValue = JSON.parse(request.body); indexEtag = '"index-v2"'; return response(indexValue, 200, indexEtag);
      }
      if (options.switchOnIndex) who = { ...identity, uid: 'other', namespace: 'user:other', signature: 'other' };
      return response(indexValue, 200, options.noIndexEtag ? null : indexEtag);
    }
    assert.ok(path.endsWith('/_paperSheets.json'), 'no other paper endpoint accessed');
    assert.equal(method, 'GET', 'canonical originals are read-only');
    if (options.sourceNetwork) throw new TypeError('synthetic offline');
    if (options.sourceTimeout) return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
    if (options.sourceDenied) return response({}, options.sourceDenied);
    if (options.badJson) return new Response('{', { status: 200 });
    if (options.switchOnSource) who = { ...identity, uid: 'other', namespace: 'user:other', signature: 'other' };
    if (request.headers['If-None-Match'] && options.unsupported) return response({}, options.unsupported);
    if (options.unexpected304 || request.headers['If-None-Match'] === sourceEtag) return response(null, 304, sourceEtag);
    fullBytes += JSON.stringify(sourceValue).length; return response(sourceValue, 200, options.noSourceEtag ? null : sourceEtag);
  } });
  return { client, calls, bytes: () => fullBytes, index: () => indexValue, changeSource: value => { sourceValue = wire(value); sourceEtag = '"source-v2"'; }, changeIdentity: () => { who = { ...identity, uid: 'other', namespace: 'user:other', signature: 'other' }; } };
}
const cold = fixture({ index: null }); const coldResult = await cold.client.readAnalysisSnapshot(identity); await coldResult.cacheUpdate;
check('cold path reads original exactly once and creates only sibling index with CAS', coldResult.source === 'canonical' && cold.calls.filter(c => c.path.endsWith('/_paperSheets.json')).length === 1 && cold.calls.filter(c => c.method === 'PUT').length === 1 && cold.calls.find(c => c.method === 'PUT').path.endsWith(`/${ANALYSIS_INDEX_KEY}.json`) && !!cold.calls.find(c => c.method === 'PUT').headers['If-Match']);
const coldBytes = cold.bytes(), warmResult = await cold.client.readAnalysisSnapshot(identity);
check('warm 304 trusts validated index without downloading any original body', warmResult.source === 'index' && cold.bytes() === coldBytes && cold.calls.filter(c => c.method === 'PUT').length === 1 && cold.calls.at(-1).headers['If-None-Match'] === '"source-v1"');
const changed = copy(canonical); changed.manual.sheet.rows[0].contact = 0; changed.manual.revision = 'changed'; delete changed['photo-duplicate']; changed.photo.deleted = true; delete changed.photo.sheet;
const stale = fixture(); stale.changeSource(changed); const current = await stale.client.readAnalysisSnapshot(identity); await current.cacheUpdate;
check('stale index uses conditional200 body once including old-client edits and deletions', current.source === 'canonical' && current.documents.manual.analysisRecord.rows[0].contact === 0 && current.documents.photo.deleted && !current.documents['photo-duplicate'] && stale.calls.filter(c => c.path.endsWith('/_paperSheets.json')).length === 1);
check('cache ETag is from exactly the canonical body response', stale.index().sourceEtag === '"source-v2"' && JSON.parse(stale.index().documentsJson).manual.revision === 'changed');
for (const opts of [{ index: null }, { index: {} }, { index: { ...index, sourcePath: 'callbacksheets/other/_paperSheets' } }, { index: { ...index, documentCount: 999 } }, { indexNetwork: true }, { indexDenied: true }]) {
  const value = fixture(opts), result = await value.client.readAnalysisSnapshot(identity); await result.cacheUpdate;
  check('unavailable or invalid index falls back to canonical data once', result.source === 'canonical' && value.calls.filter(c => c.path.endsWith('/_paperSheets.json')).length === 1);
}
for (const status of [400, 405, 501]) { const value = fixture({ unsupported: status }), result = await value.client.readAnalysisSnapshot(identity); await result.cacheUpdate; check(`unsupported conditionalGET ${status} has ordinary fallback`, result.source === 'canonical' && value.calls.filter(c => c.path.endsWith('/_paperSheets.json')).length === 2); }
for (const opts of [{ sourceDenied: 401 }, { sourceDenied: 403 }, { sourceNetwork: true }, { sourceTimeout: true }, { badJson: true }, { index: null, unexpected304: true }, { switchOnIndex: true }, { switchOnSource: true }]) {
  const value = fixture(opts); let rejected = false; try { await value.client.readAnalysisSnapshot(identity); } catch { rejected = true; }
  check('unverified/auth/network/malformed/account-switched response never returns stale index', rejected && value.calls.every(c => c.method === 'GET'));
}
for (const opts of [{ index: null, noSourceEtag: true }, { index: null, noIndexEtag: true }, { index: null, putFail: 403 }, { index: null, putFail: 412 }]) {
  const value = fixture(opts), result = await value.client.readAnalysisSnapshot(identity), update = await result.cacheUpdate;
  check('cache publication failure or missing ETag cannot fail current canonical analysis', result.source === 'canonical' && result.documents.manual.analysisRecord.rows[0].contact === 7 && !update.saved && value.calls.filter(c => c.method === 'PUT').length <= 1);
}
let release; const putGate = new Promise(resolve => { release = resolve; }); const late = fixture({ index: null, putGate });
const lateResult = await late.client.readAnalysisSnapshot(identity); check('analysis display does not wait for cache publication', lateResult.source === 'canonical'); late.changeIdentity(); release(); check('account change prevents late cache response from confirming another account', !(await lateResult.cacheUpdate).saved && late.calls.every(c => !c.path.includes('/other/')));
const badCanonical = fixture({ index: null }); badCanonical.changeSource({ ...canonical, malformed: { version: 1 } }); const partial = await badCanonical.client.readAnalysisSnapshot(identity); await partial.cacheUpdate;
check('malformed canonical record is reported and prevents publishing an incomplete index', partial.invalid === 1 && partial.documents.manual && !badCanonical.calls.some(c => c.method === 'PUT'));
const ordinary = fixture({ unexpected304: true }); let writerRejected = false; try { await ordinary.client.readAll(identity); } catch { writerRejected = true; } check('ordinary writer readAll does not accept analysis-only304', writerRejected);

if (process.env.CANONICAL_ANALYSIS_FIXTURE) {
  const raw = JSON.parse(await fs.readFile(process.env.CANONICAL_ANALYSIS_FIXTURE, 'utf8')), source = Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, value.sheetJson ? { ...value, sheet: JSON.parse(value.sheetJson) } : value]));
  const result = await projectCanonicalDocuments(raw); check('actual archive has no invalid documents', result.invalid === 0);
  const originals = Object.values(source).filter(value => !value.deleted).map(value => value.sheet), projectedRecords = Object.values(result.documents).filter(value => !value.deleted).map(value => value.analysisRecord), anchor = originals.map(value => value.date).sort().at(-1);
  const authorKeys = [...new Set(['*', 'name:임재영', 'unknown', ...originals.map(value => 'name:' + value.meta.name)])];
  for (const period of ['week', 'month', 'quarter', 'half', 'year']) for (const author of authorKeys) check(`actual archive full/DTO equality: ${period}/${author === '*' ? 'all' : 'author'}`, JSON.stringify(analyze(filterAuthor(originals, author), anchor, period)) === JSON.stringify(analyze(filterAuthor(projectedRecords, author), anchor, period)));
  console.log(JSON.stringify({ actualDocuments: Object.keys(raw).length, originalBytes: Buffer.byteLength(JSON.stringify(raw)), projectedBytes: Buffer.byteLength(JSON.stringify(result.documents)) }));
}
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
