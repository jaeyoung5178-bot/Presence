import { validDate, range, normalizeContactPhone } from './model.js?v=20261118-training1';

// Only a single plain recipient is allowed: never accept URI parameters or separators.
export const normalizePhone = normalizeContactPhone;
export const smsRecipient = candidate => normalizePhone(candidate?.mobile) || normalizePhone(candidate?.phone);
export function smsHref(candidate,body='',platform='') {
  const recipient=smsRecipient(candidate);if(!recipient)return '';
  const text=String(body||'');if(!text)return `sms:${recipient}`;
  const agent=platform||globalThis.navigator?.userAgent||'';
  const ios=/iPad|iPhone|iPod/i.test(agent)||(!platform&&globalThis.navigator?.platform==='MacIntel'&&globalThis.navigator?.maxTouchPoints>1);
  // Compose-body support varies by messaging app. Keep the separate copy action available.
  const wellFormed=text.toWellFormed?text.toWellFormed():text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'\uFFFD');
  return `sms:${recipient}${ios?'&':'?'}body=${encodeURIComponent(wellFormed)}`;
}
export function interviewBookings(candidates) {
  return candidates.filter(c => !c.deleted && validDate(c.interviewDate) && ['booked','showed','starter','noShow'].includes(c.status))
    .sort((a,b) => `${a.interviewDate}${a.interviewTime || '99:99'}`.localeCompare(`${b.interviewDate}${b.interviewTime || '99:99'}`) || String(a.name || '').localeCompare(String(b.name || '')) || String(a.id).localeCompare(String(b.id)));
}
export function calendarEvents(candidates){
 const items=interviewBookings(candidates).map(candidate=>({key:`interview:${candidate.id}:${candidate.interviewDate}`,type:'interview',candidateId:candidate.id,name:candidate.name,date:candidate.interviewDate,time:/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.interviewTime||'')?candidate.interviewTime:'',label:'면접',status:candidate.status}));
 for(const candidate of candidates){
  if(candidate.deleted)continue;
  if(validDate(candidate.trainingDate||'')&&candidate.trainingStatus!=='cancelled')items.push({key:`training:${candidate.id}:${candidate.trainingDate}`,type:'training',candidateId:candidate.id,name:candidate.name,date:candidate.trainingDate,time:/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.trainingTime||'')?candidate.trainingTime:'',place:candidate.trainingPlace||'',label:candidate.trainingStatus==='completed'?'교육 완료':'교육 예정',status:candidate.trainingStatus||'planned'});
  if(validDate(candidate.plannedWorkDate||''))items.push({key:`work:${candidate.id}:${candidate.plannedWorkDate}`,type:'work',candidateId:candidate.id,name:candidate.name,date:candidate.plannedWorkDate,time:'',label:'근무 예정',status:'planned'});
 }
 return items.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99:99').localeCompare(b.time||'99:99')||a.key.localeCompare(b.key));
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
