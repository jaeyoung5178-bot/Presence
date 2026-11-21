import {readExistingConnection,createAccountConnection} from '../account-connection.js?v=20261113-account1';
import { createSheet, createNextHourlyRow, fieldMinutes, createDonorCase, CASE_METRICS, getTotals, getDonorSummary, parseObjectionBlocks, isObjectionDonor, isSharedObjectionDonor, reconcileObjectionDonors, setPaperNoteDonor, hasValues, localDate, METRICS, LABELS, MAX_ROWS, normalizeSheet, validateSheet, formatDate } from './sheet-model.js?v=20261122-quick1';
import { renderSheet, exportSheetPNG } from './sheet-renderer.js?v=20261122-date-quick2';
import { createPaperInteraction } from './paper-interaction.js?v=20261122-quick1';
import { mountQuickControls } from './quick-controls.js?v=20261122-quick1';
import { loadSheets, saveSheet, deleteSheet, loadDraft, saveDraft, clearDraft, getStorageStatus, subscribe, syncSheets } from './storage.js?v=20261122-date-move1';
import { createCloudClient, readAccountIdentity } from './cloud.js?v=20261121-field-days1';
import { compareFieldDays, workbookToday, validDate } from './field-days.js?v=20261121-field-days1';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let sheet = createSheet(), sheetBaseDate = '', records = [], owner = getStorageStatus().namespace, dirty = false, editVersion = 0, persistedDraftVersion = 0, draftTimer, renderTimer, toastTimer, imageURL, imageFile, sourceRecord = null, loadEpoch = 0, ready = false;
let backupURLs = [];
let remoteOwner=owner,remoteReadConfirmed=false,remoteReadError='',accountRefresh=null;
const accountClient=createAccountConnection();let accountTicket=0;
let archiveMonth = '', archiveMonthChosen = false, archiveView = 'calendar', selectedDate = '', archivePurpose = 'view', archiveViewBeforePicker = null;
const fieldClient = createCloudClient(), fieldMonths = new Map();
let fieldSignature = readAccountIdentity().signature, dateOnlyDraft = false;
const invalid = new Map();
let paperEditor, quickControls;
function error(message = '') { $('#error-banner').textContent = message; $('#error-banner').hidden = !message; }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500); }
function status(message) { $('#save-status').textContent = message; $('#footer-status').textContent = message; }
function get(path) { return path.split('.').reduce((value, key) => value?.[key], sheet); }
function set(path, value) { const keys = path.split('.'), key = keys.pop(); keys.reduce((obj, part) => obj[part], sheet)[key] = value; }
function isNumeric(path) { return path.startsWith('goals.') || /^rows\.\d+\.(contact|stop|presentation|close|rehash)$/.test(path) || /^rows\.\d+\.donorCases\.\d+\.counts\.(contact|stop|presentation|close)$/.test(path); }
function numberField(path, label, value, extra = '') { return `<label class="field">${esc(label)}<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-field="${path}" value="${value ?? ''}" aria-label="${esc(extra || label)}" placeholder="—"></label>`; }
function caseFields(row, i) {
  const cases = row.donorCases || [];
  return `<details class="sales-cases" ${cases.length ? 'open' : ''}><summary>세일즈 케이스 <span>${cases.length ? `${cases.length}건` : '후원자 · 특이사항'}</span></summary><p class="case-guide">위 시간별 합계에 포함된 케이스예요. 케이스 숫자는 합계에 다시 더하지 않아요. 후원자를 체크하면 이 케이스의 획과 특이사항만 빨간색으로 표시돼요.</p>${cases.map((item, j) => `<div class="sales-case ${item.donor ? 'is-donor' : ''}" data-case="${i}:${j}"><div class="case-heading"><span>CASE ${j + 1}</span><label class="donor-toggle"><input type="checkbox" data-field="rows.${i}.donorCases.${j}.donor" aria-label="${i + 1}행 ${j + 1}번 케이스 후원자" ${item.donor ? 'checked' : ''}>후원자</label><button type="button" class="icon-button" data-remove-case="${i}:${j}" aria-label="${i + 1}행 ${j + 1}번 케이스 삭제">×</button></div><div class="row-numbers">${CASE_METRICS.map(key => numberField(`rows.${i}.donorCases.${j}.counts.${key}`, LABELS[key], item.counts[key], `${i + 1}행 ${j + 1}번 케이스 ${LABELS[key]}`)).join('')}</div><label class="field case-note"><span data-case-note-label>${item.donor ? '후원자 특이사항' : '특이사항'}</span><textarea data-field="rows.${i}.donorCases.${j}.note" maxlength="12000" rows="3" aria-label="${i + 1}행 ${j + 1}번 케이스 특이사항" placeholder="시리얼, 기본정보, 오브젝션 핸들링 사유">${esc(item.note)}</textarea></label></div>`).join('')}<button type="button" class="button add-button" data-add-case="${i}" ${cases.length >= 100 ? 'disabled' : ''}>＋ 케이스 추가</button></details>`;
}
function renderRows() {
  $('#time-rows').innerHTML = sheet.rows.map((row, i) => `<div class="time-row" data-row-index="${i}"><div class="row-header"><span class="row-index">${String(i + 1).padStart(2, '0')}</span><div class="time-fields"><label>시작<input type="time" data-field="rows.${i}.time" value="${row.time}" aria-label="${i + 1}행 시작 시간"></label><label>종료 · 선택<input type="time" data-field="rows.${i}.endTime" value="${row.endTime}" aria-label="${i + 1}행 종료 시간"></label></div><button type="button" class="icon-button remove-row" data-remove-row="${i}" aria-label="${i + 1}행 삭제" ${sheet.rows.length === 1 ? 'disabled' : ''}>−</button></div><p class="time-duration">실제 필드 <output data-field-minutes="${i}">${fieldMinutes(row) === null ? '—' : `${fieldMinutes(row)}분`}</output></p><div class="row-numbers">${METRICS.slice(0, 4).map(key => numberField(`rows.${i}.${key}`, LABELS[key], row[key], `${i + 1}행 ${LABELS[key]}`)).join('')}</div><label class="rehash-field">Rehash <span>추가 기록</span><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-field="rows.${i}.rehash" value="${row.rehash ?? ''}" aria-label="${i + 1}행 Rehash" placeholder="—"></label></div>`).join('');
  $$('.time-row').forEach((element, i) => element.insertAdjacentHTML('beforeend', caseFields(sheet.rows[i], i)));
  $('#add-row').disabled = sheet.rows.length >= MAX_ROWS;
  $('#add-row').textContent = sheet.rows.length >= MAX_ROWS ? `시간 기록 최대 ${MAX_ROWS}개` : '＋ 시간 추가';
}
function updateTimeFields() {
  sheet.rows.forEach((row, index) => {
    for (const key of ['time', 'endTime']) $(`[data-field="rows.${index}.${key}"]`).value = row[key];
    const minutes = fieldMinutes(row); $(`[data-field-minutes="${index}"]`).textContent = minutes === null ? '—' : `${minutes}분`;
  });
}
function setupFields() {
  $('#process-goals').innerHTML = METRICS.slice(0, 4).map(key => `<label class="field">${LABELS[key]}<input data-field="processGoals.${key}" maxlength="300" placeholder="예: 5–7"></label>`).join('');
  $('#daily-goals').innerHTML = METRICS.map(key => `<div class="goal-row"><label for="goal-${key}">${LABELS[key]}</label><label class="goal-input-label">목표<input id="goal-${key}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-field="goals.${key}" aria-label="${LABELS[key]} 오늘의 목표" placeholder="—"></label><div class="goal-result">결과<output id="total-${key}" aria-label="${LABELS[key]} 자동 합계">—</output></div></div>`).join('');
  $('#review-fields').innerHTML = [['loa', 'Number'], ['pitch', 'Pitch(Skill)'], ['attitude', 'Attitude(Mental)']].map(([key, label]) => `<div class="review-group"><h3>${label}</h3><div class="field-grid"><label class="field">잘한 점 (+)<textarea rows="4" maxlength="12000" data-field="review.${key}.good" aria-label="${label} 잘한 점" placeholder="오늘 잘한 것, 이어 가고 싶은 것"></textarea></label><label class="field">개선할 점 (−)<textarea rows="4" maxlength="12000" data-field="review.${key}.bad" aria-label="${label} 개선할 점" placeholder="내일 다르게 해 보고 싶은 것"></textarea></label></div></div>`).join('');
}
function hydrate() {
  invalid.clear(); paperEditor?.reset(); renderRows();
  $$('[data-field]').forEach(input => { if (input.type === 'checkbox') input.checked = !!get(input.dataset.field); else input.value = get(input.dataset.field) ?? ''; input.removeAttribute('aria-invalid'); input.setCustomValidity(''); });
  renderObjectionFlags(); updateTotals(); updateSourceBanner(); schedulePreview(); quickControls?.sync();
}
function renderObjectionFlags() {
  const blocks = parseObjectionBlocks(sheet.objections), host = $('#objection-donor-list');
  host.hidden = !blocks.length;
  host.innerHTML = '<p class="case-guide">후원자에 체크하면 이미 적은 특이사항이 빨간색으로 표시돼요.</p>' + blocks.map((block, index) => `<label class="objection-donor-toggle"><input type="checkbox" data-objection-donor="${index}" aria-label="${index + 1}번째 특이사항 후원자" ${isObjectionDonor(sheet, index) ? 'checked' : ''}><span><strong>${isSharedObjectionDonor(sheet, index) ? '후원자 · 기존 공유 표시' : '후원자'}</strong><span>${esc(block)}</span></span></label>`).join('');
  host.querySelectorAll('[data-objection-donor]').forEach(input => {
    input.indeterminate = isSharedObjectionDonor(sheet, Number(input.dataset.objectionDonor));
    if (input.indeterminate) input.checked = false;
    input.setAttribute('aria-checked', input.indeterminate ? 'mixed' : String(input.checked));
  });
}
function sourceValueCount(record) { return record.rows.reduce((total, row) => total + METRICS.filter(key => row[key] !== null).length, 0); }
function sourceStatus(record) {
  const count = sourceValueCount(record), read = record.source?.transcription;
  if (read) return `사진 원본 · 하루 합계 ${METRICS.filter(key => Number.isInteger(read.totals[key])).length}/5개 읽음${count ? ` · 시간별 숫자 ${count}칸 입력` : ''}`;
  return count ? `사진 원본 · 숫자 ${count}칸 입력` : '사진 기록 · 숫자 미전사';
}
function renderTranscription(record) {
  const transcription = record.source.transcription;
  let host = $('#source-transcription');
  if (!host) { host = document.createElement('section'); host.id = 'source-transcription'; host.className = 'source-transcription'; host.setAttribute('aria-label', '사진에서 읽어낸 기록'); $('#source-notes').insertAdjacentElement('afterend', host); }
  if (!transcription) { host.innerHTML = '<h3>읽어낸 기록</h3><p class="subtle">아직 이 사진에서 읽어낸 숫자와 회고가 없어요.</p>'; return; }
  const numeric = value => value === null ? '<span class="transcription-unknown">판독 불가 · 미기록</span>' : value.toLocaleString('ko-KR');
  host.innerHTML = `<div class="transcription-heading"><h3>읽어낸 기록</h3><span class="source-badge">${transcription.status === 'reviewed' ? '원본 대조 완료' : '일부 판독 · 확인 필요'}</span></div><p class="subtle">종이에 적힌 하루 합계와 회고예요. 읽지 못한 칸은 비워 두었고, 시간별 숫자는 배분하지 않았어요. 분석은 직접 입력한 칸을 우선해요.</p><div class="transcription-totals">${METRICS.map(key => `<div><h4>${LABELS[key]}</h4><span class="transcription-result" data-transcription-total="${key}">${numeric(transcription.totals[key])}</span>${transcription.goals ? `<small>목표 ${numeric(transcription.goals[key])}</small>` : ''}</div>`).join('')}</div><div class="transcription-reviews">${[['loa', 'Number · L.O.A'], ['pitch', 'Pitch · Skill'], ['attitude', 'Attitude · Mental']].map(([key, title]) => `<article><h4>${title}</h4>${[['good', '잘한 점 (+)'], ['bad', '개선할 점 (−)']].map(([kind, label]) => `<div><h5>${label}</h5><p data-transcription-review="${key}.${kind}" class="${transcription.review[key][kind].trim() ? '' : 'transcription-unknown'}">${esc(transcription.review[key][kind].trim() || '판독 불가 또는 미기록')}</p></div>`).join('')}</article>`).join('')}</div>${transcription.notes ? `<p class="transcription-notes">${esc(transcription.notes)}</p>` : ''}`;
}
function dateBasisText(record) {
  if (record.source.dateBasis === 'capture') return '촬영일 기준 · 종이에 적힌 날짜는 확인이 필요해요.';
  if (record.source.dateBasis === 'unknown') return '날짜 미확인 · 보관함 정렬 날짜는 임시 날짜예요.';
  return '종이에 적힌 날짜 기준';
}
function updateSourceBanner() {
  const hasSource = sheet.source?.type === 'photo';
  $('#source-banner').hidden = !hasSource;
  if (hasSource) $('#editor-source-status').textContent = sourceStatus(sheet);
  $('#preview-state').textContent = hasSource ? '옮겨 적은 내용 미리보기' : '실시간 미리보기';
}
function openSource(record) {
  if (record.source?.type !== 'photo') return;
  sourceRecord = record;
  $('#source-title').textContent = `${formatDate(record.date)}${record.meta.name ? ` · ${record.meta.name}` : ''}`;
  $('#source-status').textContent = sourceStatus(record);
  $('#source-date-basis').textContent = dateBasisText(record);
  $('.source-info').dataset.uncertain = String(record.source.dateBasis !== 'written');
  $('#source-duplicates').hidden = record.source.duplicateCount === 0;
  $('#source-duplicates').textContent = `같은 종이의 추가 촬영 ${record.source.duplicateCount}장을 중복으로 정리했어요.`;
  $('#source-filename').textContent = record.source.filename;
  $('#source-notes').textContent = record.source.notes;
  $('#source-notes').hidden = !record.source.notes;
  renderTranscription(record);
  $('#source-image-error').hidden = true;
  $('#source-image').hidden = false;
  $('#source-image').src = record.source.imageDataUrl;
  $('#source-download').href = record.source.imageDataUrl;
  $('#source-download').download = record.source.filename;
  $('#source-transcribe').textContent = sheet.id === record.id ? '기록 작성으로 돌아가기' : '기록 옮겨 적기';
  $('#source-photo-frame').dataset.zoomed = 'false';
  $('#source-zoom').setAttribute('aria-pressed', 'false');
  $('#source-zoom').textContent = '원본 크기로 보기';
  $('#source-dialog').showModal();
  $('#source-dialog .dialog-shell').scrollTop = 0;
}
async function editRecord(record) {
  let opened = false;
  if (sheet.id !== record.id || sheet.updatedAt !== record.updatedAt || sheet.date !== record.date) {
    if (!await canLeave()) return false;
    clearTimeout(draftTimer); dateOnlyDraft = false; sheet = normalizeSheet(record); sheetBaseDate = record.date; dirty = false; editVersion++; hydrate(); error();
    opened = true;
    status(sheet.source ? '원본을 보면서 기록을 옮겨 적어요 · 원본 사진은 그대로 보관돼요' : '저장한 기록을 열었어요 · 수정 후 다시 저장할 수 있어요');
  }
  $('#source-dialog').close(); $('#archive-dialog').close(); view('edit'); window.scrollTo({ top: 0 });
  // Drafts share the cloud-sync queue; showing a saved record must not wait for a download.
  if (opened) void persistDraft();
  return true;
}
function updateTotals() { const totals = getTotals(sheet); METRICS.forEach(key => { $(`#total-${key}`).textContent = hasValues(sheet, key) ? totals[key].toLocaleString() : '—'; }); }
function schedulePreview() {
  clearTimeout(renderTimer); const revision = editVersion;
  renderTimer = setTimeout(async () => {
    const snapshot = structuredClone(sheet);
    try {
      const geometry = await renderSheet($('#paper-preview'), snapshot);
      if (snapshot.id !== sheet.id || revision !== editVersion) return;
      paperEditor?.setGeometry(snapshot.id, geometry); $('#preview-loading').hidden = true;
    } catch (e) { if (snapshot.id === sheet.id && revision === editVersion) { paperEditor?.reset(); $('#preview-loading').hidden = false; $('#preview-loading').textContent = e.message; } }
  }, 90);
}
async function persistDraft() {
  if (!ready || dateOnlyDraft || invalid.size || !validateSheet(sheet).valid) return;
  const thisOwner = owner, revision = editVersion, snapshot = structuredClone(sheet);
  try { await saveDraft(snapshot, { owner: thisOwner, baseDate: sheetBaseDate }); if (thisOwner === owner && revision === editVersion) { persistedDraftVersion = revision; if (dirty) status('작성 중 · 임시 저장됨'); } }
  catch (e) { if (thisOwner === owner) { error(e.message || '임시 저장하지 못했어요.'); status('임시 저장 실패 · 이 창을 유지해 주세요'); } }
}
function changed() { dateOnlyDraft = false; dirty = true; editVersion++; updateTotals(); updateSourceBanner(); schedulePreview(); clearTimeout(draftTimer); const validation = validateSheet(sheet); if (!invalid.size) error(validation.valid ? '' : validation.errors[0].message); status(invalid.size || !validation.valid ? '입력 확인 필요 · 임시 저장 대기' : '작성 중 · 임시 저장 중…'); if (!invalid.size && validation.valid) draftTimer = setTimeout(persistDraft, 450); quickControls?.sync(); }
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
  clearTimeout(draftTimer); dateOnlyDraft = false; sheet = createSheet(); sheetBaseDate = ''; dirty = false; editVersion++; error(); hydrate(); $('#archive-dialog').close(); view('edit');
  await persistDraft(); status('새로운 하루 · 기록을 시작해 보세요'); window.scrollTo({ top: 0, behavior: 'smooth' }); $('#sheet-name').focus({ preventScroll: true });
}
function dedupeRecords(loaded) {
  const seenIds = new Set(), seenPhotos = new Set();
  return [...loaded].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter(record => {
    if (seenIds.has(record.id)) return false;
    seenIds.add(record.id);
    if (record.source?.type === 'photo') { if (seenPhotos.has(record.source.imageDataUrl)) return false; seenPhotos.add(record.source.imageDataUrl); }
    return true;
  });
}
async function refreshRecords() { const thisOwner = owner, loaded = await loadSheets(); if (thisOwner !== owner) return; records = dedupeRecords(loaded); $('#archive-count').textContent = records.length; renderArchive(); }
function fieldState() {
  const identity = readAccountIdentity();
  return { identity, key: `${identity.signature}|${archiveMonth}`, value: fieldMonths.get(`${identity.signature}|${archiveMonth}`) };
}
function fieldComparisons() {
  const { value } = fieldState(), connection = getStorageStatus();
  if (owner !== connection.namespace) return [];
  return value?.phase === 'ready' ? compareFieldDays(value.data.days, records, { archiveConfirmed: remoteReadConfirmed && !remoteReadError, archivePending: connection.pending > 0 }) : [];
}
function ensureFieldMonth() {
  const { identity, key, value } = fieldState(), month = archiveMonth;
  if (!identity.uid || value) return;
  fieldMonths.set(key, { phase: 'loading' });
  fieldClient.readFieldMonth(identity, month, workbookToday()).then(data => {
    if (readAccountIdentity().signature !== identity.signature) return;
    fieldMonths.set(key, { phase: 'ready', data });
    if (archiveMonth === month) renderArchive();
  }).catch(() => {
    if (readAccountIdentity().signature !== identity.signature) return;
    fieldMonths.set(key, { phase: 'error' });
    if (archiveMonth === month) renderArchive();
  });
}
function renderFieldDays() {
  const { identity, value } = fieldState(), panel = $('#field-days-panel'), statusText = $('#field-days-status'), list = $('#field-days-list');
  $('.field-days-save-note').innerHTML = archivePurpose === 'write' ? '날짜를 누르면 현재 작성 중인 콜백싯의 날짜만 바뀌어요. 숫자와 메모는 그대로 유지돼요. <strong>콜백싯 저장</strong>을 눌러야 보관함에 반영돼요.' : '‘미작성’에서 작성하기를 눌러 날짜를 선택하세요. 내용을 입력하고 <strong>콜백싯 저장</strong>을 눌러야 보관함에 남아요. 기록 유무와 실제 제출 확인은 다를 수 있어요.';
  const count = $('#choose-field-date-count');
  count.textContent = !identity.uid ? '연결' : value?.phase === 'ready' ? `${fieldComparisons().filter(day => day.recordStatus === 'missing').length}일` : value?.phase === 'error' ? '재확인' : '확인 중';
  if (!dirty) $('#field-days-draft').hidden = true;
  panel.dataset.state = !identity.uid ? 'guest' : value?.phase || 'loading';
  $('#field-days-retry').hidden = !identity.uid || value?.phase === 'loading';
  $('#field-days-notice').textContent = '';
  list.innerHTML = '';
  if (!identity.uid) { statusText.textContent = '계정을 연결하면 필드 뛴 날과 콜백싯 기록을 함께 확인할 수 있어요.'; return; }
  if (!value || value.phase === 'loading') { statusText.textContent = '워크북의 나의 필드 달력과 저장 기록을 확인하고 있어요…'; return; }
  if (value.phase === 'error') { statusText.textContent = '필드 달력을 불러오지 못했어요.'; $('#field-days-notice').textContent = '기록 유무를 단정하지 않았어요. 다시 확인해 주세요. 기존 콜백싯은 그대로 보관돼요.'; return; }
  const days = fieldComparisons(), missing = days.filter(day => day.recordStatus === 'missing'), found = days.filter(day => ['paper', 'legacy'].includes(day.recordStatus)), unknown = days.filter(day => day.recordStatus === 'unknown');
  if (days.length) statusText.innerHTML = `<span>필드 ${days.length}일</span><span>기록 있는 날 ${found.length}일</span><span class="field-needs-total">미작성 ${missing.length}일</span>${unknown.length ? `<span>확인필요 ${unknown.length}일</span>` : ''}`;
  else statusText.textContent = '이 달에는 확인된 필드 근무일이 없어요.';
  $('#field-days-notice').textContent = [!value.data.firstFieldVerified ? '첫 필드 시작일은 연결 권한 안에서 확인하지 못했어요. 아래는 실제 세일즈가 저장된 근무일이에요.' : '', unknown.length ? '확인필요 날짜는 기록 조회나 사진 날짜 확인이 끝나야 작성 여부를 알 수 있어요.' : '', '휴무·랠리·미입력·미래 날짜는 제외해요. 저장한 0건은 필드 근무일에 포함해요.'].filter(Boolean).join(' ');
  list.innerHTML = days.map(day => {
    const label = day.recordStatus === 'missing' ? '미작성' : day.recordStatus === 'paper' ? (day.localPending ? '이 기기 저장' : '저장기록') : day.recordStatus === 'legacy' ? '기존 기록 있음' : '확인필요';
    const dateLabel = formatDate(day.date);
    const action = archivePurpose === 'write' ? `<button type="button" class="button field-date-action" data-apply-field-date="${day.date}" aria-label="${esc(dateLabel)} 날짜 선택" ${ready ? '' : 'disabled'}>이 날짜 선택</button>` : day.recordStatus === 'missing' ? `<button type="button" class="button field-date-action" data-start-field-date="${day.date}" aria-label="${esc(dateLabel)} 콜백싯 작성">작성하기 ↗</button>`
      : day.recordStatus === 'legacy' ? `<a class="button secondary field-date-action" href="../index.html?view=see&date=${day.date}">기존 기록 보기 ↗</a>`
      : day.recordStatus === 'paper' ? `<button type="button" class="button secondary field-date-action" data-show-field-date="${day.date}">저장 기록 보기</button>` : '';
    return `<li class="field-day-item" data-record-status="${day.recordStatus}"><div><strong>${esc(dateLabel)}</strong><span class="field-day-label">${label}</span></div>${action}</li>`;
  }).join('');
}
function applyDateToCurrentSheet(date) {
  if (!ready || !validDate(date)) return;
  const input = $('#sheet-date');
  if (sheet.date !== date) {
    paperEditor?.clearUndo(); sheet.date = date; input.value = date;
    invalid.delete('date'); input.setCustomValidity(''); input.removeAttribute('aria-invalid'); changed();
  }
  $('#archive-dialog').close(); view('edit'); input.focus({ preventScroll: true });
  status(`${formatDate(date)} 선택됨 · 입력 내용은 그대로예요. 저장하면 이 날짜에 반영돼요.`);
}
async function startFieldDate(date) {
  if (!validDate(date) || !fieldComparisons().some(day => day.date === date && day.recordStatus === 'missing')) return;
  if (!ready) { toast('작성 중인 기록을 확인하고 있어요. 잠시 후 다시 눌러 주세요.'); return; }
  if (dirty) {
    if (sheet.date === date) { $('#archive-dialog').close(); view('edit'); $('#sheet-date').focus(); return; }
    toast(`${formatDate(sheet.date)}에 작성 중인 기록이 있어요. 먼저 저장한 뒤 다른 날짜를 작성해 주세요.`);
    $('#field-days-draft').hidden = false; $('#field-days-continue').focus(); return;
  }
  clearTimeout(draftTimer); paperEditor?.reset(); sheet = createSheet(); sheetBaseDate = ''; sheet.date = date;
  sheet.meta.name = fieldState().value?.data.name || ''; dirty = false; dateOnlyDraft = true; editVersion++; error(); hydrate();
  $('#archive-dialog').close(); view('edit'); status(`${formatDate(date)} 콜백싯 · 내용을 입력한 뒤 저장해 주세요`);
  window.scrollTo({ top: 0 }); $('#sheet-date').focus({ preventScroll: true });
}
function donorGroupSummary(group) {
  return group.reduce((summary, record) => { const donor = getDonorSummary(record); if (donor.count === null) summary.unknown++; else summary.known += donor.count; return summary; }, { known: 0, unknown: 0 });
}
function shiftCalendarMonth(offset) {
  const [year, month] = archiveMonth.split('-').map(Number), target = new Date(year, month - 1 + offset, 1);
  archiveMonth = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`; archiveMonthChosen = true; selectedDate = ''; renderArchive();
}
function renderCalendar() {
  const [year, month] = archiveMonth.split('-').map(Number), monthRecords = records.filter(record => record.date.startsWith(archiveMonth)), byDate = new Map();
  monthRecords.forEach(record => { if (!byDate.has(record.date)) byDate.set(record.date, []); byDate.get(record.date).push(record); });
  $('#calendar-month-label').textContent = `${year}년 ${month}월`;
  const total = donorGroupSummary(monthRecords);
  $('#calendar-summary').textContent = monthRecords.length ? (total.unknown === monthRecords.length ? `후원자 미확인 · 미확인 기록 ${total.unknown}개` : `후원자 ${total.known.toLocaleString()}명${total.unknown ? ` + 미확인 기록 ${total.unknown}개` : ''} · 콜백싯 ${monthRecords.length}개`) : (getStorageStatus().uid ? ((!remoteReadConfirmed||remoteReadError)?'개인 기록을 확인하지 못했어요. 다시 불러오기를 눌러 주세요.':'이 달에는 저장된 콜백싯이 없어요.') : '현재 기기에서 확인되는 기록이 없어요. 개인 연결과 이전 콜백싯을 확인해 주세요.');
  const first = new Date(year, month - 1, 1).getDay(), days = new Date(year, month, 0).getDate(), today = workbookToday(), fieldByDate = new Map(fieldComparisons().map(day => [day.date, day]));
  let markup = '<span class="calendar-pad" aria-hidden="true"></span>'.repeat(first);
  for (let day = 1; day <= days; day++) {
    const date = `${archiveMonth}-${String(day).padStart(2, '0')}`, group = byDate.get(date) || [], counts = donorGroupSummary(group), unknownOnly = counts.unknown === group.length && group.length > 0;
    const field = fieldByDate.get(date), missing = field?.recordStatus === 'missing', legacy = field?.recordStatus === 'legacy', uncertain = field?.recordStatus === 'unknown';
    const detail = missing ? '필드 근무일, 콜백싯 미작성' : legacy ? '필드 근무일, 기존 콜백싯 기록 있음' : uncertain ? '필드 근무일, 기록 확인필요' : group.length ? `${unknownOnly ? '후원자 미확인' : `후원자 ${counts.known}명${counts.unknown ? ' 및 미확인 기록 있음' : ''}`}, 콜백싯 ${group.length}개` : '기록 없음';
    markup += `<button class="calendar-day${group.length ? ' has-record' : ''}${missing ? ' needs-record' : ''}${legacy ? ' has-field-record' : ''}${uncertain ? ' field-unknown' : ''}${date === today ? ' is-today' : ''}${date === selectedDate ? ' is-selected' : ''}" data-calendar-date="${date}" aria-label="${year}년 ${month}월 ${day}일, ${field ? `결과 ${field.count}건, ` : ''}${detail}${archivePurpose === 'write' ? ', 작성 날짜로 선택' : ''}" ${date === today ? 'aria-current="date"' : ''} ${archivePurpose !== 'write' && !group.length && !field ? 'disabled' : ''}><span class="calendar-date">${day}</span>${field ? `<span class="calendar-field-result"><span class="calendar-result-label">결과 </span>${field.count.toLocaleString()}건</span>` : ''}${missing || legacy || uncertain ? `<span class="calendar-field-label">${missing ? '미작성' : legacy ? '기존기록' : '확인필요'}</span>` : group.length ? `<span class="calendar-donors ${unknownOnly ? 'is-unknown' : ''}">${unknownOnly ? '미확인' : `${counts.known}명${counts.unknown ? '+?' : ''}`}</span>${group.length > 1 ? `<span class="calendar-record-count">${group.length}개</span>` : ''}` : ''}</button>`;
  }
  $('#calendar-grid').innerHTML = markup;
  if (archivePurpose === 'write' && !ready) {
    $('#calendar-summary').textContent = '작성 중인 내용을 안전하게 불러오는 중이에요. 잠시 후 날짜를 선택할 수 있어요.';
    $$('#calendar-grid [data-calendar-date]').forEach(button => { button.disabled = true; });
  }
}
function renderArchive() {
  const connection=getStorageStatus();$('#archive-error').hidden=!remoteReadError;$('#archive-error').textContent=remoteReadError;$('#archive-retry').hidden=!connection.uid||(!remoteReadError&&remoteReadConfirmed);
  const choosingDate = archivePurpose === 'write';
  $('#archive-search').closest('label').hidden = choosingDate; $('#archive-view-toggle').hidden = choosingDate;
  $('.archive-footer').hidden = choosingDate;

  const query = $('#archive-search').value.trim().toLocaleLowerCase(), currentMonth = workbookToday().slice(0, 7);
  if (!archiveMonth || !archiveMonthChosen) archiveMonth = getStorageStatus().uid || records.some(record => record.date.startsWith(currentMonth)) || !records.length ? currentMonth : records.map(record => record.date.slice(0, 7)).sort().at(-1);
  ensureFieldMonth(); renderFieldDays();
  $('#archive-month').value = archiveMonth;
  $('#archive-calendar').hidden = archiveView === 'list' || !!query;
  $('#archive-view-toggle').textContent = archiveView === 'calendar' ? '목록으로 보기' : '달력으로 보기';
  $('#archive-view-toggle').setAttribute('aria-label', $('#archive-view-toggle').textContent);
  $('#calendar-selection').hidden = !selectedDate || !!query;
  $('#calendar-selection-title').textContent = selectedDate ? `${formatDate(selectedDate)} 콜백싯` : '';
  renderCalendar();
  const filtered = records.filter(record => (query ? [record.date, ...Object.values(record.meta)].join(' ').toLocaleLowerCase().includes(query) : selectedDate ? record.date === selectedDate : record.date.startsWith(archiveMonth))).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  $('#archive-list').hidden = choosingDate || (!query && !selectedDate && archiveView === 'calendar' && records.length > 0);
  if(!filtered.length&&!records.length&&getStorageStatus().uid&&(!remoteReadConfirmed||remoteReadError)){$('#archive-list').innerHTML='<div class="archive-empty"><strong>'+ (remoteReadError?'개인 기록을 불러오지 못했어요':'연결된 기록을 확인하고 있어요')+'</strong><p>이 기기의 기록은 그대로 보관돼요. 다시 불러오기를 눌러 확인해 주세요.</p></div>';return;}
  if (!filtered.length && !records.length && !getStorageStatus().uid) { $('#archive-list').innerHTML = '<div class="archive-empty"><strong>현재 기기의 보관함이에요</strong><p>개인 콜백 연결이 없으면 다른 기기의 기록은 보이지 않아요. 위의 이전 콜백싯 기록 보기에서 기존 연결을 확인해 주세요.</p></div>'; return; }
  if (!filtered.length) { $('#archive-list').innerHTML = `<div class="archive-empty"><strong>${records.length ? '찾는 기록이 없어요' : '첫 번째 필드를 기다리고 있어요'}</strong><p>${records.length ? '검색어나 월을 바꾸어 다시 찾아보세요.' : '새 기록을 작성하고 저장하면 날짜순으로 모여요.'}</p></div>`; return; }
  $('#archive-list').innerHTML = filtered.map(record => {
    const totals = getTotals(record), donor = getDonorSummary(record), photo = record.source?.type === 'photo', title = [record.meta.name, record.meta.location, record.meta.theme].filter(Boolean).join(' · ') || '이름 없는 필드 기록';
    return `<article class="archive-record${photo ? ' record-photo' : ''}"><button class="record-open" data-open-sheet="${esc(record.id)}" aria-label="${esc(record.date + ' ' + title)} ${photo ? '원본 사진' : '기록'} 열기">${photo ? `<img class="record-thumbnail" data-source-thumb="${esc(record.id)}" loading="lazy" alt="">` : ''}<span class="record-date">${formatDate(record.date)}</span><span class="record-title">${esc(title)}</span><span class="record-donor-count">${donor.count === null ? '후원자 미확인' : `후원자 ${donor.count.toLocaleString()}명`}${donor.basis === 'rehash' ? ' · Rehash 기준' : ''}</span>${photo ? `<span class="source-badge">${sourceStatus(record)}</span>${record.source.dateBasis !== 'written' ? `<span class="record-date-basis">${record.source.dateBasis === 'capture' ? '촬영일 기준' : '날짜 미확인 · 임시 정렬'}</span>` : ''}` : ''}${!photo || sourceValueCount(record) ? `<span class="record-stats">${METRICS.map(key => `<span>${LABELS[key]} <b>${hasValues(record, key) ? totals[key] : '—'}</b></span>`).join('')}</span>` : ''}</button><button class="icon-button record-delete" data-delete-sheet="${esc(record.id)}" aria-label="${record.date} 기록 삭제">×</button></article>`;
  }).join('');
  const byId = new Map(filtered.filter(record => record.source).map(record => [record.id, record]));
  $$('[data-source-thumb]').forEach(image => { image.src = byId.get(image.dataset.sourceThumb).source.imageDataUrl; });
}
function restoreArchiveView() {
  if (archivePurpose === 'write' && archiveViewBeforePicker) {
    const previous = archiveViewBeforePicker; archiveMonth = previous.month; archiveMonthChosen = previous.chosen; archiveView = previous.view; selectedDate = previous.date; $('#archive-search').value = previous.query;
  }
  if (archivePurpose === 'write') $('.archive-mode').after($('#archive-calendar'));
  archivePurpose = 'view'; archiveViewBeforePicker = null; $('#archive-title').textContent = '내 콜백싯';
}
async function openArchive({ purpose = 'view' } = {}) {
  if (!$('#archive-dialog').open) restoreArchiveView();
  archivePurpose = purpose;
  if (purpose === 'write') {
    archiveViewBeforePicker = { month: archiveMonth, chosen: archiveMonthChosen, view: archiveView, date: selectedDate, query: $('#archive-search').value };
    archiveMonth = workbookToday().slice(0, 7); archiveMonthChosen = true; archiveView = 'calendar'; selectedDate = ''; $('#archive-search').value = '';
    $('#archive-dialog .dialog-heading').after($('#archive-calendar'));
  }
  $('#archive-title').textContent = purpose === 'write' ? '작성할 날짜 선택' : '내 콜백싯';
  if (!$('#archive-dialog').open) $('#archive-dialog').showModal();
  $('#archive-loading').hidden = false; $('#archive-error').hidden = true; $('#archive-dialog').setAttribute('aria-busy', 'true'); renderArchive();
  try { await refreshRecords(); }
  catch (e) { $('#archive-error').textContent = e.message || '기록을 불러오지 못했어요. 다시 열어 주세요.'; $('#archive-error').hidden = false; }
  finally {
    $('#archive-loading').hidden = true; $('#archive-dialog').removeAttribute('aria-busy');
    if (purpose === 'write' && $('#archive-dialog').open) {
      $('#archive-dialog .dialog-shell').scrollTop = 0;
      ($('#calendar-grid .needs-record') || $('#calendar-prev')).focus({ preventScroll: true });
    }
  }
}
async function saveCurrent() {
  if (!checkValid()) return;
  clearTimeout(draftTimer); const button = $('#save-sheet'), revision = editVersion, thisOwner = owner, currentId = sheet.id; button.disabled = true; status('콜백싯 저장 중…');
  try {
    const result = await saveSheet(structuredClone(sheet), { owner: thisOwner, baseDate: sheetBaseDate });
    if (thisOwner !== owner || currentId !== sheet.id) return;
    dateOnlyDraft = false;
    sheetBaseDate = result.baseDate || result.sheet.date;
    if (revision === editVersion) { sheet = result.sheet; dirty = false; } else { sheet.id = result.sheet.id; sheet.updatedAt = result.sheet.updatedAt; }
    await saveDraft(structuredClone(sheet), { owner, baseDate: sheetBaseDate }); await refreshRecords();
    status(dirty ? '기록 저장됨 · 이후 변경은 임시 저장됨' : '보관함에 저장됨'); toast(result.conflict ? '다른 창의 변경을 보호하기 위해 별도 기록으로 저장했어요.' : `${formatDate(sheet.date)} 콜백싯을 저장했어요.`);
  } catch (e) {
    if (e.code === 'callback/date-move-conflict' && thisOwner === owner && currentId === sheet.id) {
      await persistDraft();
      error(e.message); status(persistedDraftVersion === editVersion ? '날짜 변경 보류 · 입력 내용은 임시 저장됨' : '날짜 변경 보류 · 입력을 보존하려면 이 창을 유지해 주세요');
    } else { error(e.message || '기록을 저장하지 못했어요.'); status('저장 실패 · 작성 내용은 이 창에 남아 있어요'); }
  }
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
function clearBackupLinks() { backupURLs.forEach(url => URL.revokeObjectURL(url)); backupURLs = []; $('#backup-downloads')?.remove(); }
async function exportBackup() {
  try {
    const saved = await loadSheets(), chunks = [], encoder = new TextEncoder(); let chunk = [], bytes = 0, photos = 0;
    for (const record of saved) {
      const json = JSON.stringify(record), size = encoder.encode(json).length + 2, photo = record.source?.type === 'photo';
      if (chunk.length && (bytes + size > 19 * 1024 * 1024 || (photo && photos >= 25))) { chunks.push(chunk); chunk = []; bytes = 0; photos = 0; }
      chunk.push(json); bytes += size; if (photo) photos++;
    }
    if (chunk.length || !chunks.length) chunks.push(chunk);
    const now = new Date().toISOString(), prefix = JSON.stringify({ format: 'presence-callback-backup', version: 1, exportedAt: now }).slice(0, -1);
    const parts = chunks.map((items, i) => ({ blob: new Blob([`${prefix},"sheets":[${items.join(',')}]}`], { type: 'application/json' }), filename: `콜백싯_전체백업_${now.slice(0, 10)}${chunks.length > 1 ? `_${String(i + 1).padStart(2, '0')}-${String(chunks.length).padStart(2, '0')}` : ''}.json`, count: items.length }));
    clearBackupLinks();
    if (parts.length === 1) { downloadBlob(parts[0].blob, parts[0].filename); toast(`${saved.length}개의 저장된 기록을 백업했어요.`); return; }
    const list = document.createElement('div'); list.id = 'backup-downloads'; list.className = 'backup-downloads';
    const intro = document.createElement('p'); intro.textContent = `전체 ${saved.length}개 기록을 ${parts.length}개 파일로 나눴어요. 아래 파일을 모두 저장해 주세요.`; list.append(intro);
    parts.forEach((part, index) => { const link = document.createElement('a'), url = URL.createObjectURL(part.blob); backupURLs.push(url); link.href = url; link.download = part.filename; link.className = 'button secondary'; link.textContent = `백업 ${index + 1} / ${parts.length} · ${part.count}개 기록`; list.append(link); });
    $('.archive-footer').before(list); list.querySelector('a').click(); list.scrollIntoView({ block: 'nearest' }); toast(`백업 ${parts.length}개 파일을 준비했어요. 각 파일은 다시 가져올 수 있는 크기예요.`);
  } catch (e) { error(e.message); }
}
async function importBackup(file) {
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('백업 파일은 20MB 이하여야 해요.');
    const payload = JSON.parse(await file.text()), source = Array.isArray(payload) ? payload : payload.sheets;
    if (!Array.isArray(source) || source.length > 3000) throw new Error('올바른 콜백싯 JSON 백업 파일을 선택해 주세요.');
    const sheets = source.map(normalizeSheet), ids = new Set();
    for (const record of sheets) { if (ids.has(record.id)) throw new Error('백업에 중복된 기록 ID가 있어요.'); ids.add(record.id); }
    if (!await confirmAction('백업을 가져올까요?', `${sheets.length}개의 기록을 보관함에 추가해요. 기존 기록은 유지돼요.`, '가져오기')) return;
    const thisOwner = owner; let imported = 0, skipped = 0, filled = 0;
    try { for (const record of sheets) { const result = await saveSheet(record, { owner: thisOwner, deferSync: true, importOriginal: record.source?.type === 'photo' }); if (result.metadataFilled) filled++; else if (result.skipped) skipped++; else imported++; } }
    catch (e) { throw new Error(`${imported}개를 가져온 후 중단되었어요. ${e.message}`); }
    await refreshRecords(); toast(`${imported}개의 새 기록을 가져왔어요.${filled ? ` 기존 사진 ${filled}개의 읽어낸 기록을 보완했어요.` : ''}${skipped ? ` 이미 가져온 사진 ${skipped}개는 그대로 유지했어요.` : ''}`); syncAccountRecords().then(refreshRecords).catch(e => error(e.message));
  } catch (e) { toast(e instanceof SyntaxError ? 'JSON 파일을 읽을 수 없어요.' : e.message); }
  finally { $('#import-file').value = ''; }
}
async function loadNamespace() {
  const epoch = ++loadEpoch; ready = false; dateOnlyDraft = false; paperEditor?.reset(); clearTimeout(draftTimer); owner = getStorageStatus().namespace; records = []; invalid.clear(); dirty = false; archiveMonth = ''; archiveMonthChosen = false; selectedDate = '';
  try {
    const draftContext = await loadDraft({ includeBase: true }); if (epoch !== loadEpoch) return;
    const draft = draftContext?.sheet;
    sheet = draft ? normalizeSheet(draft) : createSheet(); sheetBaseDate = draftContext?.baseDate || ''; editVersion++; persistedDraftVersion = editVersion; hydrate(); await refreshRecords(); if (epoch !== loadEpoch) return;
    const saved = records.find(record => record.id === sheet.id);
    if (!sheetBaseDate && saved?.updatedAt === sheet.updatedAt) sheetBaseDate = saved.date;
    dirty = !!draft && !records.some(record => record.id === draft.id && JSON.stringify(record) === JSON.stringify(draft)); ready = true; quickControls?.sync(); if ($('#archive-dialog').open) renderArchive(); status(draft ? (dirty ? '임시 저장한 기록을 이어서 작성해요' : '저장한 기록을 불러왔어요') : '새로운 하루 · 기록을 시작해 보세요');
  } catch (e) { ready = true; quickControls?.sync(); if ($('#archive-dialog').open) renderArchive(); error(e.message || '저장된 기록을 읽지 못했어요.'); status('기록 불러오기 오류'); }
}
async function syncAccountRecords(){const namespace=getStorageStatus().namespace;try{const result=await syncSheets();const next=getStorageStatus();if(next.namespace!==namespace)return result;if((next.error||next.phase==='error')&&!next.blockedDateMoves){remoteReadConfirmed=false;remoteReadError='기록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.';}else if(next.uid&&next.mode==='connected'){remoteReadConfirmed=true;remoteReadError='';}renderArchive();return result;}catch(error){if(getStorageStatus().namespace===namespace){remoteReadConfirmed=false;remoteReadError='기록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.';renderArchive();}throw error;}}
async function preserveGuestDraft(){if(!dirty)return;if(invalid.size||!validateSheet(sheet).valid)throw Object.assign(new Error('작성 중인 내용을 먼저 확인해 주세요. 현재 기록은 이 창에 그대로 있어요.'),{code:'callback/draft-unconfirmed'});await persistDraft();if(persistedDraftVersion!==editVersion)throw Object.assign(new Error('작성 중인 기록을 보관하지 못했어요. 이 창을 유지하고 다시 시도해 주세요.'),{code:'callback/draft-unconfirmed'});}
function storageStatusChanged(value = getStorageStatus()) {
  const next = value?.namespace ? value : getStorageStatus();
  const signature = readAccountIdentity().signature;
  if (fieldSignature !== signature) { fieldSignature = signature; fieldMonths.clear(); $('#field-days-draft').hidden = true; }
  if(remoteOwner!==next.namespace){remoteOwner=next.namespace;remoteReadConfirmed=false;remoteReadError='';}
  if(next.uid&&next.phase==='error'&&next.error&&!next.blockedDateMoves){remoteReadConfirmed=false;remoteReadError='기록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.';}
  $('#open-account-connect').hidden=!!next.uid;
  $('#storage-status').textContent = `${next.name ? `${next.name} · ` : ''}${next.message || (next.mode === 'connected' ? '계정에 연결됨' : '이 기기에 저장')}`;
  $('#archive-connection-status').textContent = $('#storage-status').textContent;
  if (owner !== next.namespace && ready) { records=[]; $('#source-dialog').close(); clearBackupLinks(); error(); accountRefresh=loadNamespace().then(() => syncAccountRecords()).then(refreshRecords).catch(e => {error(e.message);}); }
  if ($('#archive-dialog').open) renderArchive();
}

setupFields();
paperEditor = createPaperInteraction({ getSheet: () => sheet, isReady: () => ready, checkValid: () => { if (invalid.size || !validateSheet(sheet).valid) view('edit'); return checkValid(); }, onChange: () => { renderRows(); $('#objections').value = sheet.objections; renderObjectionFlags(); changed(); }, onError: message => { error(message); toast(message); } });
quickControls = mountQuickControls({ getSheet: () => sheet, isReady: () => ready && !invalid.size, onChange: () => { paperEditor?.clearUndo(); renderRows(); updateTimeFields(); $('#objections').value = sheet.objections; renderObjectionFlags(); changed(); }, onError: message => { error(message); toast(message); } });
$('#sheet-form').addEventListener('submit', event => event.preventDefault());
$('#sheet-form').addEventListener('input', event => {
  const input = event.target, path = input.dataset.field; if (!path) return; paperEditor?.clearUndo();
  if (input.type === 'checkbox') { set(path, input.checked); const card = input.closest('.sales-case'); if (card) { card.classList.toggle('is-donor', input.checked); card.querySelector('[data-case-note-label]').textContent = input.checked ? '후원자 특이사항' : '특이사항'; } changed(); return; }
  const value = input.value;
  if (isNumeric(path) && value !== '' && (!/^\d+$/.test(value) || Number(value) > 999)) {
    const message = `${input.getAttribute('aria-label') || LABELS[path.split('.').at(-1)]}: 0~999 사이의 정수를 입력해 주세요.`;
    invalid.set(path, message); input.setCustomValidity(message); input.setAttribute('aria-invalid', 'true'); error(message); changed(); return;
  }
  const previousObjections = sheet.objections;
  invalid.delete(path); input.setCustomValidity(''); input.removeAttribute('aria-invalid'); set(path, isNumeric(path) ? value === '' ? (path.includes('.counts.') ? 0 : null) : Number(value) : value);
  if (/^rows\.\d+\.(time|endTime)$/.test(path)) updateTimeFields();
  if (path === 'objections') { reconcileObjectionDonors(sheet, previousObjections); renderObjectionFlags(); }
  if (!invalid.size) error(); changed();
});
$('#objection-donor-list').addEventListener('change', event => {
  const input = event.target.closest('[data-objection-donor]'); if (!input) return; paperEditor?.clearUndo();
  const blockIndex = Number(input.dataset.objectionDonor), block = parseObjectionBlocks(sheet.objections)[blockIndex]; if (!block) return;
  try { if (setPaperNoteDonor(sheet, { kind: 'objection', blockIndex, block }, input.checked)) { renderObjectionFlags(); changed(); } }
  catch (e) { renderObjectionFlags(); error(e.message); toast(e.message); }
});
$('#time-rows').addEventListener('click', async event => {
  const addCase = event.target.closest('[data-add-case]'), removeCase = event.target.closest('[data-remove-case]');
  if (addCase || removeCase || event.target.closest('[data-remove-row]')) paperEditor?.clearUndo();
  if (addCase) { if (!checkValid()) return; const i = Number(addCase.dataset.addCase), row = sheet.rows[i]; if ((row.donorCases?.length || 0) >= 100) return; (row.donorCases ||= []).push(createDonorCase(row)); renderRows(); changed(); $(`[data-field="rows.${i}.donorCases.${row.donorCases.length - 1}.donor"]`).focus(); return; }
  if (removeCase) { if (invalid.size) { checkValid(); return; } const [i, j] = removeCase.dataset.removeCase.split(':').map(Number), item = sheet.rows[i].donorCases[j]; if ((item.note || item.donor) && !await confirmAction('이 케이스를 삭제할까요?', '케이스의 색상 표시와 특이사항이 삭제돼요. 시간별 합계는 그대로예요.', '케이스 삭제')) return; sheet.rows[i].donorCases.splice(j, 1); renderRows(); changed(); return; }
  const button = event.target.closest('[data-remove-row]'); if (!button || !checkValid()) return;
  const i = Number(button.dataset.removeRow), row = sheet.rows[i]; if (sheet.rows.length <= 1) return;
  if ((row.time || row.endTime || row.donorCases?.length || METRICS.some(key => row[key] !== null)) && !await confirmAction('시간 기록을 삭제할까요?', `${i + 1}번째 시간 기록과 숫자, 세일즈 케이스가 삭제돼요.`, '시간 기록 삭제')) return;
  sheet.rows.splice(i, 1); renderRows(); changed();
});
$('#add-row').addEventListener('click', () => { paperEditor?.clearUndo(); if (!checkValid() || sheet.rows.length >= MAX_ROWS) return; sheet.rows.push(createNextHourlyRow(sheet.rows.at(-1))); renderRows(); changed(); $(`[data-field="rows.${sheet.rows.length - 1}.time"]`).focus(); });
$$('[data-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.view)));
$('#save-sheet').addEventListener('click', saveCurrent); $('#export-image').addEventListener('click', exportImage);
$('#open-archive').addEventListener('click', () => openArchive()); $('#new-sheet').addEventListener('click', newSheet); $('#archive-new').addEventListener('click', newSheet);
$('#choose-field-date').addEventListener('click', () => openArchive({ purpose: 'write' }));
$('#breadcrumb-choose-date').addEventListener('click', () => openArchive({ purpose: 'write' }));
$('#archive-dialog').addEventListener('close', () => {
  if (!$('#archive-dialog').open) restoreArchiveView();
});
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.closeDialog}`).close()));
$('#archive-search').addEventListener('input', renderArchive);
$('#archive-month').addEventListener('input', event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) { archiveMonth = event.target.value; archiveMonthChosen = true; selectedDate = ''; } renderArchive(); });
$('#calendar-prev').addEventListener('click', () => shiftCalendarMonth(-1)); $('#calendar-next').addEventListener('click', () => shiftCalendarMonth(1));
$('#archive-view-toggle').addEventListener('click', () => { archiveView = archiveView === 'calendar' ? 'list' : 'calendar'; selectedDate = ''; $('#archive-search').value = ''; renderArchive(); });
$('#calendar-clear-date').addEventListener('click', () => { selectedDate = ''; renderArchive(); });
$('#calendar-grid').addEventListener('click', async event => {
  const button = event.target.closest('[data-calendar-date]'); if (!button || button.disabled) return;
  if (archivePurpose === 'write') { applyDateToCurrentSheet(button.dataset.calendarDate); return; }
  const field = fieldComparisons().find(day => day.date === button.dataset.calendarDate);
  if (field?.recordStatus === 'missing') { await startFieldDate(field.date); return; }
  if (field?.recordStatus === 'legacy' && !records.some(record => record.date === field.date)) { location.href = `../index.html?view=see&date=${field.date}`; return; }
  if (field?.recordStatus === 'unknown' && !records.some(record => record.date === field.date)) { toast('이 날짜의 기록은 확인이 더 필요해요. 필드 달력 다시 확인을 눌러 주세요.'); return; }
  const group = records.filter(record => record.date === button.dataset.calendarDate);
  if (group.length === 1) { if (group[0].source?.type === 'photo') openSource(group[0]); else await editRecord(group[0]); }
  else { selectedDate = button.dataset.calendarDate; renderArchive(); $('#calendar-selection').scrollIntoView({ block: 'nearest' }); $('#archive-list [data-open-sheet]')?.focus({ preventScroll: true }); }
});
$('#calendar-grid').addEventListener('keydown', event => {
  const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]; if (!offset) return;
  const buttons = $$('[data-calendar-date]'); let index = buttons.indexOf(document.activeElement) + offset;
  while (index >= 0 && index < buttons.length) { if (!buttons[index].disabled) { event.preventDefault(); buttons[index].focus(); return; } index += offset; }
});
$('#archive-list').addEventListener('click', async event => {
  const open = event.target.closest('[data-open-sheet]'), remove = event.target.closest('[data-delete-sheet]');
  if (open) { const record = records.find(item => item.id === open.dataset.openSheet); if (!record) return; if (record.source?.type === 'photo') openSource(record); else await editRecord(record); }
  if (remove) {
    const record = records.find(item => item.id === remove.dataset.deleteSheet);
    if (record?.id === sheet.id && dirty) { toast('지금 작성 중인 기록이에요. 입력 내용을 보호하기 위해 삭제하지 않았어요. 먼저 저장하거나 다른 기록을 열어 주세요.'); return; }
    if (!record || !await confirmAction('이 콜백싯을 삭제할까요?', `${formatDate(record.date)} 기록을 보관함에서 삭제해요. 삭제 전 전체 백업으로 보관할 수 있어요.`, '기록 삭제')) return;
    try { await deleteSheet(record.id, { owner }); if (sheet.id === record.id) { sheet = createSheet(); sheetBaseDate = ''; dirty = false; hydrate(); await clearDraft({ owner }); } await refreshRecords(); toast('콜백싯을 삭제했어요.'); } catch (e) { toast(e.message); }
  }
});
$('#field-days-list').addEventListener('click', async event => {
  const apply = event.target.closest('[data-apply-field-date]'), start = event.target.closest('[data-start-field-date]'), show = event.target.closest('[data-show-field-date]');
  if (apply && archivePurpose === 'write') applyDateToCurrentSheet(apply.dataset.applyFieldDate);
  if (start) await startFieldDate(start.dataset.startFieldDate);
  if (show) { selectedDate = show.dataset.showFieldDate; $('#archive-search').value = ''; renderArchive(); $('#calendar-selection').scrollIntoView({ block: 'nearest' }); $('#archive-list [data-open-sheet]')?.focus({ preventScroll: true }); }
});
$('#field-days-retry').addEventListener('click', () => { fieldMonths.delete(fieldState().key); renderArchive(); });
$('#field-days-continue').addEventListener('click', () => { $('#archive-dialog').close(); view('edit'); $('#sheet-date').focus(); });
$('#backup-export').addEventListener('click', exportBackup); $('#backup-import').addEventListener('click', () => $('#import-file').click()); $('#import-file').addEventListener('change', event => importBackup(event.target.files[0]));
$('#image-share').addEventListener('click', async () => { try { await navigator.share({ files: [imageFile], title: `콜백싯 ${sheet.date}` }); } catch (e) { if (e.name !== 'AbortError') toast('공유를 열지 못했어요. PNG 다운로드를 이용해 주세요.'); } });
$('#open-source').addEventListener('click', () => openSource(sheet));
$('#source-transcribe').addEventListener('click', async () => { if (sourceRecord) await editRecord(sourceRecord); });
$('#source-dialog').addEventListener('close', () => { sourceRecord = null; $('#source-image').removeAttribute('src'); $('#source-download').removeAttribute('href'); });
$('#source-image').addEventListener('load', event => { $('#source-photo-frame').style.setProperty('--source-natural-width', `${event.target.naturalWidth}px`); });
$('#source-image').addEventListener('error', () => { if (sourceRecord) { $('#source-image').hidden = true; $('#source-image-error').hidden = false; } });
$('#source-zoom').addEventListener('click', () => { const zoomed = $('#source-zoom').getAttribute('aria-pressed') !== 'true'; $('#source-photo-frame').dataset.zoomed = String(zoomed); $('#source-zoom').setAttribute('aria-pressed', String(zoomed)); $('#source-zoom').textContent = zoomed ? '화면에 맞추기' : '원본 크기로 보기'; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(draftTimer); persistDraft(); } });
window.addEventListener('beforeunload', event => { if ((dirty && persistedDraftVersion !== editVersion) || invalid.size || !validateSheet(sheet).valid) { event.preventDefault(); event.returnValue = ''; } });
subscribe(storageStatusChanged); storageStatusChanged();
const entryParams = new URLSearchParams(location.search), chooseOnEntry = entryParams.get('view') !== 'archive' || entryParams.get('chooseDate') === '1';
if (chooseOnEntry) void openArchive({ purpose: 'write' });
await loadNamespace();
if (!chooseOnEntry) await openArchive();
syncAccountRecords().then(refreshRecords).catch(e => error(e.message));

$('#open-account-connect').addEventListener('click',()=>{$('#account-connect-status').textContent='';$('#account-connect-dialog').showModal();$('#account-connect-id').focus();});
$('#cancel-account-connect').addEventListener('click',()=>$('#account-connect-dialog').close());
$('#account-connect-dialog').addEventListener('close',()=>{accountTicket++;accountClient.cancel();$('#account-connect-password').value='';$('#account-connect-form [type=submit]').disabled=false;($('#open-account-connect').hidden?$('.archive-legacy-access>a'):$('#open-account-connect')).focus();});
$('#account-connect-form').addEventListener('submit',async event=>{event.preventDefault();const ticket=++accountTicket,submit=$('#account-connect-form [type=submit]');submit.disabled=true;$('#account-connect-status').textContent='본인 기록 연결을 확인하고 있어요…';try{await preserveGuestDraft();if(ticket!==accountTicket)return;await accountClient.connect($('#account-connect-id').value.trim(),$('#account-connect-password').value);if(ticket!==accountTicket)return;getStorageStatus();if(accountRefresh)await accountRefresh;else{await loadNamespace();await syncAccountRecords();await refreshRecords();}if(ticket!==accountTicket)return;$('#account-connect-dialog').close();renderArchive();}catch(error){if(ticket!==accountTicket)return;$('#account-connect-status').textContent=error.code==='callback/draft-unconfirmed'?error.message:error.code==='callback/profile-missing'?'워크북에서 내 콜백 링크를 먼저 확인해 주세요.':error.code==='callback/account-changed'?'이미 연결된 계정이 있어요. 기존 개인 콜백 링크를 확인해 주세요.':'계정 연결을 확인하지 못했어요. 아이디와 비밀번호를 확인하고 다시 시도해 주세요.';}finally{if(ticket===accountTicket){$('#account-connect-password').value='';submit.disabled=false;}}});
$('#archive-retry').addEventListener('click',async()=>{const button=$('#archive-retry');button.disabled=true;try{await syncAccountRecords();await refreshRecords();}catch{}finally{button.disabled=false;renderArchive();}});
