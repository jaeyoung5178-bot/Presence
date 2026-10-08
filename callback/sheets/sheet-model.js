export const METRICS = ['contact', 'stop', 'presentation', 'close', 'rehash'];
export const ROW_METRICS = METRICS;
export const LABELS = { contact: 'Contact', stop: 'Stop', presentation: 'Presentation', close: 'Close', rehash: 'Rehash' };
export const MAX_ROWS = 60;
export const CASE_METRICS = METRICS.slice(0, 4);
export function getCaseTotals(row, { donorsOnly = false } = {}) { return Object.fromEntries(CASE_METRICS.map(key => [key, (row.donorCases || []).reduce((sum, item) => sum + ((!donorsOnly || item.donor) ? item.counts[key] : 0), 0)])); }
export function createDonorCase(row) { const used = getCaseTotals(row); return { id: makeId(), donor: false, counts: Object.fromEntries(CASE_METRICS.map(key => [key, Math.min(1, Math.max(0, (row[key] ?? 0) - used[key]))])), note: '' }; }
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export function validatePhotoSource(source) {
  const errors = [], error = (key, message) => errors.push({ path: `source.${key}`, message });
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [{ path: 'source', message: '사진 원본의 형식이 올바르지 않아요.' }];
  if (source.type !== 'photo') error('type', '지원하지 않는 원본 형식이에요.');
  const value = source.imageDataUrl;
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_SOURCE_BYTES / 3) * 4 + 32) error('imageDataUrl', '사진 원본은 2MiB 이하의 JPEG 또는 PNG여야 해요.');
  else {
    const prefix = value.match(/^data:image\/(jpeg|png);base64,/), base64 = prefix ? value.slice(prefix[0].length) : '';
    const bytes = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    const signature = prefix?.[1] === 'jpeg' ? base64.startsWith('/9j/') : base64.startsWith('iVBORw0KGgo');
    if (!prefix || base64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || bytes < 24 || bytes > MAX_SOURCE_BYTES || !signature) error('imageDataUrl', '사진 원본은 유효한 JPEG 또는 PNG 데이터여야 해요.');
  }
  if (typeof source.filename !== 'string' || !source.filename || source.filename.length > 255 || /[\\/\x00-\x1f\x7f]/.test(source.filename) || source.filename === '.' || source.filename === '..') error('filename', '사진 이름에는 폴더 경로 없이 파일 이름만 넣어 주세요.');
  if (typeof source.notes !== 'string' || source.notes.length > 12000) error('notes', '사진 메모는 12,000자 이내로 입력해 주세요.');
  if (!Number.isInteger(source.duplicateCount) || source.duplicateCount < 0 || source.duplicateCount > 9999) error('duplicateCount', '중복 촬영 수가 올바르지 않아요.');
  if (!['written', 'capture', 'unknown'].includes(source.dateBasis)) error('dateBasis', '사진 날짜의 근거가 올바르지 않아요.');
  if (source.donorCount !== undefined && source.donorCount !== null && (!Number.isInteger(source.donorCount) || source.donorCount < 0 || source.donorCount > 99999)) error('donorCount', '사진의 후원자 수는 0~99,999 사이의 정수 또는 미확인이어야 해요.');
  return errors;
}
export function makeId() { return globalThis.crypto?.randomUUID?.() || `sheet-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function createRow() { return { id: makeId(), time: '', endTime: '', ...Object.fromEntries(METRICS.map(key => [key, null])) }; }
export function createSheet(now = new Date()) {
  return { version: 1, id: makeId(), date: localDate(now), meta: { name: '', location: '', team: '', weather: '', theme: '' }, processGoals: { contact: '', stop: '', presentation: '', close: '' }, goals: Object.fromEntries(METRICS.map(key => [key, null])), rows: Array.from({ length: 10 }, createRow), objections: '', review: { loa: { good: '', bad: '' }, pitch: { good: '', bad: '' }, attitude: { good: '', bad: '' } }, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}
export function getTotals(sheet) { return Object.fromEntries(METRICS.map(key => [key, sheet.rows.reduce((sum, row) => sum + (Number.isInteger(row[key]) ? row[key] : 0), 0)])); }
export function hasValues(sheet, key) { return sheet.rows.some(row => row[key] !== null && row[key] !== undefined); }
export function parseObjectionBlocks(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n'), numbered = line => /^\s*(?:\d{1,3}[.)](?!\d)|[①-⑳]|\(\d{1,3}\))/.test(line);
  if (!lines.some(numbered)) return lines.join('\n').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  const blocks = []; let current = [];
  for (const line of lines) { if (numbered(line) && current.length) { const block = current.join('\n').trim(); if (block) blocks.push(block); current = []; } current.push(line); }
  const last = current.join('\n').trim(); if (last) blocks.push(last); return blocks;
}
function noteIdentity(text) { return text.replace(/^\s*(?:\d{1,3}[.)]\s*|[①-⑳]\s*|\(\d{1,3}\)\s*)/, '').replace(/\s+/g, ' ').trim(); }
export function getDonorSummary(sheet) {
  const cases = sheet.rows.flatMap(row => row.donorCases || []);
  const donorCases = cases.filter(item => item.donor), caseNotes = new Set(donorCases.map(item => noteIdentity(item.note)).filter(Boolean));
  const flags = (sheet.donorObjections || []).filter(note => parseObjectionBlocks(sheet.objections).includes(note));
  if (cases.length || Array.isArray(sheet.donorObjections)) return { count: donorCases.length + new Set(flags.map(noteIdentity).filter(note => !caseNotes.has(note))).size, basis: 'cases' };
  if (hasValues(sheet, 'rehash')) return { count: getTotals(sheet).rehash, basis: 'rehash' };
  if (sheet.source?.type === 'photo' && Number.isInteger(sheet.source.donorCount)) return { count: sheet.source.donorCount, basis: 'photo' };
  return { count: null, basis: 'unknown' };
}
export function validateSheet(sheet) {
  const errors = [], error = (path, message) => errors.push({ path, message });
  if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet)) return { valid: false, errors: [{ path: '', message: '콜백싯 형식이 올바르지 않아요.' }] };
  if (sheet.version !== 1) error('version', '지원하지 않는 콜백싯 버전이에요.');
  if (typeof sheet.id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(sheet.id)) error('id', '기록 ID가 올바르지 않아요.');
  if (typeof sheet.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sheet.date) || !Number.isFinite(Date.parse(`${sheet.date}T12:00:00Z`)) || new Date(`${sheet.date}T12:00:00Z`).toISOString().slice(0, 10) !== sheet.date) error('date', '유효한 날짜를 선택해 주세요.');
  const text = (value, path, max = 12000) => { if (typeof value !== 'string' || value.length > max) error(path, `텍스트는 ${max.toLocaleString()}자 이내로 입력해 주세요.`); };
  const number = (value, path) => { if (value !== null && (!Number.isInteger(value) || value < 0 || value > 999)) error(path, '0~999 사이의 정수를 입력해 주세요. 빈칸도 가능해요.'); };
  for (const key of ['name', 'location', 'team', 'weather', 'theme']) text(sheet.meta?.[key], `meta.${key}`, 500);
  for (const key of METRICS.slice(0, 4)) text(sheet.processGoals?.[key], `processGoals.${key}`, 300);
  for (const key of METRICS) number(sheet.goals?.[key], `goals.${key}`);
  if (!Array.isArray(sheet.rows) || sheet.rows.length < 1 || sheet.rows.length > MAX_ROWS) error('rows', `시간 기록은 1~${MAX_ROWS}개여야 해요.`);
  else {
    const ids = new Set();
    sheet.rows.forEach((row, i) => {
      if (!row || typeof row !== 'object') { error(`rows.${i}`, '시간 기록 형식이 올바르지 않아요.'); return; }
      if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(row.id) || ids.has(row.id)) error(`rows.${i}.id`, '시간 기록 ID가 없거나 중복되었어요.');
      ids.add(row.id);
      for (const key of ['time', 'endTime']) if (typeof row[key] !== 'string' || (row[key] !== '' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row[key]))) error(`rows.${i}.${key}`, '시간을 시:분 형식으로 입력해 주세요.');
      for (const key of METRICS) number(row[key], `rows.${i}.${key}`);
      if (row.donorCases !== undefined) {
        if (!Array.isArray(row.donorCases) || row.donorCases.length > 100) error(`rows.${i}.donorCases`, '한 시간에 세일즈 케이스는 100개까지 기록할 수 있어요.');
        else {
          const caseIds = new Set(), sums = Object.fromEntries(CASE_METRICS.map(key => [key, 0]));
          row.donorCases.forEach((item, j) => {
            const path = `rows.${i}.donorCases.${j}`;
            if (!item || typeof item !== 'object' || Array.isArray(item)) { error(path, '세일즈 케이스 형식이 올바르지 않아요.'); return; }
            if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(item.id) || caseIds.has(item.id)) error(`${path}.id`, '세일즈 케이스 ID가 없거나 중복되었어요.');
            caseIds.add(item.id);
            if (typeof item.donor !== 'boolean') error(`${path}.donor`, '후원자 여부를 체크해 주세요.');
            for (const key of CASE_METRICS) { const value = item.counts?.[key]; if (!Number.isInteger(value) || value < 0 || value > 999) error(`${path}.counts.${key}`, '케이스별 숫자는 0~999 사이의 정수여야 해요.'); else sums[key] += value; }
            text(item.note, `${path}.note`);
          });
          for (const key of CASE_METRICS) if (sums[key] > (row[key] ?? 0)) error(`rows.${i}.${key}`, `${i + 1}행 ${LABELS[key]}: 케이스 숫자의 합(${sums[key]})이 위 시간별 합계(${row[key] ?? 0})를 넘어요. 시간별 합계 또는 케이스 숫자를 확인해 주세요.`);
        }
      }
    });
  }
  text(sheet.objections, 'objections');
  if (sheet.donorObjections !== undefined) {
    const blocks = new Set(parseObjectionBlocks(sheet.objections));
    if (!Array.isArray(sheet.donorObjections) || sheet.donorObjections.length > 500 || sheet.donorObjections.some(note => typeof note !== 'string' || !blocks.has(note)) || new Set(sheet.donorObjections).size !== sheet.donorObjections.length) error('donorObjections', '후원자 표시는 현재 특이사항의 문장과 일치해야 해요.');
  }
  for (const key of ['loa', 'pitch', 'attitude']) for (const polarity of ['good', 'bad']) text(sheet.review?.[key]?.[polarity], `review.${key}.${polarity}`);
  for (const key of ['createdAt', 'updatedAt']) if (typeof sheet[key] !== 'string' || !Number.isFinite(Date.parse(sheet[key]))) error(key, '기록 시간이 올바르지 않아요.');
  if (sheet.source !== undefined) errors.push(...validatePhotoSource(sheet.source));
  return { valid: !errors.length, errors };
}
export function normalizeSheet(sheet) {
  const result = validateSheet(sheet);
  if (!result.valid) { const error = new Error(result.errors[0].message); error.errors = result.errors; throw error; }
  // Copy only the documented fields; imported JSON cannot add prototype keys or executable content.
  return { version: 1, id: sheet.id, date: sheet.date, meta: Object.fromEntries(['name', 'location', 'team', 'weather', 'theme'].map(k => [k, sheet.meta[k]])), processGoals: Object.fromEntries(METRICS.slice(0, 4).map(k => [k, sheet.processGoals[k]])), goals: Object.fromEntries(METRICS.map(k => [k, sheet.goals[k]])), rows: sheet.rows.map(row => ({ id: row.id, time: row.time, endTime: row.endTime, ...Object.fromEntries(METRICS.map(k => [k, row[k]])), ...(row.donorCases === undefined ? {} : { donorCases: row.donorCases.map(item => ({ id: item.id, donor: item.donor, counts: Object.fromEntries(CASE_METRICS.map(key => [key, item.counts[key]])), note: item.note })) }) })), objections: sheet.objections, ...(sheet.donorObjections === undefined ? {} : { donorObjections: [...sheet.donorObjections] }), review: Object.fromEntries(['loa', 'pitch', 'attitude'].map(k => [k, { good: sheet.review[k].good, bad: sheet.review[k].bad }])), createdAt: sheet.createdAt, updatedAt: sheet.updatedAt, ...(sheet.source === undefined ? {} : { source: Object.fromEntries(['type', 'imageDataUrl', 'filename', 'notes', 'duplicateCount', 'dateBasis', ...(sheet.source.donorCount === undefined ? [] : ['donorCount'])].map(key => [key, sheet.source[key]])) }) };
}
export function formatDate(date) { return date.replaceAll('-', '. '); }
