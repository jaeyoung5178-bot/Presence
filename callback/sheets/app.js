import { createSheet, createRow, getTotals, hasValues, METRICS, LABELS, MAX_ROWS, normalizeSheet, validateSheet, formatDate } from './sheet-model.js';
import { renderSheet, exportSheetPNG } from './sheet-renderer.js';
import { loadSheets, saveSheet, deleteSheet, loadDraft, saveDraft, clearDraft, getStorageStatus, subscribe, syncSheets } from './storage.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let sheet = createSheet(), records = [], owner = getStorageStatus().namespace, dirty = false, editVersion = 0, draftTimer, renderTimer, toastTimer, imageURL, imageFile, loadEpoch = 0, ready = false;
const invalid = new Map();
function error(message = '') { $('#error-banner').textContent = message; $('#error-banner').hidden = !message; }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500); }
function status(message) { $('#save-status').textContent = message; $('#footer-status').textContent = message; }
function get(path) { return path.split('.').reduce((value, key) => value?.[key], sheet); }
function set(path, value) { const keys = path.split('.'), key = keys.pop(); keys.reduce((obj, part) => obj[part], sheet)[key] = value; }
function isNumeric(path) { return path.startsWith('goals.') || /^rows\.\d+\.(contact|stop|presentation|close|rehash)$/.test(path); }
function numberField(path, label, value, extra = '') { return `<label class="field">${esc(label)}<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-field="${path}" value="${value ?? ''}" aria-label="${esc(extra || label)}" placeholder="—"></label>`; }
function renderRows() {
  $('#time-rows').innerHTML = sheet.rows.map((row, i) => `<div class="time-row" data-row-index="${i}"><div class="row-header"><span class="row-index">${String(i + 1).padStart(2, '0')}</span><div class="time-fields"><label>시작<input type="time" data-field="rows.${i}.time" value="${row.time}" aria-label="${i + 1}행 시작 시간"></label><label>종료 · 선택<input type="time" data-field="rows.${i}.endTime" value="${row.endTime}" aria-label="${i + 1}행 종료 시간"></label></div><button type="button" class="icon-button remove-row" data-remove-row="${i}" aria-label="${i + 1}행 삭제" ${sheet.rows.length === 1 ? 'disabled' : ''}>−</button></div><div class="row-numbers">${METRICS.slice(0, 4).map(key => numberField(`rows.${i}.${key}`, LABELS[key], row[key], `${i + 1}행 ${LABELS[key]}`)).join('')}</div><label class="rehash-field">Rehash <span>추가 기록</span><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-field="rows.${i}.rehash" value="${row.rehash ?? ''}" aria-label="${i + 1}행 Rehash" placeholder="—"></label></div>`).join('');
  $('#add-row').disabled = sheet.rows.length >= MAX_ROWS;
  $('#add-row').textContent = sheet.rows.length >= MAX_ROWS ? `시간 기록 최대 ${MAX_ROWS}개` : '＋ 시간 추가';
}
function setupFields() {
  $('#process-goals').innerHTML = METRICS.slice(0, 4).map(key => `<label class="field">${LABELS[key]}<input data-field="processGoals.${key}" maxlength="300" placeholder="예: 5–7"></label>`).join('');
  $('#daily-goals').innerHTML = METRICS.map(key => `<div class="goal-row"><label for="goal-${key}">${LABELS[key]}</label><label class="goal-input-label">목표<input id="goal-${key}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-field="goals.${key}" aria-label="${LABELS[key]} 오늘의 목표" placeholder="—"></label><div class="goal-result">결과<output id="total-${key}" aria-label="${LABELS[key]} 자동 합계">—</output></div></div>`).join('');
  $('#review-fields').innerHTML = [['loa', 'L.O.A'], ['pitch', 'Pitch / Skill'], ['attitude', 'Attitude']].map(([key, label]) => `<div class="review-group"><h3>${label}</h3><div class="field-grid"><label class="field">잘한 점 (+)<textarea rows="4" maxlength="12000" data-field="review.${key}.good" aria-label="${label} 잘한 점" placeholder="오늘 잘한 것, 이어 가고 싶은 것"></textarea></label><label class="field">개선할 점 (−)<textarea rows="4" maxlength="12000" data-field="review.${key}.bad" aria-label="${label} 개선할 점" placeholder="내일 다르게 해 보고 싶은 것"></textarea></label></div></div>`).join('');
}
function hydrate() {
  invalid.clear(); renderRows();
  $$('[data-field]').forEach(input => { input.value = get(input.dataset.field) ?? ''; input.removeAttribute('aria-invalid'); input.setCustomValidity(''); });
  updateTotals(); schedulePreview();
}
function updateTotals() { const totals = getTotals(sheet); METRICS.forEach(key => { $(`#total-${key}`).textContent = hasValues(sheet, key) ? totals[key].toLocaleString() : '—'; }); }
function schedulePreview() { clearTimeout(renderTimer); renderTimer = setTimeout(async () => { try { await renderSheet($('#paper-preview'), structuredClone(sheet)); $('#preview-loading').hidden = true; } catch (e) { $('#preview-loading').hidden = false; $('#preview-loading').textContent = e.message; } }, 90); }
async function persistDraft() {
  if (!ready || invalid.size || !validateSheet(sheet).valid) return;
  const thisOwner = owner, revision = editVersion, snapshot = structuredClone(sheet);
  try { await saveDraft(snapshot, { owner: thisOwner }); if (thisOwner === owner && revision === editVersion && dirty) status('작성 중 · 임시 저장됨'); }
  catch (e) { if (thisOwner === owner) { error(e.message || '임시 저장하지 못했어요.'); status('임시 저장 실패 · 이 창을 유지해 주세요'); } }
}
function changed() { dirty = true; editVersion++; updateTotals(); schedulePreview(); clearTimeout(draftTimer); status(invalid.size ? '입력 확인 필요 · 임시 저장 대기' : '작성 중 · 임시 저장 중…'); if (!invalid.size) draftTimer = setTimeout(persistDraft, 450); }
function checkValid() {
  if (invalid.size) { const [path, message] = invalid.entries().next().value; error(message); $$('[data-field]').find(input => input.dataset.field === path)?.focus(); return false; }
  const result = validateSheet(sheet);
  if (!result.valid) { error(result.errors[0].message); $$('[data-field]').find(input => input.dataset.field === result.errors[0].path)?.focus(); return false; }
  error(); return true;
}
function view(name) { $('.workspace').dataset.activeView = name; $$('[data-view]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.view === name))); }
async function confirmAction(title, copy, accept = '계속') {
  const dialog = $('#confirm-dialog'); $('#confirm-title').textContent = title; $('#confirm-copy').textContent = copy; $('#confirm-accept').textContent = accept; dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
async function canLeave() { return !dirty || await confirmAction('작성 중인 기록이 있어요', '보관함에 남기려면 먼저 콜백싯 저장을 눌러 주세요. 계속하면 현재의 미저장 변경은 지워져요.', '변경 버리고 계속'); }
async function newSheet() {
  if (!await canLeave()) return;
  clearTimeout(draftTimer); sheet = createSheet(); dirty = false; editVersion++; error(); hydrate(); $('#archive-dialog').close(); view('edit');
  await persistDraft(); status('새로운 하루 · 기록을 시작해 보세요'); window.scrollTo({ top: 0, behavior: 'smooth' }); $('#sheet-name').focus({ preventScroll: true });
}
async function refreshRecords() { const thisOwner = owner, loaded = await loadSheets(); if (thisOwner !== owner) return; records = loaded; $('#archive-count').textContent = records.length; renderArchive(); }
function renderArchive() {
  const query = $('#archive-search').value.trim().toLocaleLowerCase(), month = $('#archive-month').value;
  const filtered = records.filter(record => (!month || record.date.startsWith(month)) && (!query || [record.date, ...Object.values(record.meta)].join(' ').toLocaleLowerCase().includes(query))).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  if (!filtered.length) { $('#archive-list').innerHTML = `<div class="archive-empty"><strong>${records.length ? '찾는 기록이 없어요' : '첫 번째 필드를 기다리고 있어요'}</strong><p>${records.length ? '검색어나 월을 바꾸어 다시 찾아보세요.' : '새 기록을 작성하고 저장하면 날짜순으로 모여요.'}</p></div>`; return; }
  $('#archive-list').innerHTML = filtered.map(record => { const totals = getTotals(record), title = [record.meta.name, record.meta.location, record.meta.theme].filter(Boolean).join(' · ') || '이름 없는 필드 기록'; return `<article class="archive-record"><button class="record-open" data-open-sheet="${esc(record.id)}" aria-label="${esc(record.date + ' ' + title)} 열기"><span class="record-date">${formatDate(record.date)}</span><span class="record-title">${esc(title)}</span><span class="record-stats">${METRICS.map(key => `<span>${LABELS[key]} <b>${hasValues(record, key) ? totals[key] : '—'}</b></span>`).join('')}</span></button><button class="icon-button record-delete" data-delete-sheet="${esc(record.id)}" aria-label="${record.date} 기록 삭제">×</button></article>`; }).join('');
}
async function openArchive() { try { await refreshRecords(); $('#archive-dialog').showModal(); } catch (e) { error(e.message); } }
async function saveCurrent() {
  if (!checkValid()) return;
  clearTimeout(draftTimer); const button = $('#save-sheet'), revision = editVersion, thisOwner = owner, currentId = sheet.id; button.disabled = true; status('콜백싯 저장 중…');
  try {
    const result = await saveSheet(structuredClone(sheet), { owner: thisOwner });
    if (thisOwner !== owner || currentId !== sheet.id) return;
    if (revision === editVersion) { sheet = result.sheet; dirty = false; } else { sheet.id = result.sheet.id; sheet.updatedAt = result.sheet.updatedAt; }
    await saveDraft(structuredClone(sheet), { owner }); await refreshRecords();
    status(dirty ? '기록 저장됨 · 이후 변경은 임시 저장됨' : '보관함에 저장됨'); toast(result.conflict ? '다른 창의 변경을 보호하기 위해 별도 기록으로 저장했어요.' : `${formatDate(sheet.date)} 콜백싯을 저장했어요.`);
  } catch (e) { error(e.message || '기록을 저장하지 못했어요.'); status('저장 실패 · 작성 내용은 이 창에 남아 있어요'); }
  finally { button.disabled = false; }
}
async function exportImage() {
  if (!checkValid()) return;
  const button = $('#export-image'); button.disabled = true; status('손글씨 사진을 만들고 있어요…');
  try {
    const output = await exportSheetPNG(structuredClone(sheet));
    if (imageURL) URL.revokeObjectURL(imageURL); imageURL = URL.createObjectURL(output.blob); imageFile = new File([output.blob], output.filename, { type: 'image/png' });
    $('#export-preview-image').src = imageURL; $('#image-download').href = imageURL; $('#image-download').download = output.filename;
    $('#image-size').textContent = `PNG · ${output.width.toLocaleString()} × ${output.height.toLocaleString()} px · 입력한 내용 그대로`;
    $('#image-share').hidden = !navigator.canShare?.({ files: [imageFile] }); $('#image-dialog').showModal();
    $('#image-download').click(); status(dirty ? '사진 준비됨 · 보관함 저장은 별도예요' : '사진이 준비됐어요');
  } catch (e) { error(e.message || '사진을 만들지 못했어요. 다시 시도해 주세요.'); status('사진 저장 실패 · 작성 내용은 유지돼요'); }
  finally { button.disabled = false; }
}
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function exportBackup() { try { const sheets = await loadSheets(); downloadBlob(new Blob([JSON.stringify({ format: 'presence-callback-backup', version: 1, exportedAt: new Date().toISOString(), sheets }, null, 2)], { type: 'application/json' }), `콜백싯_전체백업_${new Date().toISOString().slice(0, 10)}.json`); toast(`${sheets.length}개의 저장된 기록을 백업했어요.`); } catch (e) { error(e.message); } }
async function importBackup(file) {
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('백업 파일은 20MB 이하여야 해요.');
    const payload = JSON.parse(await file.text()), source = Array.isArray(payload) ? payload : payload.sheets;
    if (!Array.isArray(source) || source.length > 3000) throw new Error('올바른 콜백싯 JSON 백업 파일을 선택해 주세요.');
    const sheets = source.map(normalizeSheet), ids = new Set();
    for (const record of sheets) { if (ids.has(record.id)) throw new Error('백업에 중복된 기록 ID가 있어요.'); ids.add(record.id); }
    if (!await confirmAction('백업을 가져올까요?', `${sheets.length}개의 기록을 보관함에 추가해요. 기존 기록은 유지돼요.`, '가져오기')) return;
    const thisOwner = owner; let imported = 0;
    try { for (const record of sheets) { await saveSheet(record, { owner: thisOwner, deferSync: true }); imported++; } }
    catch (e) { throw new Error(`${imported}개를 가져온 후 중단되었어요. ${e.message}`); }
    await refreshRecords(); toast(`${imported}개의 기록을 가져왔어요.`); syncSheets().then(refreshRecords).catch(e => error(e.message));
  } catch (e) { toast(e instanceof SyntaxError ? 'JSON 파일을 읽을 수 없어요.' : e.message); }
  finally { $('#import-file').value = ''; }
}
async function loadNamespace() {
  const epoch = ++loadEpoch; ready = false; clearTimeout(draftTimer); owner = getStorageStatus().namespace; invalid.clear(); dirty = false;
  try {
    const draft = await loadDraft(); if (epoch !== loadEpoch) return;
    sheet = draft ? normalizeSheet(draft) : createSheet(); editVersion++; hydrate(); await refreshRecords(); if (epoch !== loadEpoch) return;
    dirty = !!draft && !records.some(record => record.id === draft.id && JSON.stringify(record) === JSON.stringify(draft)); ready = true; status(draft ? (dirty ? '임시 저장한 기록을 이어서 작성해요' : '저장한 기록을 불러왔어요') : '새로운 하루 · 기록을 시작해 보세요');
  } catch (e) { ready = true; error(e.message || '저장된 기록을 읽지 못했어요.'); status('기록 불러오기 오류'); }
}
function storageStatusChanged(value = getStorageStatus()) {
  const next = value?.namespace ? value : getStorageStatus();
  $('#storage-status').textContent = next.message || (next.mode === 'connected' ? '계정에 연결됨' : '이 기기에 저장');
  if (owner !== next.namespace && ready) { error(); loadNamespace().then(() => syncSheets()).then(refreshRecords).catch(e => error(e.message)); }
}

setupFields();
$('#sheet-form').addEventListener('submit', event => event.preventDefault());
$('#sheet-form').addEventListener('input', event => {
  const input = event.target, path = input.dataset.field; if (!path) return;
  const value = input.value;
  if (isNumeric(path) && value !== '' && (!/^\d+$/.test(value) || Number(value) > 999)) {
    const message = `${input.getAttribute('aria-label') || LABELS[path.split('.').at(-1)]}: 0~999 사이의 정수를 입력해 주세요.`;
    invalid.set(path, message); input.setCustomValidity(message); input.setAttribute('aria-invalid', 'true'); error(message); changed(); return;
  }
  invalid.delete(path); input.setCustomValidity(''); input.removeAttribute('aria-invalid'); set(path, isNumeric(path) ? value === '' ? null : Number(value) : value);
  if (!invalid.size) error(); changed();
});
$('#time-rows').addEventListener('click', async event => {
  const button = event.target.closest('[data-remove-row]'); if (!button || !checkValid()) return;
  const i = Number(button.dataset.removeRow), row = sheet.rows[i]; if (sheet.rows.length <= 1) return;
  if ((row.time || row.endTime || METRICS.some(key => row[key] !== null)) && !await confirmAction('시간 기록을 삭제할까요?', `${i + 1}번째 시간 기록과 숫자가 삭제돼요.`, '시간 기록 삭제')) return;
  sheet.rows.splice(i, 1); renderRows(); changed();
});
$('#add-row').addEventListener('click', () => { if (!checkValid() || sheet.rows.length >= MAX_ROWS) return; sheet.rows.push(createRow()); renderRows(); changed(); $(`[data-field="rows.${sheet.rows.length - 1}.time"]`).focus(); });
$$('[data-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.view)));
$('#save-sheet').addEventListener('click', saveCurrent); $('#export-image').addEventListener('click', exportImage);
$('#open-archive').addEventListener('click', openArchive); $('#new-sheet').addEventListener('click', newSheet); $('#archive-new').addEventListener('click', newSheet);
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.closeDialog}`).close()));
$('#archive-search').addEventListener('input', renderArchive); $('#archive-month').addEventListener('input', renderArchive);
$('#archive-list').addEventListener('click', async event => {
  const open = event.target.closest('[data-open-sheet]'), remove = event.target.closest('[data-delete-sheet]');
  if (open) { if (!await canLeave()) return; const record = records.find(item => item.id === open.dataset.openSheet); if (!record) return; clearTimeout(draftTimer); sheet = normalizeSheet(record); dirty = false; editVersion++; hydrate(); error(); $('#archive-dialog').close(); view('edit'); await persistDraft(); status('저장한 기록을 열었어요 · 수정 후 다시 저장할 수 있어요'); window.scrollTo({ top: 0 }); }
  if (remove) { const record = records.find(item => item.id === remove.dataset.deleteSheet); if (!record || !await confirmAction('이 콜백싯을 삭제할까요?', `${formatDate(record.date)} 기록을 보관함에서 삭제해요. 삭제 전 전체 백업으로 보관할 수 있어요.`, '기록 삭제')) return; try { await deleteSheet(record.id, { owner }); if (sheet.id === record.id) { sheet = createSheet(); dirty = false; hydrate(); await clearDraft({ owner }); } await refreshRecords(); toast('콜백싯을 삭제했어요.'); } catch (e) { toast(e.message); } }
});
$('#backup-export').addEventListener('click', exportBackup); $('#backup-import').addEventListener('click', () => $('#import-file').click()); $('#import-file').addEventListener('change', event => importBackup(event.target.files[0]));
$('#image-share').addEventListener('click', async () => { try { await navigator.share({ files: [imageFile], title: `콜백싯 ${sheet.date}` }); } catch (e) { if (e.name !== 'AbortError') toast('공유를 열지 못했어요. PNG 다운로드를 이용해 주세요.'); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(draftTimer); persistDraft(); } });
window.addEventListener('beforeunload', event => { if (invalid.size) { event.preventDefault(); event.returnValue = ''; } });
subscribe(storageStatusChanged); storageStatusChanged();
await loadNamespace();
if (new URLSearchParams(location.search).get('view') === 'archive') await openArchive();
syncSheets().then(refreshRecords).catch(e => error(e.message));
