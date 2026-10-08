import { METRICS, CASE_METRICS, MAX_ROWS, validateSheet, validateTranscription, normalizeTranscription, parseObjectionBlocks } from '../sheets/sheet-model.js?v=20261009-transcription1';

export const ANALYSIS_INDEX_FORMAT = 'presence-paper-analysis-index';
export const ANALYSIS_INDEX_VERSION = 1;
export const ANALYSIS_INDEX_KEY = '_paperSheetsAnalysisIndex';
export const validImageDigest = value => typeof value === 'string' && /^sha256-data-url-utf8:[a-f0-9]{64}$/.test(value);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(value);
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const keysOnly = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const text = (value, max = 12000) => typeof value === 'string' && value.length <= max;
const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const count = (value, max = 999) => value === null || (Number.isInteger(value) && value >= 0 && value <= max);
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const time = value => value === '' || (typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
const recordKeys = ['version', 'id', 'date', 'meta', 'processGoals', 'goals', 'rows', 'objections', 'donorObjections', 'review', 'createdAt', 'updatedAt', 'source'];
const sourceKeys = ['type', 'imageDigest', 'filename', 'notes', 'duplicateCount', 'dateBasis', 'donorCount', 'transcription'];
const metaKeys = ['name', 'location', 'team', 'weather', 'theme'];
const reviews = ['loa', 'pitch', 'attitude'];
export const canonicalAnalysisPath = uid => { if (!validId(uid)) throw new Error('분석 계정을 확인할 수 없어요.'); return `callbacksheets/${uid}/_paperSheets`; };
export const validSourceEtag = value => typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/[\r\n]/.test(value);

// This is a read-only DTO validator. A missing photo is never replaced with a fake image
// or passed into the writer's normalize/save APIs to make a summary look like an original.
export function validateAnalysisRecord(record) {
  if (!keysOnly(record, recordKeys) || record.version !== 1 || !validId(record.id) || !day(record.date) || !stamp(record.createdAt) || !stamp(record.updatedAt)) return false;
  if (!keysOnly(record.meta, metaKeys) || !metaKeys.every(key => text(record.meta[key], 500))) return false;
  if (!keysOnly(record.processGoals, CASE_METRICS) || !CASE_METRICS.every(key => text(record.processGoals[key], 300))) return false;
  if (!keysOnly(record.goals, METRICS) || !METRICS.every(key => count(record.goals[key]))) return false;
  if (!Array.isArray(record.rows) || record.rows.length < 1 || record.rows.length > MAX_ROWS) return false;
  const ids = new Set();
  for (const row of record.rows) {
    if (!keysOnly(row, ['id', 'time', 'endTime', ...METRICS, 'donorCases']) || !validId(row.id) || ids.has(row.id) || !time(row.time) || !time(row.endTime) || !METRICS.every(key => count(row[key]))) return false;
    ids.add(row.id);
    if (row.donorCases !== undefined) {
      if (!Array.isArray(row.donorCases) || row.donorCases.length > 100) return false;
      const cases = new Set(), sums = Object.fromEntries(CASE_METRICS.map(key => [key, 0]));
      for (const item of row.donorCases) {
        if (!keysOnly(item, ['id', 'donor', 'counts', 'note']) || !validId(item.id) || cases.has(item.id) || typeof item.donor !== 'boolean' || !text(item.note) || !keysOnly(item.counts, CASE_METRICS)) return false;
        cases.add(item.id);
        for (const key of CASE_METRICS) { if (!Number.isInteger(item.counts[key]) || !count(item.counts[key])) return false; sums[key] += item.counts[key]; }
      }
      if (CASE_METRICS.some(key => sums[key] > (row[key] ?? 0))) return false;
    }
  }
  if (!text(record.objections) || !keysOnly(record.review, reviews) || !reviews.every(key => keysOnly(record.review[key], ['good', 'bad']) && text(record.review[key].good) && text(record.review[key].bad))) return false;
  if (record.donorObjections !== undefined) {
    const blocks = new Set(parseObjectionBlocks(record.objections));
    if (!Array.isArray(record.donorObjections) || record.donorObjections.length > 500 || new Set(record.donorObjections).size !== record.donorObjections.length || !record.donorObjections.every(note => typeof note === 'string' && blocks.has(note))) return false;
  }
  if (record.source !== undefined) {
    const source = record.source;
    if (!keysOnly(source, sourceKeys) || source.type !== 'photo' || !validImageDigest(source.imageDigest)) return false;
    if (!text(source.filename, 255) || !source.filename || /[\\/\x00-\x1f\x7f]/.test(source.filename) || ['.', '..'].includes(source.filename)) return false;
    if (!text(source.notes) || !Number.isInteger(source.duplicateCount) || source.duplicateCount < 0 || source.duplicateCount > 9999 || !['written', 'capture', 'unknown'].includes(source.dateBasis)) return false;
    if (source.donorCount !== undefined && !count(source.donorCount, 99999)) return false;
    if (source.transcription !== undefined) {
      const value = source.transcription;
      if (!keysOnly(value, ['version', 'status', 'totals', 'goals', 'review', 'notes']) || validateTranscription(value).length) return false;
      if (!keysOnly(value.totals, METRICS) || (value.goals !== undefined && !keysOnly(value.goals, METRICS)) || !keysOnly(value.review, reviews) || !reviews.every(key => keysOnly(value.review[key], ['good', 'bad']))) return false;
    }
  }
  return true;
}

function copyCore(sheet) {
  return { version: 1, id: sheet.id, date: sheet.date, meta: Object.fromEntries(metaKeys.map(key => [key, sheet.meta[key]])), processGoals: Object.fromEntries(CASE_METRICS.map(key => [key, sheet.processGoals[key]])), goals: Object.fromEntries(METRICS.map(key => [key, sheet.goals[key]])), rows: sheet.rows.map(row => ({ id: row.id, time: row.time, endTime: row.endTime, ...Object.fromEntries(METRICS.map(key => [key, row[key]])), ...(row.donorCases === undefined ? {} : { donorCases: row.donorCases.map(item => ({ id: item.id, donor: item.donor, counts: Object.fromEntries(CASE_METRICS.map(key => [key, item.counts[key]])), note: item.note })) }) })), objections: sheet.objections, ...(sheet.donorObjections === undefined ? {} : { donorObjections: [...sheet.donorObjections] }), review: Object.fromEntries(reviews.map(key => [key, { good: sheet.review[key].good, bad: sheet.review[key].bad }])), createdAt: sheet.createdAt, updatedAt: sheet.updatedAt };
}
export async function projectAnalysisRecord(sheet) {
  if (!validateSheet(sheet).valid) throw new Error('원본 기록 형식을 확인할 수 없어요.');
  const result = copyCore(sheet);
  if (sheet.source) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sheet.source.imageDataUrl));
    result.source = { ...Object.fromEntries(['type', 'filename', 'notes', 'duplicateCount', 'dateBasis', ...(sheet.source.donorCount === undefined ? [] : ['donorCount'])].map(key => [key, sheet.source[key]])), imageDigest: 'sha256-data-url-utf8:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''), ...(sheet.source.transcription === undefined ? {} : { transcription: normalizeTranscription(sheet.source.transcription) }) };
  }
  return result;
}
export function validAnalysisDocument(document, id) {
  return validId(id) && keysOnly(document, ['version', 'revision', 'updatedAt', 'deleted', 'analysisRecord']) && document.version === 1 && validId(document.revision) && stamp(document.updatedAt) && typeof document.deleted === 'boolean' && (document.deleted ? document.analysisRecord === undefined : document.analysisRecord?.id === id && validateAnalysisRecord(document.analysisRecord));
}
export async function projectCanonicalDocuments(raw) {
  if (raw !== null && !object(raw)) throw new Error('서버의 기록 형식을 확인할 수 없어요.');
  const documents = Object.create(null); let invalid = 0;
  for (const [id, original] of Object.entries(raw || {})) {
    let document = original;
    if (object(original) && typeof original.sheetJson === 'string') { try { document = { ...original, sheet: JSON.parse(original.sheetJson) }; } catch { invalid++; continue; } }
    if (!validId(id) || !object(document) || document.version !== 1 || !validId(document.revision) || !stamp(document.updatedAt) || typeof document.deleted !== 'boolean' || (!document.deleted && (document.sheet?.id !== id || !validateSheet(document.sheet).valid))) { invalid++; continue; }
    documents[id] = { version: 1, revision: document.revision, updatedAt: document.updatedAt, deleted: document.deleted, ...(document.deleted ? {} : { analysisRecord: await projectAnalysisRecord(document.sheet) }) };
  }
  return { documents, invalid };
}
export async function projectLocalAnalysisRows(rows) {
  const projected = []; let invalid = 0;
  for (const row of rows) {
    if (!object(row) || !validId(row.id)) { invalid++; continue; }
    const result = await projectCanonicalDocuments({ [row.id]: row.document }); invalid += result.invalid;
    if (result.documents[row.id]) projected.push({ id: row.id, pending: !!row.pending, document: result.documents[row.id] });
  }
  return { rows: projected, invalid };
}
export function createAnalysisIndex(documents, { uid, sourceEtag, generatedAt = new Date().toISOString() }) {
  if (!object(documents) || !validSourceEtag(sourceEtag) || !stamp(generatedAt) || !Object.entries(documents).every(([id, document]) => validAnalysisDocument(document, id))) throw new Error('검증된 원본으로 분석 요약을 만들 수 없어요.');
  const documentsJson = JSON.stringify(documents);
  if (documentsJson.length > 20 * 1024 * 1024) throw new Error('분석 요약이 커서 원본 기록으로 분석해요.');
  return { format: ANALYSIS_INDEX_FORMAT, version: ANALYSIS_INDEX_VERSION, sourcePath: canonicalAnalysisPath(uid), sourceEtag, documentCount: Object.keys(documents).length, generatedAt, documentsJson };
}
export function decodeAnalysisIndex(value, { uid }) {
  if (!keysOnly(value, ['format', 'version', 'sourcePath', 'sourceEtag', 'documentCount', 'generatedAt', 'documentsJson']) || value.format !== ANALYSIS_INDEX_FORMAT || value.version !== ANALYSIS_INDEX_VERSION || value.sourcePath !== canonicalAnalysisPath(uid) || !validSourceEtag(value.sourceEtag) || !stamp(value.generatedAt) || !Number.isInteger(value.documentCount) || value.documentCount < 0 || typeof value.documentsJson !== 'string' || value.documentsJson.length > 20 * 1024 * 1024) throw new Error('분석 요약의 형식을 확인할 수 없어요.');
  let documents;
  try { documents = JSON.parse(value.documentsJson); } catch { throw new Error('분석 요약을 읽을 수 없어요.'); }
  if (!object(documents) || Object.keys(documents).length !== value.documentCount || !Object.entries(documents).every(([id, document]) => validAnalysisDocument(document, id))) throw new Error('분석 요약의 기록을 확인할 수 없어요.');
  return documents;
}
