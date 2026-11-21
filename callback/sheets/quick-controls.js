import { METRICS, MAX_ROWS, createRow, getPaperNotes, getDonorSummary, setPaperNoteDonor, validateSheet } from './sheet-model.js?v=20261122-quick1';

const minutes = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
const clock = value => `${String(Math.floor((value % 1440) / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const recorded = row => METRICS.some(key => row[key] !== null && row[key] !== undefined) || !!row.donorCases?.length;
const rangeError = message => { throw new Error(message); };

/** Plan before mutating: recorded rows retain their ID, times, values and cases. */
export function planFieldTimeRange(sheet, startTime, endTime) {
  const start = minutes(startTime), rawEnd = minutes(endTime);
  if (start === null || rawEnd === null) rangeError('몇 시부터 몇 시까지인지 골라 주세요.');
  if (start === rawEnd) rangeError('시작과 종료 시간을 다르게 골라 주세요. 하루 안의 필드 시간을 만들 수 있어요.');
  const end = rawEnd < start ? rawEnd + 1440 : rawEnd;
  const protectedRows = sheet.rows.filter(recorded), reusable = sheet.rows.filter(row => !recorded(row));
  let previousEnd = start;
  const occupied = protectedRows.map(row => {
    const rowStart = minutes(row.time), rowEnd = minutes(row.endTime);
    if (rowStart === null || rowEnd === null || rowStart === rowEnd) rangeError('숫자나 메모가 있는 행의 시작·종료 시간을 먼저 확인해 주세요. 기존 기록은 그대로예요.');
    const from = start + (rowStart - start + 1440) % 1440, to = from + (rowEnd - rowStart + 1440) % 1440;
    if (from < start || to > end) rangeError('선택한 시간 밖에 기존 기록이 있어요. 그 기록을 포함하도록 시작·종료 시간을 골라 주세요.');
    if (from < previousEnd) rangeError('기존 기록의 시간이 겹치거나 순서가 달라요. 해당 행의 시간을 먼저 확인해 주세요.');
    previousEnd = to;
    return { row, from, to };
  });
  const rows = []; let cursor = start, reused = 0;
  const fill = until => {
    while (cursor < until) {
      const to = Math.min(until, Math.floor(cursor / 60) * 60 + 60);
      const source = reusable[reused++];
      rows.push({ ...(source || createRow()), time: clock(cursor), endTime: clock(to) });
      cursor = to;
    }
  };
  for (const { row, from, to } of occupied) { fill(from); rows.push(row); cursor = to; }
  fill(end);
  if (rows.length > MAX_ROWS) rangeError(`시간표는 ${MAX_ROWS}행까지 만들 수 있어요. 기존 기록의 시간을 확인해 주세요.`);
  const validation = validateSheet({ ...sheet, rows });
  if (!validation.valid) rangeError(validation.errors[0].message);
  return { rows, startTime, endTime, overnight: rawEnd < start, minutes: end - start, kept: protectedRows.length };
}

function donorTargets(sheet) {
  const seen = new Set();
  return getPaperNotes(sheet).filter(note => {
    const key = note.kind === 'case' ? `case:${note.rowId}:${note.caseId}` : note.virtual ? `virtual:${note.slot}` : `objection:${note.blockIndex}`;
    if (seen.has(key)) return false;
    seen.add(key); note.key = key; return true;
  });
}

export function mountQuickControls({ getSheet, isReady, onChange, onError }) {
  const timeHost = document.createElement('section');
  timeHost.className = 'quick-field-time'; timeHost.setAttribute('aria-labelledby', 'quick-field-time-title');
  timeHost.innerHTML = '<div class="quick-control-heading"><div><h3 id="quick-field-time-title">Field Time</h3><p>몇 시부터 몇 시까지 필드했나요?</p></div><span class="quick-time-badge" hidden>다음 날 종료</span></div><div class="quick-time-fields"><label class="field">몇 시부터<input id="field-time-start" type="time" step="60" aria-label="필드 시작 시간"></label><label class="field">몇 시까지<input id="field-time-end" type="time" step="60" aria-label="필드 종료 시간"></label></div><p class="quick-time-guide">두 시간을 고르면 시간별 행이 자동으로 만들어져요. 숫자·메모가 있는 행은 그대로 보존돼요.</p><button id="apply-field-time" type="button" class="button secondary">시간표 만들기</button><p id="field-time-status" class="quick-control-status" role="status" aria-live="polite"></p>';
  document.querySelector('#time-rows').before(timeHost);
  const donorHost = document.createElement('section');
  donorHost.className = 'quick-donors'; donorHost.setAttribute('aria-labelledby', 'quick-donors-title');
  donorHost.innerHTML = '<div class="quick-control-heading"><div><h3 id="quick-donors-title">오늘의 후원자</h3><p>메모에 체크하면 빨간색으로 표시돼요.</p></div><output id="quick-donor-count" aria-label="오늘의 후원자 수" aria-live="polite">미확인</output></div><details class="quick-donor-details"><summary>메모별 후원자 선택 <span id="quick-note-count"></span></summary><div id="quick-donor-notes" class="quick-donor-notes"></div></details>';
  document.querySelector('#preview-panel .paper-tools').before(donorHost);
  const startInput = timeHost.querySelector('#field-time-start'), endInput = timeHost.querySelector('#field-time-end'), applyButton = timeHost.querySelector('#apply-field-time'), timeStatus = timeHost.querySelector('#field-time-status'), noteList = donorHost.querySelector('#quick-donor-notes');
  let sheetId = null, timesSignature = '', notesSignature = '', noteTargets = [];
  const timeMessage = (text, error = false) => { timeStatus.textContent = text; timeStatus.classList.toggle('is-error', error); };
  const rangePreview = () => {
    if (!startInput.value || !endInput.value) { applyButton.disabled = true; timeHost.querySelector('.quick-time-badge').hidden = true; return null; }
    try {
      const plan = planFieldTimeRange(getSheet(), startInput.value, endInput.value);
      applyButton.disabled = !isReady(); timeHost.querySelector('.quick-time-badge').hidden = !plan.overnight;
      return plan;
    } catch (error) { applyButton.disabled = true; timeMessage(error.message, true); return null; }
  };
  const applyRange = () => {
    if (!isReady()) return;
    const plan = rangePreview(); if (!plan) return;
    getSheet().rows = plan.rows;
    onChange();
    timeMessage(`${plan.startTime}부터 ${plan.overnight ? '다음 날 ' : ''}${plan.endTime}까지 · ${plan.rows.length}행${plan.kept ? ` · 기존 기록 ${plan.kept}행 보존` : ''}`);
  };
  const changeRange = () => { if (rangePreview()) applyRange(); };
  startInput.addEventListener('change', changeRange); endInput.addEventListener('change', changeRange); applyButton.addEventListener('click', applyRange);
  const changeDonor = event => {
    const input = event.target.closest('[data-quick-note]'); if (!input || !isReady()) return;
    const target = noteTargets[Number(input.dataset.quickNote)]; if (!target) return;
    try { setPaperNoteDonor(getSheet(), target, input.checked); onChange(); sync(); }
    catch (error) { sync(); onError(error.message); }
  };
  noteList.addEventListener('change', changeDonor);
  function sync() {
    const sheet = getSheet(), changedSheet = sheetId !== sheet.id;
    if (changedSheet) { sheetId = sheet.id; timesSignature = ''; notesSignature = ''; timeMessage(''); }
    const nextTimes = JSON.stringify(sheet.rows.map(row => [row.id, row.time, row.endTime]));
    if (nextTimes !== timesSignature) {
      const timed = sheet.rows.filter(row => row.time || row.endTime);
      startInput.value = timed[0]?.time || ''; endInput.value = timed.at(-1)?.endTime || ''; timesSignature = nextTimes;
    }
    startInput.disabled = endInput.disabled = !isReady();
    rangePreview();
    noteTargets = donorTargets(sheet);
    const summary = getDonorSummary(sheet), nextNotes = JSON.stringify(noteTargets.map(note => [note.key, note.text]));
    donorHost.querySelector('#quick-donor-count').textContent = summary.count === null ? '미확인' : `${summary.count}명`;
    donorHost.querySelector('#quick-note-count').textContent = noteTargets.length ? `${noteTargets.length}개` : '';
    if (notesSignature !== nextNotes) {
      notesSignature = nextNotes; noteList.replaceChildren();
      if (!noteTargets.length) { const empty = document.createElement('p'); empty.className = 'quick-donor-empty'; empty.textContent = 'Close를 기록하면 메모 번호가 생겨요. 오른쪽 메모를 눌러 내용과 후원자를 바로 기록할 수 있어요.'; noteList.append(empty); }
      noteTargets.forEach((note, index) => {
        const label = document.createElement('label'); label.className = 'quick-donor-note';
        const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.quickNote = index; input.setAttribute('aria-label', `${index + 1}번째 메모 후원자`);
        const copy = document.createElement('span'), title = document.createElement('strong'), body = document.createElement('span');
        title.textContent = '후원자'; body.textContent = note.text; body.title = note.text; copy.append(title, body); label.append(input, copy); noteList.append(label);
      });
    }
    noteList.querySelectorAll('[data-quick-note]').forEach((input, index) => {
      const note = noteTargets[index]; input.indeterminate = !!note?.donorShared; input.checked = !input.indeterminate && !!note?.donor; input.disabled = !isReady();
      input.setAttribute('aria-checked', input.indeterminate ? 'mixed' : String(input.checked));
      input.closest('label').classList.toggle('is-donor', !!note?.donor);
      input.closest('label').querySelector('strong').textContent = input.indeterminate ? '후원자 · 기존 공유 표시' : '후원자';
    });
    if (changedSheet) donorHost.querySelector('details').open = noteTargets.length > 0 && noteTargets.length <= 4;
  }
  function reset() { sheetId = null; sync(); }
  sync();
  return { sync, reset, destroy() { startInput.removeEventListener('change', changeRange); endInput.removeEventListener('change', changeRange); applyButton.removeEventListener('click', applyRange); noteList.removeEventListener('change', changeDonor); timeHost.remove(); donorHost.remove(); } };
}
