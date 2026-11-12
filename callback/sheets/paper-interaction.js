import { LABELS, incrementPaperMetric, decrementPaperMetric, parseObjectionBlocks, replaceObjectionNote, validateSheet } from './sheet-model.js?v=20261112-close-minus1';

export function createPaperInteraction({ getSheet, isReady, checkValid, onChange, onError }) {
  const $ = selector => document.querySelector(selector), layer = $('#paper-hit-layer'), scroll = $('#paper-scroll'), toggle = $('#paper-edit-toggle'), undoButton = $('#paper-undo'), dialog = $('#paper-note-dialog');
  const desktop = matchMedia('(min-width:1300px)');
  let expanded = false, subtracting = false, geometrySheetId = null, undo = null, editing = null;
  const buttons = new Map();
  function clearUndo() { undo = null; undoButton.disabled = true; }
  function reset() { clearUndo(); subtracting = false; geometrySheetId = null; buttons.clear(); layer.replaceChildren(); editing = null; if (dialog.open) dialog.close(); $('#paper-note-body').value = ''; $('#paper-note-donor').checked = false; $('#paper-note-existing').textContent = ''; $('#paper-note-existing').hidden = true; $('#paper-note-error').textContent = ''; $('#paper-note-error').hidden = true; $('#paper-announcement').textContent = ''; updateMode(); }
  function updateMetricButton(button, target) {
    const row = getSheet().rows.find(row => row.id === target.rowId), count = row?.[target.metric] ?? 0;
    button.setAttribute('aria-label', `${target.rowIndex + 1}행 ${row?.time || '시간 미입력'} ${LABELS[target.metric]} ${count}회 · 1회 ${subtracting ? '빼기' : '추가'}`);
    button.disabled = subtracting ? count <= 0 : count >= 999;
  }
  function updateMode() {
    scroll.classList.toggle('is-editing', expanded); layer.hidden = !expanded && !desktop.matches;
    layer.classList.toggle('is-subtracting', subtracting);
    $('#paper-add-mode').setAttribute('aria-pressed', String(!subtracting));
    $('#paper-subtract-mode').setAttribute('aria-pressed', String(subtracting));
    for (const button of buttons.values()) if (button.paperTarget?.kind === 'metric') updateMetricButton(button, button.paperTarget);
    toggle.setAttribute('aria-pressed', String(expanded)); toggle.textContent = expanded ? '전체 종이 보기' : '확대해서 기록';
    const guide = subtracting ? '빼기 모드 · 숫자 칸을 누르면 −1, 0회 아래로 내려가지 않아요. 작성한 메모와 후원자 표시는 보존돼요.' : '더하기 모드 · 숫자 칸을 누르면 +1, Close를 더하면 오른쪽에 메모 번호가 생겨요.';
    $('#paper-edit-guide').textContent = !expanded && !desktop.matches ? `확대해서 기록을 누른 뒤 종이의 숫자 칸과 메모를 직접 눌러 주세요. ${guide}` : `${guide} 오른쪽 메모를 누르면 수정해요.`;
  }
  toggle.addEventListener('click', () => { expanded = !expanded; updateMode(); }); desktop.addEventListener('change', updateMode); updateMode();
  $('#paper-add-mode').addEventListener('click', () => { subtracting = false; updateMode(); });
  $('#paper-subtract-mode').addEventListener('click', () => { subtracting = true; updateMode(); });
  function setGeometry(sheetId, value) {
    if (getSheet().id !== sheetId) return;
    geometrySheetId = sheetId; const active = new Set();
    const targets = [...value.cells.map(cell => ({ ...cell, kind: 'metric', key: `metric:${cell.rowId}:${cell.metric}` })), ...value.notes.map((note, index) => ({ ...note, key: note.kind === 'case' ? `case:${note.rowId}:${note.caseId}:${note.slot ?? "extra"}` : note.virtual ? `virtual:${note.slot}` : `objection:${note.blockIndex}` }))];
    targets.forEach(target => {
      active.add(target.key); let button = buttons.get(target.key);
      if (!button) { button = document.createElement('button'); button.type = 'button'; button.className = 'paper-hit'; button.dataset.paperKey = target.key; layer.append(button); buttons.set(target.key, button); }
      button.paperTarget = { ...target, sheetId };
      button.classList.toggle('paper-note-hit', target.kind !== 'metric');
      const inset = 4; Object.assign(button.style, { left: `${(target.x + inset) / value.logicalWidth * 100}%`, top: `${(target.y + inset) / value.logicalHeight * 100}%`, width: `${(target.width - inset * 2) / value.logicalWidth * 100}%`, height: `${(target.height - inset * 2) / value.logicalHeight * 100}%` });
      if (target.kind === 'metric') {
        button.dataset.paperMetric = target.metric; button.dataset.rowId = target.rowId;
        updateMetricButton(button, target);
      } else { delete button.dataset.paperMetric; button.setAttribute('aria-label', `${target.text} 메모 수정`); button.disabled = false; }
    });
    for (const [key, button] of buttons) if (!active.has(key)) { button.remove(); buttons.delete(key); }
    updateMode();
  }
  layer.addEventListener('click', event => {
    const button = event.target.closest('.paper-hit'), target = button?.paperTarget;
    if (!target || !isReady() || target.sheetId !== getSheet().id || geometrySheetId !== getSheet().id || (!expanded && !desktop.matches)) return;
    if (!checkValid()) return;
    if (target.kind !== 'metric') { openNote(target); return; }
    try {
      const action = (subtracting ? decrementPaperMetric : incrementPaperMetric)(getSheet(), target.rowId, target.metric);
      if (!action) return;
      undo = action; undoButton.disabled = false;
      const row = getSheet().rows.find(row => row.id === target.rowId);
      updateMetricButton(button, target);
      $('#paper-announcement').textContent = `${row.time || `${target.rowIndex + 1}행`} ${LABELS[target.metric]} ${row[target.metric]}회 · 1회 ${subtracting ? '뺐어요' : '더했어요'}${undo.note ? ` · 메모 ${undo.note} 추가됨` : ''}${undo.caseAdjusted ? ' · 연결된 케이스 횟수도 1회 줄였어요. 메모와 후원자 표시는 그대로예요.' : ''}`;
      onChange();
    } catch (error) { onError(error.message); }
  });
  undoButton.addEventListener('click', () => {
    const sheet = getSheet(), row = sheet.rows.find(row => row.id === undo?.rowId);
    if (!undo || sheet.id !== undo.sheetId || !row || row[undo.metric] !== undo.next || sheet.objections !== undo.afterObjections || ('afterCases' in undo && JSON.stringify(row.donorCases) !== JSON.stringify(undo.afterCases))) { clearUndo(); return; }
    const candidate = { ...sheet, objections: undo.beforeObjections, donorObjections: undo.beforeFlags, rows: sheet.rows.map(item => item === row ? { ...row, [undo.metric]: undo.previous, ...('beforeCases' in undo && undo.beforeCases !== undefined ? { donorCases: undo.beforeCases } : {}) } : item) };
    if (!validateSheet(candidate).valid) { clearUndo(); onError('다른 입력이 바뀌어 마지막 변경을 취소할 수 없어요. 숫자 칸에서 직접 수정해 주세요.'); return; }
    row[undo.metric] = undo.previous; sheet.objections = undo.beforeObjections;
    if ('beforeCases' in undo) { if (undo.beforeCases === undefined) delete row.donorCases; else row.donorCases = structuredClone(undo.beforeCases); }
    if (undo.beforeFlags === undefined) delete sheet.donorObjections; else sheet.donorObjections = [...undo.beforeFlags];
    clearUndo(); $('#paper-announcement').textContent = '마지막 변경을 취소했어요.'; onChange();
  });
  function openNote(target) {
    const sheet = getSheet(); let body, donor, block;
    if (target.kind === 'case') {
      const item = sheet.rows.find(row => row.id === target.rowId)?.donorCases?.find(item => item.id === target.caseId);
      if (!item) return; body = item.note; donor = item.donor;
    } else {
      block = target.virtual ? target.block : parseObjectionBlocks(sheet.objections)[target.blockIndex]; if (block !== target.block) return;
      body = block.replace(/^(?:\d{1,3}[.)](?!\d)|[①-⑳]|\(\d{1,3}\))\s*/, ''); donor = !!sheet.donorObjections?.includes(block);
    }
    $('#paper-note-existing').textContent = target.commonText ? `함께 기록된 내용 (그대로 보존돼요)\n${target.commonText}` : ''; $('#paper-note-existing').hidden = !target.commonText;
    editing = { ...target, block }; $('#paper-note-title').textContent = target.kind === 'case' ? '세일즈 케이스 메모' : `${block.match(/^(?:\d{1,3}[.)](?!\d)|[①-⑳]|\(\d{1,3}\))/)?.[0] || ''} 오브젝션 메모`.trim();
    $('#paper-note-body').value = body; $('#paper-note-donor').checked = donor; $('#paper-note-error').hidden = true;
    dialog.showModal(); $('#paper-note-body').focus();
  }
  $('#paper-note-form').addEventListener('submit', event => {
    event.preventDefault(); if (!editing || editing.sheetId !== getSheet().id) { dialog.close(); return; }
    const sheet = getSheet(), body = $('#paper-note-body').value, donor = $('#paper-note-donor').checked;
    try {
      if (editing.kind === 'case') {
        const item = sheet.rows.find(row => row.id === editing.rowId)?.donorCases?.find(item => item.id === editing.caseId);
        if (!item) throw new Error('이 메모가 바뀌었어요. 다시 열어 주세요.');
        const before = { note: item.note, donor: item.donor }; item.note = body; item.donor = donor;
        const result = validateSheet(sheet); if (!result.valid) { Object.assign(item, before); throw new Error(result.errors[0].message); }
        clearUndo();
      } else {
        let replacement;
        if (editing.virtual) {
          const candidate = { ...sheet, objections: sheet.objections + (sheet.objections.trim() ? '\n\n' : '') + editing.block };
          replacement = replaceObjectionNote(candidate, editing.block, body, donor, parseObjectionBlocks(candidate.objections).length - 1);
          sheet.objections = candidate.objections; if (candidate.donorObjections !== undefined) sheet.donorObjections = candidate.donorObjections;
        } else replacement = replaceObjectionNote(sheet, editing.block, body, donor, editing.blockIndex);
        if (undo?.note === editing.block) { undo.note = replacement; undo.afterObjections = sheet.objections; } else clearUndo();
      }
      dialog.close(); onChange();
    } catch (error) { $('#paper-note-error').textContent = error.message; $('#paper-note-error').hidden = false; }
  });
  dialog.addEventListener('close', () => { editing = null; });
  return { setGeometry, reset, clearUndo };
}
