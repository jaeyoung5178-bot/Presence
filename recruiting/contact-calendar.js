import { validDate, range } from './model.js?v=20261025-5';

// Only a single plain recipient is allowed: never accept URI parameters or separators.
export function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return '';
  let number = raw.replace(/[\s().-]/g,'');
  if (number.startsWith('+82')) { number = '+82' + number.slice(3).replace(/^0/,''); if (!/^\+82\d{8,11}$/.test(number)) return ''; }
  else if (number.startsWith('+')) { if (!/^\+[1-9]\d{7,14}$/.test(number)) return ''; }
  else if (!/^0\d{8,11}$/.test(number)) return '';
  return number;
}
export const smsRecipient = candidate => normalizePhone(candidate?.mobile) || normalizePhone(candidate?.phone);
export const smsHref = candidate => { const recipient = smsRecipient(candidate); return recipient ? `sms:${recipient}` : ''; };
export function interviewBookings(candidates) {
  return candidates.filter(c => !c.deleted && validDate(c.interviewDate) && ['booked','showed','starter','noShow'].includes(c.status))
    .sort((a,b) => `${a.interviewDate}${a.interviewTime || '99:99'}`.localeCompare(`${b.interviewDate}${b.interviewTime || '99:99'}`) || String(a.name || '').localeCompare(String(b.name || '')) || String(a.id).localeCompare(String(b.id)));
}
export function calendarDays(anchor, view = 'month') {
  const day = validDate(anchor) ? anchor : '2000-01-01';
  const window = range(day,view === 'week' ? 'week' : 'month');
  const start = new Date(`${window.start}T00:00:00Z`), end = new Date(`${window.end}T00:00:00Z`);
  if (view !== 'week') { start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7)); end.setUTCDate(end.getUTCDate()+((7-end.getUTCDay())%7)); }
  const days = []; for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate()+1)) days.push(cursor.toISOString().slice(0,10));
  return days;
}
export function shiftCalendar(anchor, view, direction) {
  const date = new Date(`${anchor}T00:00:00Z`);
  if (view === 'week') date.setUTCDate(date.getUTCDate()+direction*7);
  else { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth()+direction); }
  return date.toISOString().slice(0,10);
}
