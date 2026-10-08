import { validateSheet } from '../sheets/sheet-model.js?v=20261009-transcription1';

const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(value);
function validDocument(value, id) {
  return validId(id) && value?.version === 1 && typeof value.revision === 'string' && value.revision.length > 0 && typeof value.deleted === 'boolean' && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) && (value.deleted || (value.sheet?.id === id && validateSheet(value.sheet).valid));
}

// Read-only display merge. Never write a paper document, draft, or deletion marker.
export function mergeAnalysisSources(localRows, remote = null) {
  if (remote !== null && (typeof remote !== 'object' || Array.isArray(remote))) throw new Error('서버의 기록 형식을 확인할 수 없어요.');
  const local = new Map(), selected = new Map(); let invalid = 0, remoteRecords = 0;
  for (const row of localRows) {
    if (!validDocument(row.document, row.id)) { invalid++; continue; }
    local.set(row.id, row);
    if (!row.document.deleted) selected.set(row.id, row.document.sheet);
  }
  for (const [id, document] of Object.entries(remote || {})) {
    if (!validDocument(document, id)) { invalid++; continue; }
    if (document.deleted) { selected.delete(id); continue; }
    remoteRecords++;
    const pending = local.get(id);
    if (pending?.pending) {
      if (pending.document.deleted) { selected.delete(id); continue; }
      // Preserve locally saved edits; an untouched photo transcription can still be read
      // from the server without mutating the pending document or allocating hourly values.
      const sheet = pending.document.sheet, source = document.sheet.source;
      if (source?.transcription && sheet.source?.type === 'photo' && !sheet.source.transcription && source.imageDataUrl === sheet.source.imageDataUrl && source.filename === sheet.source.filename) selected.set(id, { ...sheet, source: { ...sheet.source, transcription: source.transcription } });
      continue;
    }
    selected.set(id, document.sheet);
  }
  return { records: [...selected.values()], remoteRecords, pending: [...local.values()].filter(row => row.pending).length, invalid };
}

export async function readLocalAnalysisRows(identity, idb = globalThis.indexedDB) {
  if (!idb) throw new Error('이 브라우저의 저장소를 사용할 수 없어요.');
  return new Promise((resolve, reject) => {
    const open = idb.open('presence-paper-sheets-v1'); let absent = false;
    open.onupgradeneeded = () => { absent = true; open.transaction.abort(); };
    open.onerror = () => absent ? resolve([]) : reject(new Error('이 브라우저의 기록을 읽지 못했어요.'));
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('records')) { db.close(); resolve([]); return; }
      const tx = db.transaction('records', 'readonly'), get = tx.objectStore('records').index('namespace').getAll(identity.namespace);
      get.onsuccess = () => { const rows = get.result; db.close(); resolve(rows); };
      get.onerror = () => { db.close(); reject(new Error('이 브라우저의 기록을 읽지 못했어요.')); };
    };
  });
}
