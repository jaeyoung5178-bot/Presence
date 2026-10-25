// Presence Workbook daily sales are `count`; weekly CL/SW reject/resubmit fields
// are compensation evidence and must never be added to daily sales.
const DAY = 86400000;
const nameKey = value => String(value || '').trim().replace(/\s/g, '').replace(/[.#$\/\[\]]/g, '_');
const idsOf = value => [value?.id,value?.uid,value?.sourceId].filter(Boolean).map(String);
function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0,10) === value ? value : '';
}
const shift = (date, n) => new Date(+new Date(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0,10);
const amount = value => value !== null && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
function todayInSeoul(value) {
  if (dateOnly(value)) return value;
  const d = value === undefined ? new Date() : new Date(value);
  if (!Number.isFinite(+d)) throw new TypeError('Invalid today');
  return new Date(+d + 9 * 3600000).toISOString().slice(0,10);
}
function flatten(raw) {
  const rows = [];
  for (const [key, value] of Object.entries(raw || {})) {
    if (!value || typeof value !== 'object') continue;
    const parts = key.split('|');
    if (value.date || parts.length > 1) rows.push({...value,date:dateOnly(value.date || parts[0]),_identity:parts[1] || ''});
    else if (dateOnly(key)) for (const [identity, row] of Object.entries(value)) {
      if (row && typeof row === 'object') rows.push({...row,date:dateOnly(row.date || key),_identity:identity});
    }
  }
  return rows;
}
function summarize(days) {
  const known = days.filter(day => day.recorded);
  const total = known.length ? known.reduce((sum,day) => sum + day.sales,0) : null;
  return {start:days[0].date,end:days.at(-1).date,total,average:known.length ? total / known.length : null,recordedDays:known.length};
}
/** Read-only, calendar-day actual sales. Missing days stay null, recorded zero stays 0. */
export function buildRecentSales(state = {}, member = {}, {today} = {}) {
  const through = todayInSeoul(today);
  const identities = new Set(idsOf(member));
  const users = Object.entries(state.users || {}).map(([key,user]) => ({...user,_key:key}));
  const matched = users.filter(user => [user._key,...idsOf(user)].some(id => identities.has(id)));
  for (const user of matched) for (const id of [user._key,...idsOf(user)]) identities.add(id);
  const names = new Set([member.name,...matched.map(user => user.name)].filter(Boolean).map(nameKey));
  const ambiguous = new Set(users.filter(user => !matched.includes(user) && ![user._key,...idsOf(user)].some(id => identities.has(id))).map(user => nameKey(user.name)));
  const belongs = row => {
    const explicit = [row.uid,row.userId,row.memberId,row.sourceId].filter(Boolean).map(String);
    if (explicit.length) return explicit.some(id => identities.has(id));
    if (identities.has(row._identity)) return true;
    const name = nameKey(row.name || row._identity);
    return names.has(name) && !ambiguous.has(name);
  };
  const user = matched[0];
  const surveyDate = Object.values(user?.surveys || {}).map(survey => dateOnly(survey?.answers?.firstField)).find(Boolean);
  const info = Object.entries(state.memberInfo || {}).find(([key,value]) => names.has(nameKey(value?.name || key)))?.[1];
  const firstField = surveyDate || dateOnly(info?.join);
  // Dictionary aliases are alternative snapshots of the same campaign/day cell.
  // Explicit campaign IDs/types distinguish multiple campaign records.
  const cells = new Map();
  for (const row of flatten(state.sales).filter(belongs)) {
    if (!row.date || row.date > through || (firstField && row.date < firstField)) continue;
    const campaign = String(row.campaignId || row.campaign || row.type || 'daily');
    const key = `${row.date}|${campaign}`;
    const prior = cells.get(key);
    if (!prior || Number(row.updatedAt ?? row.t ?? 0) >= Number(prior.updatedAt ?? prior.t ?? 0)) cells.set(key,row);
  }
  const days = Array.from({length:30},(_,i) => {
    const date = shift(through,i - 29);
    const records = [...cells.values()].filter(row => row.date === date && !row.na && !row.rally && !row.excluded && row.cleared !== true && amount(row.count) !== null).map(row => {
      const {_identity,...record} = row;
      return {...record,count:amount(row.count)};
    });
    return {date,sales:records.length ? records.reduce((sum,row) => sum + row.count,0) : null,recorded:records.length > 0,records};
  });
  const padding = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const grid = [...Array(padding).fill(null),...days];
  while (grid.length % 7) grid.push(null);
  const sevenDays = days.slice(-7);
  return {today:through,unit:'건',sevenDays,recent7:summarize(sevenDays),calendar30:{start:days[0].date,end:through,days,weeks:Array.from({length:grid.length / 7},(_,i) => grid.slice(i * 7,i * 7 + 7))},summary30:summarize(days)};
}
