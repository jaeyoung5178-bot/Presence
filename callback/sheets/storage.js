import { makeId, normalizeSheet, validateSheet } from './sheet-model.js?v=20261008-calendar1';
import { createCloudClient, IdentityChangedError, readAccountIdentity } from './cloud.js?v=20261008-calendar1';

const DB_NAME = 'presence-paper-sheets-v1';
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(id);
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const recordKey = (namespace, id) => `${namespace}\u0000${id}`;
const nextDate = previous => new Date(Math.max(Date.now(), (Date.parse(previous) || 0) + 1)).toISOString();
const samePhotoOriginal = (a, b) => a?.source?.type === 'photo' && b?.source?.type === 'photo'
  && a.source.imageDataUrl === b.source.imageDataUrl && a.source.filename === b.source.filename;
function fillPhotoDonorCount(existing, incoming) {
  const value = incoming?.source?.donorCount;
  if (!samePhotoOriginal(existing, incoming) || existing.source.donorCount != null
    || !Number.isInteger(value) || value < 0 || value > 99999) return null;
  const sheet = copy(existing);
  sheet.source.donorCount = value;
  return sheet;
}
class PhotoImportConflictError extends Error {
  constructor() { super('이미 있는 원본 사진 ID에 다른 사진 파일이 연결되어 있어 가져오지 않았어요. 기존 기록은 유지돼요.'); this.name = 'PhotoImportConflictError'; }
}
const localError = error => {
  if (error instanceof IdentityChangedError || error instanceof PhotoImportConflictError) return error;
  const wrapped = new Error(error?.name === 'QuotaExceededError'
    ? '브라우저 저장 공간이 부족해 저장하지 못했어요. 사진이나 JSON 백업을 먼저 내려받아 주세요.'
    : '이 브라우저에 저장하지 못했어요. 입력 내용을 유지한 채 다시 시도하거나 JSON으로 백업해 주세요.');
  wrapped.cause = error;
  return wrapped;
};

function validDocument(value, id) {
  return !!value && typeof value === 'object' && value.version === 1 && validId(value.revision)
    && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
    && typeof value.deleted === 'boolean'
    && (value.deleted || (value.sheet?.id === id && validateSheet(value.sheet).valid));
}

// IndexedDB transactions protect individual records and drafts from multi-tab lost updates.
// Guest records stay in their own namespace and are never implicitly uploaded to an account.
export function createSheetStorage({ dbName = DB_NAME, indexedDB: idb = globalThis.indexedDB,
  readIdentity = readAccountIdentity, cloud = createCloudClient({ readIdentity }),
  eventTarget = globalThis.window, broadcast = typeof BroadcastChannel === 'function' ? new BroadcastChannel(dbName) : null,
} = {}) {
  let databasePromise, queue = Promise.resolve(), current = readIdentity();
  let status = { namespace: current.namespace, uid: current.uid, name: current.name, mode: 'local', phase: 'idle', pending: 0, error: '', conflicts: 0,
    message: current.uid ? '계정 연결 확인 중 · 이 브라우저에 먼저 저장해요' : '이 브라우저에 저장 · 기기 간 동기화는 개인 콜백 링크 연결 후 사용할 수 있어요' };
  const listeners = new Set();
  function emit(patch = {}) {
    status = { ...status, ...patch };
    for (const listener of listeners) { try { listener({ ...status }); } catch (error) { console.error('콜백싯 상태 표시 오류', error); } }
  }
  function context(owner) {
    const next = readIdentity();
    if (next.signature !== current.signature) {
      current = next;
      emit({ namespace: next.namespace, uid: next.uid, name: next.name, mode: 'local', phase: 'idle', pending: 0, error: '', conflicts: 0,
        message: next.uid ? '계정이 바뀌었어요. 이 계정의 기록을 불러와 주세요.' : '이 브라우저의 개인 기록을 불러와 주세요.' });
    }
    if (owner !== undefined && owner !== next.namespace) throw new IdentityChangedError();
    return { ...next };
  }
  const assertIdentity = ctx => { if (readIdentity().signature !== ctx.signature) throw new IdentityChangedError(); };
  function changed(ctx) {
    assertIdentity(ctx);
    broadcast?.postMessage({ namespace: ctx.namespace });
    emit({ change: (status.change || 0) + 1 });
  }
  function serialize(work) {
    const result = queue.then(work, work);
    queue = result.catch(() => {});
    return result;
  }
  function openDatabase() {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        if (!idb) { reject(new Error('IndexedDB unavailable')); return; }
        const request = idb.open(dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          const records = db.createObjectStore('records', { keyPath: 'key' });
          records.createIndex('namespace', 'namespace', { unique: false });
          db.createObjectStore('drafts', { keyPath: 'namespace' });
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); databasePromise = null; };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('다른 콜백싯 탭을 닫고 다시 열어주세요.'));
      }).catch(error => { databasePromise = null; throw localError(error); });
    }
    return databasePromise;
  }
  async function transaction(ctx, names, mode, work) {
    const db = await openDatabase();
    assertIdentity(ctx);
    return new Promise((resolve, reject) => {
      let result, failure;
      const tx = db.transaction(names, mode);
      const stores = Object.fromEntries(names.map(name => [name, tx.objectStore(name)]));
      const fail = error => { failure = error; try { tx.abort(); } catch {} };
      tx.oncomplete = () => { try { assertIdentity(ctx); resolve(result); } catch (error) { reject(error); } };
      tx.onerror = () => { failure ||= tx.error; };
      tx.onabort = () => reject(failure instanceof IdentityChangedError ? failure : localError(failure || tx.error));
      const guarded = handler => event => { try { assertIdentity(ctx); handler(event); } catch (error) { fail(error); } };
      try { work(stores, value => { result = value; }, guarded, fail); } catch (error) { fail(error); }
    });
  }
  function allRecords(ctx) {
    return transaction(ctx, ['records'], 'readonly', ({ records }, done, guard) => {
      records.index('namespace').getAll(ctx.namespace).onsuccess = guard(event => done(event.target.result));
    });
  }
  function sheetsFrom(records) {
    return records.filter(row => validDocument(row.document, row.id) && !row.document.deleted).map(row => copy(row.document.sheet))
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  }
  async function refreshCount(ctx, patch = {}) {
    const records = await allRecords(ctx);
    assertIdentity(ctx);
    const malformed = records.some(row => !validDocument(row.document, row.id));
    emit({ pending: records.filter(row => row.pending).length, ...patch,
      ...(malformed ? { error: '읽을 수 없는 기록이 있어 원본을 보존했어요.', message: '일부 기록 형식을 확인할 수 없어요. 기존 데이터는 삭제하지 않았어요.' } : {}) });
    return records;
  }
  function makeRecord(ctx, sheet, previous = null) {
    return { key: recordKey(ctx.namespace, sheet.id), namespace: ctx.namespace, id: sheet.id, pending: true,
      baseRevision: previous?.baseRevision || null,
      document: { version: 1, revision: makeId(), deleted: false, updatedAt: sheet.updatedAt, sheet } };
  }
  async function acknowledge(ctx, submitted) {
    return transaction(ctx, ['records'], 'readwrite', ({ records }, done, guard) => {
      records.get(submitted.key).onsuccess = guard(event => {
        const latest = event.target.result;
        if (!latest) return;
        if (latest.document.revision === submitted.document.revision) {
          latest.pending = false;
          latest.baseRevision = submitted.document.revision;
          latest.originalImport = false;
          delete latest.donorCountFill;
          delete latest.donorCountFillOnly;
          records.put(latest);
        } else if (latest.baseRevision === submitted.baseRevision) {
          // Another tab edited while this request was in flight. Its edit remains pending, based on
          // the version we just successfully wrote, rather than being erased by the acknowledgement.
          latest.baseRevision = submitted.document.revision;
          records.put(latest);
        }
        done(true);
      });
    });
  }
  async function preserveConflict(ctx, submitted, remote) {
    return transaction(ctx, ['records'], 'readwrite', ({ records }, done, guard) => {
      records.get(submitted.key).onsuccess = guard(event => {
        const latest = event.target.result;
        if (!latest || latest.document.revision !== submitted.document.revision) { done(null); return; }
        let fork = null;
        if (!latest.document.deleted) {
          const sheet = { ...copy(latest.document.sheet), id: makeId(), updatedAt: nextDate(latest.document.updatedAt) };
          fork = makeRecord(ctx, sheet);
          fork.document.conflictOf = submitted.id;
          records.put(fork);
        }
        // A remote tombstone always stays deleted. The offline edit is retained as a new sheet.
        const document = remote || { version: 1, revision: makeId(), deleted: true, updatedAt: new Date().toISOString() };
        records.put({ ...latest, document, baseRevision: remote?.revision || null, pending: false });
        done(fork);
      });
    });
  }
  async function acceptExistingOriginal(ctx, submitted, remote, previousRemoteRevision = remote.revision) {
    return transaction(ctx, ['records'], 'readwrite', ({ records }, done, guard) => {
      records.get(submitted.key).onsuccess = guard(event => {
        const latest = event.target.result;
        if (!latest || latest.document.revision !== submitted.document.revision) { done(false); return; }
        if (submitted.donorCountFill !== undefined && !submitted.donorCountFillOnly && !submitted.originalImport) {
          // Preserve edits already waiting locally when metadata import began. Rebase only if
          // our metadata write was the sole intervening server change; real edit conflicts remain.
          if (!remote.deleted && latest.baseRevision === previousRemoteRevision) latest.baseRevision = remote.revision;
          if (!remote.deleted && Number.isInteger(remote.sheet.source?.donorCount)) latest.document.sheet.source.donorCount = remote.sheet.source.donorCount;
          delete latest.donorCountFill;
          delete latest.donorCountFillOnly;
          records.put(latest);
        } else {
          const accepted = { ...latest, document: copy(remote), pending: false, originalImport: false, baseRevision: remote.revision };
          delete accepted.donorCountFill;
          delete accepted.donorCountFillOnly;
          records.put(accepted);
        }
        done(true);
      });
    });
  }
  async function resolvePhotoOriginal(ctx, submitted, initialRemote, skippedOriginals) {
    let remote = initialRemote;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!remote.data) return false;
      if (!validDocument(remote.data, submitted.id)) throw new Error('서버 기록 형식이 달라 덮어쓰지 않았어요.');
      if (!remote.data.deleted && !samePhotoOriginal(submitted.document.sheet, remote.data.sheet)) throw new PhotoImportConflictError();
      const filled = remote.data.deleted ? null : fillPhotoDonorCount(remote.data.sheet, submitted.document.sheet);
      const previousRevision = remote.data.revision;
      let resolved = remote.data;
      if (filled) {
        filled.updatedAt = nextDate(remote.data.updatedAt);
        resolved = { ...copy(remote.data), revision: makeId(), updatedAt: filled.updatedAt, sheet: filled };
        const response = await cloud.write(submitted.id, resolved, remote.etag, ctx);
        assertIdentity(ctx);
        if (!response.ok) {
          if (response.status !== 412) throw new Error('사진의 후원자 수 저장을 확인하지 못했어요. 다시 동기화해 주세요.');
          remote = await cloud.read(submitted.id, ctx);
          assertIdentity(ctx);
          continue;
        }
      }
      if (await acceptExistingOriginal(ctx, submitted, resolved, previousRevision)) {
        if (submitted.originalImport || submitted.donorCountFillOnly) skippedOriginals.set(submitted.id, { ...resolved, metadataFilled: !!filled });
      }
      return true;
    }
    throw new Error('사진 기록이 다른 곳에서 계속 변경되어 후원자 수를 아직 반영하지 않았어요. 기존 기록은 유지돼요.');
  }
  async function mergeRemote(ctx, remote) {
    if (!remote || typeof remote !== 'object' || Array.isArray(remote)) throw new Error('서버 기록 형식이 올바르지 않아 병합하지 않았어요.');
    const entries = Object.entries(remote);
    let malformed = 0;
    await transaction(ctx, ['records'], 'readwrite', ({ records }, done, guard) => {
      for (const [id, document] of entries) {
        if (!validId(id) || !validDocument(document, id)) { malformed++; continue; }
        const key = recordKey(ctx.namespace, id);
        records.get(key).onsuccess = guard(event => {
          const latest = event.target.result;
          if (latest?.pending) return;
          // A different tab can finish a newer write while this network snapshot is in flight.
          // Our document timestamps advance from the previous version, including tombstones.
          if (latest && Date.parse(latest.document.updatedAt) > Date.parse(document.updatedAt)) return;
          records.put({ key, namespace: ctx.namespace, id, document: copy(document), pending: false, baseRevision: document.revision });
        });
      }
      done(true);
    });
    if (malformed) throw new Error('서버의 일부 기록을 읽을 수 없어 해당 원본을 그대로 보존했어요.');
  }
  async function synchronize(ctx) {
    const forks = new Map();
    const skippedOriginals = new Map();
    assertIdentity(ctx);
    if (!ctx.uid) {
      await refreshCount(ctx, { phase: 'idle', mode: 'local', error: '', message: '이 브라우저에 저장 · 개인 콜백 링크 연결 전 기록은 자동 업로드되지 않아요' });
      return { forks, skippedOriginals, cloudSaved: false };
    }
    if (globalThis.navigator?.onLine === false) {
      await refreshCount(ctx, { phase: 'idle', error: '', message: '오프라인 · 이 브라우저에 저장했어요. 연결되면 동기화를 다시 시도해요.' });
      return { forks, skippedOriginals, cloudSaved: false };
    }
    emit({ phase: 'syncing', error: '', message: '계정의 콜백싯을 동기화하고 있어요…' });
    try {
      // Read first to validate the session and ensure the whole archive is readable before any push.
      const initial = await cloud.readAll(ctx);
      assertIdentity(ctx);
      await mergeRemote(ctx, initial);
      let pending = (await allRecords(ctx)).filter(row => row.pending);
      let conflicts = 0;
      // Forks created by conflicts are also uploaded in this pass. Bound work when another tab edits.
      for (let pass = 0; pass < 2 && pending.length; pass++) {
        for (const row of pending) {
          assertIdentity(ctx);
          if (!validDocument(row.document, row.id)) throw new Error('일부 로컬 기록을 읽을 수 없어 원본을 보존했어요.');
          let remote = await cloud.read(row.id, ctx);
          assertIdentity(ctx);
          if (remote.data && !validDocument(remote.data, row.id)) throw new Error('서버 기록 형식이 달라 덮어쓰지 않았어요.');
          if (remote.data?.revision === row.document.revision) { await acknowledge(ctx, row); continue; }
          if (!row.document.deleted && (row.originalImport || row.donorCountFill !== undefined) && remote.data
            && await resolvePhotoOriginal(ctx, row, remote, skippedOriginals)) continue;
          if ((remote.data?.revision || null) === row.baseRevision) {
            const response = await cloud.write(row.id, row.document, remote.etag, ctx);
            assertIdentity(ctx);
            if (response.ok) { await acknowledge(ctx, row); continue; }
            if (response.status !== 412) throw new Error('서버에서 저장을 확인하지 못했어요. 다시 동기화해 주세요.');
            remote = await cloud.read(row.id, ctx);
            assertIdentity(ctx);
            if (remote.data && !validDocument(remote.data, row.id)) throw new Error('서버 기록 형식이 달라 덮어쓰지 않았어요.');
            if (remote.data?.revision === row.document.revision) { await acknowledge(ctx, row); continue; }
            if (!row.document.deleted && (row.originalImport || row.donorCountFill !== undefined) && remote.data
              && await resolvePhotoOriginal(ctx, row, remote, skippedOriginals)) continue;
          }
          const fork = await preserveConflict(ctx, row, remote.data);
          conflicts++;
          if (fork) forks.set(row.id, fork.document.sheet);
        }
        pending = (await allRecords(ctx)).filter(row => row.pending);
      }
      const remote = await cloud.readAll(ctx);
      assertIdentity(ctx);
      await mergeRemote(ctx, remote);
      await refreshCount(ctx, { phase: 'idle', mode: 'connected', error: '', conflicts,
        message: conflicts ? '다른 곳에서 변경된 기록이 있어요. 서버 기록을 유지하고 내 수정본은 별도 기록으로 보존했어요.' : '계정에 동기화했어요 · 다른 기기에서도 같은 개인 콜백 링크로 열 수 있어요' });
      if (status.pending) emit({ message: '이 브라우저에 저장했어요. 아직 동기화할 기록이 남아 있어요.' });
      changed(ctx);
      return { forks, skippedOriginals, cloudSaved: status.pending === 0 };
    } catch (error) {
      if (error instanceof IdentityChangedError) { context(); throw error; }
      await refreshCount(ctx, { phase: 'error', error: error.message, message: `${error.message} 동기화 대기 기록은 이 브라우저에 보관돼요.` });
      return { forks, skippedOriginals, cloudSaved: false };
    }
  }
  const api = {
    getStorageStatus() { context(); return { ...status }; },
    subscribe(listener) { listeners.add(listener); listener({ ...status }); return () => listeners.delete(listener); },
    loadSheets(options = {}) {
      const ctx = context(options.owner);
      return serialize(async () => {
        assertIdentity(ctx);
        emit({ phase: 'loading', error: '' });
        try {
          const records = await refreshCount(ctx, { phase: 'idle' });
          // Render the durable local archive immediately; an explicit/reconnect sync pulls other devices.
          return sheetsFrom(records);
        } catch (error) { emit({ phase: 'error', error: error.message, message: error.message }); throw error; }
      });
    },
    saveSheet(value, options = {}) {
      const ctx = context(options.owner);
      const input = normalizeSheet(value);
      if (!validId(input.id)) return Promise.reject(new Error('기록 ID가 올바르지 않아요.'));
      return serialize(async () => {
        assertIdentity(ctx);
        let conflict = false;
        let sheet;
        let skipped = false, deleted = false, previousPending = false, metadataFilled = false;
        try {
          sheet = await transaction(ctx, ['records'], 'readwrite', ({ records }, done, guard) => {
            records.get(recordKey(ctx.namespace, input.id)).onsuccess = guard(event => {
              let previous = event.target.result;
              if (previous && !validDocument(previous.document, previous.id)) throw new Error('기존 기록을 읽을 수 없어 덮어쓰지 않았어요.');
              if (options.importOriginal && input.source?.type === 'photo' && previous) {
                if (!previous.document.deleted && !samePhotoOriginal(input, previous.document.sheet)) throw new PhotoImportConflictError();
                const filled = previous.document.deleted ? null : fillPhotoDonorCount(previous.document.sheet, input);
                if (filled) {
                  filled.updatedAt = nextDate(previous.document.updatedAt);
                  const record = makeRecord(ctx, filled, previous);
                  record.originalImport = !!previous.originalImport;
                  record.donorCountFill = input.source.donorCount;
                  record.donorCountFillOnly = !previous.pending || !!previous.donorCountFillOnly || !!previous.originalImport;
                  records.put(record);
                  metadataFilled = true;
                  done(filled);
                  return;
                }
                skipped = true;
                deleted = previous.document.deleted;
                previousPending = previous.pending;
                done(copy(previous.document.sheet || input));
                return;
              }
              sheet = copy(input);
              if (previous && (previous.document.deleted || previous.document.sheet.updatedAt !== input.updatedAt)) {
                sheet.id = makeId(); previous = null; conflict = true;
              }
              sheet.updatedAt = nextDate(previous?.document.updatedAt || input.updatedAt);
              const record = makeRecord(ctx, sheet, previous);
              if (options.importOriginal && input.source?.type === 'photo') record.originalImport = true;
              records.put(record);
              done(sheet);
            });
          });
          if (skipped) {
            await refreshCount(ctx, { message: deleted ? '이미 삭제한 사진 기록이라 다시 가져오지 않았어요.' : '이미 있는 원본 사진이에요. 저장된 내용과 수정 사항을 유지했어요.' });
            return { sheet: copy(sheet), localSaved: true, cloudSaved: !!ctx.uid && !previousPending, skipped: true, deleted, conflict: false, status: { ...status } };
          }
          await refreshCount(ctx, { error: '', phase: 'idle', message: '이 브라우저에 저장했어요.' });
          changed(ctx);
        } catch (error) { emit({ phase: 'error', error: error.message, message: error.message }); throw error; }
        const result = options.deferSync ? { forks: new Map(), cloudSaved: false } : await synchronize(ctx);
        const existingOriginal = result.skippedOriginals?.get(sheet.id);
        if (existingOriginal) { skipped = !existingOriginal.metadataFilled; metadataFilled ||= !!existingOriginal.metadataFilled; deleted = existingOriginal.deleted; sheet = copy(existingOriginal.sheet || sheet); }
        if (result.forks.has(sheet.id)) { sheet = result.forks.get(sheet.id); conflict = true; }
        if (conflict) emit({ conflicts: Math.max(status.conflicts, 1), message: '다른 곳에서 변경된 기록이 있어 수정본을 별도 기록으로 보존했어요.' });
        return { sheet: copy(sheet), localSaved: true, cloudSaved: result.cloudSaved, conflict, skipped, deleted, metadataFilled, status: { ...status } };
      });
    },
    deleteSheet(id, options = {}) {
      const ctx = context(options.owner);
      if (!validId(id)) return Promise.reject(new Error('기록 ID가 올바르지 않아요.'));
      return serialize(async () => {
        await transaction(ctx, ['records'], 'readwrite', ({ records }, done, guard) => {
          records.get(recordKey(ctx.namespace, id)).onsuccess = guard(event => {
            const previous = event.target.result;
            if (!previous) { done(false); return; }
            if (!validDocument(previous.document, id)) throw new Error('기존 기록을 읽을 수 없어 삭제하지 않았어요.');
            const updatedAt = nextDate(previous.document.updatedAt);
            records.put({ ...previous, pending: true, document: { version: 1, revision: makeId(), deleted: true, updatedAt } });
            done(true);
          });
        });
        changed(ctx);
        const result = await synchronize(ctx);
        return { localSaved: true, cloudSaved: result.cloudSaved, status: { ...status } };
      });
    },
    loadDraft(options = {}) {
      const ctx = context(options.owner);
      return serialize(() => transaction(ctx, ['drafts'], 'readonly', ({ drafts }, done, guard) => {
        drafts.get(ctx.namespace).onsuccess = guard(event => {
          const row = event.target.result;
          if (row && !validateSheet(row.sheet).valid) throw new Error('작성 중 기록 형식을 확인할 수 없어 원본을 보존했어요.');
          done(row ? copy(row.sheet) : null);
        });
      }));
    },
    saveDraft(value, options = {}) {
      const ctx = context(options.owner), sheet = normalizeSheet(value);
      return serialize(async () => {
        await transaction(ctx, ['drafts'], 'readwrite', ({ drafts }, done) => {
          drafts.put({ namespace: ctx.namespace, sheet, updatedAt: new Date().toISOString() }); done(true);
        });
        assertIdentity(ctx);
        emit({ draftSavedAt: new Date().toISOString() });
        return true;
      });
    },
    clearDraft(options = {}) {
      const ctx = context(options.owner);
      return serialize(() => transaction(ctx, ['drafts'], 'readwrite', ({ drafts }, done) => { drafts.delete(ctx.namespace); done(true); }));
    },
    syncSheets(options = {}) {
      const ctx = context(options.owner);
      return serialize(async () => { await synchronize(ctx); return { ...status }; });
    },
  };
  eventTarget?.addEventListener('storage', event => {
    if (['fcos_hub_identity', 'fcos_callback_access_key', 'fcos_personal_launch_v2', null].includes(event.key)) {
      try { context(); } catch {}
    }
  });
  eventTarget?.addEventListener('focus', () => { context(); });
  eventTarget?.addEventListener('online', () => { api.syncSheets().catch(() => {}); });
  if (broadcast) broadcast.onmessage = event => {
    const ctx = context();
    if (event.data?.namespace === ctx.namespace) emit({ externalChange: (status.externalChange || 0) + 1 });
  };
  return api;
}

const defaultStorage = createSheetStorage();
export const loadSheets = (...args) => defaultStorage.loadSheets(...args);
export const saveSheet = (...args) => defaultStorage.saveSheet(...args);
export const deleteSheet = (...args) => defaultStorage.deleteSheet(...args);
export const loadDraft = (...args) => defaultStorage.loadDraft(...args);
export const saveDraft = (...args) => defaultStorage.saveDraft(...args);
export const clearDraft = (...args) => defaultStorage.clearDraft(...args);
export const syncSheets = (...args) => defaultStorage.syncSheets(...args);
export const getStorageStatus = (...args) => defaultStorage.getStorageStatus(...args);
export const subscribe = (...args) => defaultStorage.subscribe(...args);
