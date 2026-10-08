export const METRICS = ['contact', 'stop', 'presentation', 'close', 'rehash'];
export const ROW_METRICS = METRICS;
export const LABELS = { contact: 'Contact', stop: 'Stop', presentation: 'Presentation', close: 'Close', rehash: 'Rehash' };
export const MAX_ROWS = 60;
export function makeId() { return globalThis.crypto?.randomUUID?.() || `sheet-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function createRow() { return { id: makeId(), time: '', endTime: '', ...Object.fromEntries(METRICS.map(key => [key, null])) }; }
export function createSheet(now = new Date()) {
  return { version: 1, id: makeId(), date: localDate(now), meta: { name: '', location: '', team: '', weather: '', theme: '' }, processGoals: { contact: '', stop: '', presentation: '', close: '' }, goals: Object.fromEntries(METRICS.map(key => [key, null])), rows: Array.from({ length: 10 }, createRow), objections: '', review: { loa: { good: '', bad: '' }, pitch: { good: '', bad: '' }, attitude: { good: '', bad: '' } }, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}
export function getTotals(sheet) { return Object.fromEntries(METRICS.map(key => [key, sheet.rows.reduce((sum, row) => sum + (Number.isInteger(row[key]) ? row[key] : 0), 0)])); }
export function hasValues(sheet, key) { return sheet.rows.some(row => row[key] !== null && row[key] !== undefined); }
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
    });
  }
  text(sheet.objections, 'objections');
  for (const key of ['loa', 'pitch', 'attitude']) for (const polarity of ['good', 'bad']) text(sheet.review?.[key]?.[polarity], `review.${key}.${polarity}`);
  for (const key of ['createdAt', 'updatedAt']) if (typeof sheet[key] !== 'string' || !Number.isFinite(Date.parse(sheet[key]))) error(key, '기록 시간이 올바르지 않아요.');
  return { valid: !errors.length, errors };
}
export function normalizeSheet(sheet) {
  const result = validateSheet(sheet);
  if (!result.valid) { const error = new Error(result.errors[0].message); error.errors = result.errors; throw error; }
  // Copy only the documented fields; imported JSON cannot add prototype keys or executable content.
  return { version: 1, id: sheet.id, date: sheet.date, meta: Object.fromEntries(['name', 'location', 'team', 'weather', 'theme'].map(k => [k, sheet.meta[k]])), processGoals: Object.fromEntries(METRICS.slice(0, 4).map(k => [k, sheet.processGoals[k]])), goals: Object.fromEntries(METRICS.map(k => [k, sheet.goals[k]])), rows: sheet.rows.map(row => ({ id: row.id, time: row.time, endTime: row.endTime, ...Object.fromEntries(METRICS.map(k => [k, row[k]])) })), objections: sheet.objections, review: Object.fromEntries(['loa', 'pitch', 'attitude'].map(k => [k, { good: sheet.review[k].good, bad: sheet.review[k].bad }])), createdAt: sheet.createdAt, updatedAt: sheet.updatedAt };
}
export function formatDate(date) { return date.replaceAll('-', '. '); }
