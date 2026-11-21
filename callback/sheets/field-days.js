// Read-only comparison rules shared by the workbook calendar and callback archive.
// A saved sales zero is a work day; a default/empty callback session is not a record.
export const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const normalizedName = value => String(value || '').replace(/\s+/g, '');
export const salesNameKey = value => String(value || '').trim().replace(/[.#$\/\[\]]/g, '_');
export function workbookToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const at = type => parts.find(part => part.type === type).value;
  return `${at('year')}-${at('month')}-${at('day')}`;
}
const values = value => value && typeof value === 'object' ? Object.values(value) : [];
const text = value => typeof value === 'string' && !!value.trim();
const firebaseKey = value => String(value).replace(/[.$#\[\]\/]/g, '_');
const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function monthDates(month, today) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !validDate(today)) throw new Error('확인할 날짜가 올바르지 않아요.');
  const [year, number] = month.split('-').map(Number), last = new Date(year, number, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter(date => date <= today);
}

export function isWorkedDay(entry, { date, name, firstField = '', today } = {}) {
  if (!validDate(date) || !validDate(today) || date > today || (validDate(firstField) && date < firstField)) return false;
  if (!entry || typeof entry !== 'object' || entry.cleared === true || entry.na || entry.rally) return false;
  if (entry.name != null && normalizedName(entry.name) !== normalizedName(name)) return false;
  return Number(entry.count) > 0 || entry.checked === true;
}

export function firstFieldFromSurveys(surveys) {
  for (const survey of values(surveys)) if (validDate(survey?.answers?.firstField)) return survey.answers.firstField;
  return '';
}

export function legacyRecordStatus(session, date, name) {
  if (!session) return 'missing';
  if (typeof session !== 'object' || Array.isArray(session)) return 'unknown';
  if (session.deleted === true) return 'missing';
  if ((session.info?.date && session.info.date !== date) || (session.info?.name && normalizedName(session.info.name) !== normalizedName(name))) return 'unknown';
  const tomb = session.tomb && typeof session.tomb === 'object' ? session.tomb : {};
  const alive = key => !tomb[key] && !tomb[firebaseKey(key)];
  const log = values(session.logs).some(row => row && ['contact', 'stop', 'presentation', 'close', 'rehash', 'fail'].includes(row.type)
    && stamp(row.t) && alive(`l:${row.t}|${row.type}`));
  const objection = values(session.objections).some(row => row && stamp(row.t) && alive(`o:${row.t}`)
    && (text(row.type) || values(row.reasons).some(text)));
  const rehash = values(session.rehashes).some(row => row && stamp(row.t) && alive(`r:${row.t}`)
    && ['name', 'amount', 'pay', 'code', 'note', 'memory', 'next', 'remark'].some(key => text(row[key]) || (typeof row[key] === 'number' && row[key] > 0)));
  const review = ['number', 'skill', 'attitude'].some(key => text(session.retro?.[key]?.good) || text(session.retro?.[key]?.bad));
  return log || objection || rehash || review ? 'legacy' : 'missing';
}

export function paperRecordStatus(record) {
  if (!record || !validDate(record.date) || record.deleted) return 'missing';
  if (record.source?.type === 'photo') return record.source.dateBasis === 'written' ? 'paper' : 'unknown';
  const hasCounts = values(record.rows).some(row => ['contact', 'stop', 'presentation', 'close', 'rehash'].some(key => Number.isInteger(row?.[key]) && row[key] >= 0));
  const hasCases = values(record.rows).some(row => values(row?.donorCases).some(item => item?.donor || text(item?.note)));
  const hasReview = ['loa', 'pitch', 'attitude'].some(key => text(record.review?.[key]?.good) || text(record.review?.[key]?.bad));
  return hasCounts || hasCases || hasReview || text(record.objections) ? 'paper' : 'missing';
}

export function compareFieldDays(days, records, { archiveConfirmed = false, archivePending = false } = {}) {
  return days.map(day => {
    const group = records.filter(record => record.date === day.date), states = group.map(paperRecordStatus);
    const paper = states.includes('paper'), uncertain = states.includes('unknown');
    // A failed read can never turn into a missing/late submission badge.
    const recordStatus = paper ? 'paper' : day.legacyStatus === 'legacy' ? 'legacy'
      : uncertain || day.legacyStatus === 'unknown' || !archiveConfirmed ? 'unknown' : 'missing';
    return { ...day, recordStatus, localPending: paper && archivePending };
  });
}
