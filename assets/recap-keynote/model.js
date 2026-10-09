// Recap is a snapshot of workbook evidence. Unknown is always null, never zero.
export const chapters = [
  ['PERFORMANCE', '성과'], ['RECRUITING', '리쿠르팅'], ['TEAM QUALITY', '팀 퀄리티'],
  ['WINS', '잘한 점'], ['CHALLENGES', '개선 과제'], ['LEARNING PLAN', '러닝 플랜'],
  ['TEAM TREE', '팀 트리'], ['PROMOTION GOAL', '프로모션 골'], ['OVERVIEW', '전체 종합'],
];
export const views = [
  {id:'sales',c:0,title:'Sales & AVG'}, {id:'weekly',c:0,title:'Weekly Sales'},
  {id:'income',c:0,title:'Income & Reject'}, {id:'recruit',c:1,title:'Recruiting'},
  {id:'rank',c:1,title:'Recruiter Ranking'}, {id:'qc',c:2,title:'Quality Control'},
  {id:'wins',c:3,title:'Wins'}, {id:'challenges',c:4,title:'Challenges'},
  {id:'callback',c:5,title:'Callback'}, {id:'learning',c:5,title:'Learning'},
  {id:'ic',c:5,title:'IC Development'}, {id:'tree',c:6,title:'Team Tree'},
  {id:'promotion',c:7,title:'Promotion'}, {id:'overview',c:8,title:'Next Month'},
];

export const id = () => globalThis.crypto?.randomUUID?.() || `r${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
export const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export const nk = value => String(value ?? '').replace(/[.#$\/\[\]\s]/g, '_');
export function num(value) {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export const sum = (values = [], mapper = x => x) => values.reduce((n, x, i) => n + (num(mapper(x, i)) ?? 0), 0);
export const fmt = value => num(value) == null ? '—' : num(value).toLocaleString('ko-KR', {maximumFractionDigits:2});
export const money = value => num(value) == null ? '—' : `₩${Math.round(num(value)).toLocaleString('ko-KR')}`;
export const pct = value => num(value) == null ? '—' : `${num(value).toFixed(1)}%`;
export const ratio = (a, b) => num(a) == null || !(num(b) > 0) ? null : num(a) / num(b) * 100;
const avg = (a, b) => num(a) == null || !(num(b) > 0) ? null : num(a) / num(b);
const arr = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const dateString = d => d.toISOString().slice(0, 10);
const monthValid = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''));
const dateOnly = value => {
  const s = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(+d) && dateString(d) === s ? s : '';
};
const totalKnown = values => values.length && values.every(v => num(v) != null) ? sum(values) : null;
const rejectKeys = ['cl', 'sw', 'clResub', 'swResub'];
const rejectRow = row => {
  if (!row || typeof row !== 'object') return null;
  return {cl:num(row.cl ?? row.rejectCLCount ?? row.clReject ?? row.reject),
    sw:num(row.sw ?? row.rejectSWCount ?? row.swReject),
    clResub:num(row.clResub ?? row.resubmitCLCount ?? row.resub),
    swResub:num(row.swResub ?? row.resubmitSWCount),
    ...(num(row.rawTotal) != null ? {rawTotal:num(row.rawTotal)} : {}),
    ...(num(row.resubTotal) != null ? {resubTotal:num(row.resubTotal)} : {})};
};
const rejectTotals = row => ({
  raw:row && num(row.cl) != null && num(row.sw) != null ? num(row.cl) + num(row.sw) : num(row?.rawTotal),
  resub:row && num(row.clResub) != null && num(row.swResub) != null ? num(row.clResub) + num(row.swResub) : num(row?.resubTotal),
});

export function monthShift(month, n) {
  if (!monthValid(month)) throw new Error('올바른 월을 선택해 주세요.');
  const [y, m] = month.split('-').map(Number);
  return dateString(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
}
export function schedule(month) {
  if (!monthValid(month)) throw new Error('올바른 월을 선택해 주세요.');
  const [y, m] = month.split('-').map(Number), weeks = [];
  for (let d = new Date(Date.UTC(y, m - 1, 1)); d.getUTCMonth() === m - 1; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 5) continue;
    const shift = n => dateString(new Date(+d + n * 86400000));
    weeks.push({pay:shift(0), we:shift(-5), start:shift(-11), end:shift(-5), label:`W${weeks.length + 1}`});
  }
  return weeks;
}

function byName(source, name) {
  const key = nk(name);
  return source?.[key] ?? source?.[name] ?? Object.entries(source || {}).find(([k]) => nk(k) === key)?.[1] ?? {};
}
export function inheritTeams(people = [], tree = people) {
  const nodes = new Map(arr(tree).map(node => [node.id,node]));
  return arr(people).map(person => {
    if (String(person.team || '').trim() || person.teamManual) return {...person};
    const seen = new Set([person.id]);
    let parent = nodes.get(person.parent), team = '';
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      if (String(parent.team || '').trim()) {team = parent.team;break;}
      if (parent.teamManual) break;
      parent = nodes.get(parent.parent);
    }
    return {...person,team};
  });
}
export function rosterFrom(state = {}) {
  const map = new Map();
  const testNames = new Set(['testbot1','testbot2','testbot3','test1','test2','test3','테스터','테스트','tester']);
  const testName = value => testNames.has(String(value || '').toLowerCase().replace(/\s/g,''));
  for (const [key, user] of Object.entries(state.users || {})) {
    if (!user?.name || user.status === 'pending') continue;
    const memberId = String(user.uid || key);
    map.set(nk(user.name), {id:memberId, uid:memberId, name:user.name, role:user.role || 'IC', status:user.status || '',
      test:user.test === true || testName(user.name) || testName(user.id)});
  }
  for (const [key, info] of Object.entries(state.memberInfo || {})) {
    if (!info || typeof info !== 'object') continue;
    const name = info.name || key, nameKey = nk(name);
    if (!map.has(nameKey)) map.set(nameKey, {id:`name_${nameKey}`, uid:'', name, role:info.role || 'IC', status:''});
  }
  const removed = new Set(arr(state.removedMembers).map(n => nk(typeof n === 'string' ? n : n?.name)));
  const roster = [...map.values()].filter(m => m.name !== '관리자' && !m.test && !testName(m.name)).map(m => {
    const info = byName(state.memberInfo, m.name), dossier = byName(state.dossier, m.name);
    return {...m, team:dossier.teamName || '', upline:dossier.upline || '',
      join:dateOnly(info.join || info.registeredAt), left:dateOnly(info.left || info.leftAt),
      removed:removed.has(nk(m.name)) || ['retired','removed','inactive'].includes(m.status)};
  });
  const ids = new Map(roster.map(m => [nk(m.name), m.id]));
  return inheritTeams(roster.map(m => ({...m, parent:ids.get(nk(m.upline)) || ''}))).sort((a,b) =>
    (a.join || '9999').localeCompare(b.join || '9999') || a.name.localeCompare(b.name, 'ko'));
}

export function flatSales(raw) {
  const rows = [];
  for (const [outer, value] of Object.entries(raw || {})) {
    if (!value || typeof value !== 'object') continue;
    if (value.date || (outer.includes('|') && ('count' in value || value.name))) {
      const [date, name] = outer.split('|');
      rows.push({...value, date:dateOnly(value.date || date), name:value.name || name || ''});
    } else if (dateOnly(outer)) {
      for (const [inner, record] of Object.entries(value)) {
        if (record && typeof record === 'object') rows.push({...record, date:dateOnly(record.date || outer), name:record.name || inner.replace(/_/g, ' ')});
      }
    }
  }
  // A workbook cell is one person's daily record, even when an import includes both formats.
  const cells = new Map();
  for (const row of rows) {
    if (!row.date || !row.name) continue;
    const key = `${nk(row.name)}|${row.date}`, previous = cells.get(key);
    if (!previous || (num(row.updatedAt ?? row.t) ?? 0) >= (num(previous.updatedAt ?? previous.t) ?? 0)) cells.set(key, row);
  }
  return [...cells.values()].sort((a,b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ko'));
}
const isField = row => !row.na && !row.rally && !row.excluded && num(row.count) != null && num(row.count) >= 0;

export function memberMetric(member = {}) {
  const scores = arr(member.scores), incomes = arr(member.incomeWeeks), rejects = arr(member.rejectWeeks);
  const sales = totalKnown(scores), days = num(member.days), income = incomes.length === scores.length ? totalKnown(incomes) : null;
  const counted = rejects.map(rejectTotals);
  const rejectComplete = counted.length > 0 && counted.length === scores.length && counted.every(r => r.raw != null && r.resub != null);
  const rawReject = rejectComplete ? sum(counted, r => r.raw) : null;
  const resub = rejectComplete ? sum(counted, r => r.resub) : null;
  const reject = rejectComplete ? Math.max(0, rawReject - resub) : null, rejectRate = ratio(reject, sales);
  const bond = num(member.bond), bep = num(member.bep);
  return {sales, total:sales, days, avg:avg(sales,days), income, knownIncome:sum(incomes),
    incomeComplete:incomes.length > 0 && incomes.length === scores.length && incomes.every(v => num(v) != null),
    knownIncomeWeeks:incomes.filter(v => num(v) != null).length, rejectComplete, rawReject, resub,
    reject, rejectRate, rate:rejectRate, raw:rawReject, alert:rejectRate != null && rejectRate > 35,
    bond, bep, bepGap:income != null && bep != null ? income - bep : null,
    bepRate:ratio(income,bep), bepMet:income != null && bep > 0 ? income >= bep : null};
}

function callbackAggregate(rows) {
  const applicable = rows.filter(r => r.days > 0), missing = applicable.filter(r => r.submitted == null).length;
  const days = sum(rows, r => r.days), knownSubmitted = sum(rows, r => r.submitted);
  return {rows, members:rows, days, submitted:missing ? null : knownSubmitted, knownSubmitted,filled:applicable.length - missing,
    rate:missing ? null : ratio(knownSubmitted, days), missing, complete:missing === 0,
    knownRate:ratio(knownSubmitted, sum(applicable.filter(r => r.submitted != null), r => r.days))};
}
export function callbackGroups(draft = {}) {
  const members = arr(draft.members), ids = new Set(members.map(m => m.id));
  const people = [...members,...arr(draft.roster).filter(m => !ids.has(m.id)).map(m => ({...m,days:0}))];
  const rows = people.map(m => {
    const submitted = num(draft.callbacks?.[m.id]);
    return {id:m.id, name:m.name, team:m.team || '미지정', days:num(m.days) ?? 0, submitted,
      rate:ratio(submitted,m.days), missing:num(m.days) > 0 && submitted == null};
  });
  const names = [...new Set(rows.map(r => r.team))];
  return {...callbackAggregate(rows), teams:names.map(name => ({name,...callbackAggregate(rows.filter(r => r.team === name))}))};
}
export function totals(draft = {}) {
  const members = arr(draft.members), metrics = members.map(memberMetric);
  const all = key => totalKnown(metrics.map(m => m[key]));
  const sales = all('sales'), days = all('days'), rawReject = all('rawReject'), resub = all('resub');
  const reject = rawReject == null || resub == null ? null : Math.max(0, rawReject - resub);
  const rejectRate = ratio(reject, sales), income = all('income'), bep = all('bep');
  return {count:members.length, sales, total:sales, days, avg:avg(sales, days), income,
    knownIncome:sum(metrics,m => m.knownIncome), incomeComplete:metrics.length > 0 && metrics.every(m => m.incomeComplete),
    rawReject, raw:rawReject, resub, reject, rejectRate, rate:rejectRate, alert:rejectRate != null && rejectRate > 35,
    rejectComplete:metrics.length > 0 && metrics.every(m => m.rejectComplete), bond:all('bond'), bep,
    bepGap:income != null && bep != null ? income - bep : null, bepRate:ratio(income,bep),
    weekly:arr(draft.weeks).map((_,i) => totalKnown(members.map(m => m.scores?.[i]))),
    weeks:arr(draft.weeks).map((_,i) => totalKnown(members.map(m => m.scores?.[i]))),
    alerts:members.filter((_,i) => metrics[i].alert),
    recruiting:recruitingSummary(draft.recruiting), callback:callbackGroups(draft)};
}

export function recruitingSummary(input) {
  const rows = arr(Array.isArray(input) ? input : input?.rows).map(row => {
    const booking = num(row.booking ?? row.booked), showup = num(row.showup), starter = num(row.starter ?? row.starters);
    return {...row,booking,booked:booking,showup,starter,starters:starter,
      absent:booking != null && showup != null ? Math.max(0,booking - showup) : null,rate:ratio(showup,booking)};
  });
  const booking = totalKnown(rows.map(r => r.booking)), showup = totalKnown(rows.map(r => r.showup)), starter = totalKnown(rows.map(r => r.starter));
  return {...(!Array.isArray(input) && input || {}),rows,booking,booked:booking,bookings:booking,showup,showups:showup,starter,starters:starter,
    absent:booking != null && showup != null ? Math.max(0,booking - showup) : null,rate:ratio(showup,booking),people:rows.length};
}

function recruitingFrom(state, month, roster) {
  const rows = roster.map(m => {
    const source = state.recruit?.[m.uid || m.id], record = source?.[month] || (source?.month === month ? source : null);
    if (!record) return null;
    const booking = num(record.bk_d), showup = num(record.su_d), starter = num(record.st_d);
    return {id:m.id,name:m.name,role:m.role,booking,booked:booking,showup,starter,starters:starter,bk_d:booking,su_d:showup,st_d:starter,
      absent:booking != null && showup != null ? Math.max(0, booking - showup) : null, rate:ratio(showup,booking)};
  }).filter(Boolean).sort((a,b) => (b.showup ?? -1) - (a.showup ?? -1) || (b.booking ?? -1) - (a.booking ?? -1));
  const booking = totalKnown(rows.map(r => r.booking)), showup = totalKnown(rows.map(r => r.showup)), starter = totalKnown(rows.map(r => r.starter));
  return {rows,booking,showup,starter,bookings:booking,showups:showup,starters:starter,
    absent:booking != null && showup != null ? Math.max(0,booking - showup) : null,
    rate:ratio(showup,booking),people:rows.length,missing:Math.max(0,roster.length - rows.length),source:'워크북 리쿠르팅 실적'};
}

export function buildLive(state = {}, month, saved = null) {
  const weeks = schedule(month), sourceRoster = rosterFrom(state), sales = flatSales(state.sales);
  const start = weeks[0].start, end = weeks.at(-1).end;
  const monthEnd = dateString(new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)));
  const roster = saved?.version === 1 || Array.isArray(saved?.roster) ? clone(arr(saved.roster)) : sourceRoster.filter(m => {
    if (m.join && m.join > monthEnd) return false;
    const hasField = sales.some(r => nk(r.name) === nk(m.name) && r.date >= start && r.date <= end && isField(r));
    const joined = m.join && m.join >= `${month}-01` && m.join <= monthEnd;
    const departed = m.left && m.left >= `${month}-01` && m.left <= monthEnd;
    return hasField || joined || departed || ((!m.join || m.join <= end) && (!m.left || m.left >= start) && (!m.removed || !!m.left));
  });
  const members = roster.map(person => {
    const m = {...person,id:person.id || person.uid || `name_${nk(person.name)}`};
    const records = sales.filter(r => nk(r.name) === nk(m.name) && isField(r));
    const periodRows = records.filter(r => r.date >= start && r.date <= end);
    const financial = weeks.map(w => state.weeklyProfitRecaps?.[w.pay]?.[m.uid || m.id] || null);
    const latestBond = [...financial].reverse().find(r => num(r?.bondBalance) != null);
    const monthlyBep = num(state.profitMonthlyBep?.[month]?.[m.uid || m.id]);
    const latestBep = [...financial].reverse().find(r => num(r?.bep) != null);
    // First-ever field days require a known join anchor. Never relabel this month's first days as onboarding.
    const firstFive = m.join ? records.filter(r => r.date >= m.join && r.date <= monthEnd).slice(0,5).map(r => ({date:r.date,sales:num(r.count)})) : [];
    return {id:m.id,uid:m.uid || '',name:m.name,role:m.role || 'IC',team:m.team || '',parent:m.parent || '',
      join:m.join || '',left:m.left || '',days:new Set(periodRows.map(r => r.date)).size,
      scores:weeks.map(w => sum(periodRows.filter(r => r.date >= w.start && r.date <= w.end),r => r.count)),
      incomeWeeks:financial.map(r => num(r?.netPayment)),rejectWeeks:financial.map(rejectRow),
      bond:num(latestBond?.bondBalance),bep:monthlyBep ?? num(latestBep?.bep),firstFive};
  });
  const events = [];
  for (const m of sourceRoster) {
    if (m.join >= `${month}-01` && m.join <= monthEnd) events.push({id:`in_${m.id}_${m.join}`,memberId:m.id,name:m.name,date:m.join,type:'In',reason:'',action:'',owner:'',status:''});
    if (m.left >= `${month}-01` && m.left <= monthEnd) events.push({id:`out_${m.id}_${m.left}`,memberId:m.id,name:m.name,date:m.left,type:'Out · 확인 필요',reason:'',action:'',owner:'',status:''});
  }
  return {weeks,members,roster,events,recruiting:recruitingFrom(state,month,roster)};
}

function snapshotTree(roster) {
  const tree = roster.map(m => ({id:m.id,name:m.name,role:m.role || 'IC',team:m.team || '',parent:m.parent || '',planned:false}));
  for (const node of tree) if (!validParent(tree,node.id,node.parent)) node.parent = '';
  return tree;
}
export function workbookTree(state = {}, fallbackRoster = []) {
  const hasSource = Object.keys(state.users || {}).length > 0 || Object.keys(state.memberInfo || {}).length > 0;
  if (!hasSource) return snapshotTree(fallbackRoster);
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const today = ['year','month','day'].map(key => parts.find(p => p.type === key).value).join('-');
  const current = rosterFrom(state).filter(m => !m.removed && (!m.left || m.left > today) && (!m.join || m.join <= today));
  return snapshotTree(current);
}
function normalizeMember(member, weeks, roster) {
  const source = roster.find(r => r.id === member.id || nk(r.name) === nk(member.name)) || {};
  return {...source,...member,id:member.id || source.id || `name_${nk(member.name)}`,team:member.team ?? source.team ?? '',
    scores:weeks.map((_,i) => num(member.scores?.[i])), incomeWeeks:weeks.map((_,i) => num(member.incomeWeeks?.[i])),
    rejectWeeks:weeks.map((_,i) => rejectRow(member.rejectWeeks?.[i])), bond:num(member.bond),bep:num(member.bep),
    days:num(member.days) ?? 0,firstFive:arr(member.firstFive).map(r => ({date:dateOnly(r.date),sales:num(r.sales)})).filter(r => r.date)};
}
export function makeDraft(state = {}, month, legacy = null) {
  if (!monthValid(month)) throw new Error('올바른 월을 선택해 주세요.');
  const old = legacy?.keynote || legacy;
  const saved = old?.version === 1 && old.month === month ? old : null;
  const live = buildLive(state,month,saved);
  const base = {version:1,month,teamName:'Presence',headline:'',leader:'',...live,
    callbacks:{},qc:{retentionWin:'',trainingHow:'',startCount:null},wins:[],challenges:[],learning:[],icPlans:{},
    tree:workbookTree(state,live.roster),promotions:[],goals:{sales:null,avg:null,recruit:null,callback:100,focus:'',actions:''},
    notes:{recruit:'',sales:''},revision:0,updatedAt:0,sourceAt:state.sourceAt || Date.now()};
  if (saved) {
    const result = {...base,...clone(saved),month,version:1};
    // Roster and tree are independent snapshots: refreshing either never rebuilds the other.
    result.roster = clone(arr(saved.roster));
    result.weeks = schedule(month);
    result.members = arr(saved.members).map(m => normalizeMember(m,result.weeks,result.roster));
    for (const key of ['wins','challenges','learning','events','promotions','tree']) result[key] = arr(saved[key]);
    result.callbacks = saved.callbacks || {};
    result.icPlans = saved.icPlans || {};
    result.qc = {...base.qc,...saved.qc}; result.goals = {...base.goals,...saved.goals}; result.notes = {...base.notes,...saved.notes};
    result.recruiting = recruitingSummary(saved.recruiting);
    return result;
  }
  if (!old || (old.month && old.month !== month)) return base;
  base.leader = old.leader || ''; base.teamName = old.teamName || base.teamName; base.headline = old.headline || old.goalTitle || '';
  base.notes.recruit = old.recruitNote || ''; base.notes.sales = old.salesNote || '';
  base.goals.focus = typeof old.goals === 'string' ? old.goals : old.goalTitle || '';
  base.goals.actions = old.actions || '';
  base.wins = arr(old.winsList).map(w => ({id:id(),title:w.title || '',win:w.win || '',how:w.how || '',next:w.next || ''}));
  if (!base.wins.length && old.wins) base.wins.push({id:id(),title:'',win:String(old.wins),how:'',next:''});
  base.challenges = arr(old.challengesList).map(c => ({id:id(),title:c.challenge || c.title || '',cause:c.cause || '',action:c.solution || c.action || '',result:c.result || '',owner:c.owner || '',due:c.due || '',status:c.status || ''}));
  if (!base.challenges.length && old.challenges) base.challenges.push({id:id(),title:String(old.challenges),cause:'',action:'',result:'',owner:'',due:'',status:''});
  if (typeof old.learning === 'string' && old.learning) base.learning.push({id:id(),track:'IC',period:'지난달 회고',title:old.learning,action:'',result:'',owner:'',due:'',status:''});
  base.promotions = arr(old.promotionPlans).map(p => ({id:id(),memberId:base.members.find(m => nk(m.name) === nk(p.name || p.parent))?.id || '',targetRole:p.role || 'LR',due:p.due || '',action:p.action || '',status:'',checks:[],legacyCount:num(p.count)}));
  if (arr(old.members).length) {
    base.members = arr(old.members).map(m => {
      const source = base.members.find(x => nk(x.name) === nk(m.name)) || {};
      return normalizeMember({...source,...m,id:source.id || m.id,
        // On the one-time migration, actual pay-date records beat stale legacy manual values.
        incomeWeeks:base.weeks.map((_,i) => source.incomeWeeks?.[i] ?? num(m.incomeWeeks?.[i]) ?? null),
        rejectWeeks:base.weeks.map((_,i) => source.rejectWeeks?.[i] || rejectRow(m.rejectWeeks?.[i]) || null),
        bond:source.bond ?? num(m.bond),bep:source.bep ?? num(m.bep)},base.weeks,base.roster);
    });
    base.roster = base.members.map(m => ({...base.roster.find(r => r.id === m.id),id:m.id,uid:m.uid || '',name:m.name,role:m.role,team:m.team,parent:m.parent || '',join:m.join || '',left:m.left || ''}));
    base.tree = workbookTree(state,base.roster);
  }
  base.migratedFrom = 'recaps/monthly';
  return base;
}

// Explicit file import only. This function contains no private data or inferred CL/SW allocation.
export function importLegacyConfirmed(data, state = {}, month) {
  if (!monthValid(month) || !Array.isArray(data?.members)) throw new Error('확정본 파일과 월을 확인해 주세요.');
  if (data.month && data.month !== month) throw new Error('확정본 월과 선택 월이 다릅니다.');
  const draft = makeDraft(state,month), liveByName = new Map(draft.members.map(m => [nk(m.name),m]));
  if (data.weeks && data.weeks.length !== draft.weeks.length) throw new Error('확정본 주차 수와 선택 월이 다릅니다.');
  if (data.weeks?.some((w,i) => w.pay && ![draft.weeks[i].pay,draft.weeks[i].pay.slice(5).replace('-','.')].includes(w.pay))) throw new Error('확정본 지급일과 선택 월이 다릅니다.');
  const imported = data.members.map(row => {
    const source = liveByName.get(nk(row.name)) || {}, memberId = source.id || `name_${nk(row.name)}`;
    return normalizeMember({...source,id:memberId,name:row.name,role:source.role || row.role || 'IC',team:source.team || '',
      days:num(row.days),scores:row.weeklySales,
      incomeWeeks:draft.weeks.map((_,i) => source.incomeWeeks?.[i] ?? num(row.weeklyIncome?.[i])),
      rejectWeeks:draft.weeks.map((_,i) => source.rejectWeeks?.[i] || {cl:null,sw:null,clResub:null,swResub:null,
        rawTotal:num(row.weeklyReject?.[i]),resubTotal:num(row.weeklyResub?.[i])}),
      bond:source.bond ?? num(row.bond),bep:source.bep ?? num(row.bep),firstFive:source.firstFive || []},draft.weeks,draft.roster);
  });
  draft.members = imported;
  const rosterNames = new Set(draft.roster.map(m => nk(m.name)));
  for (const member of imported) if (!rosterNames.has(nk(member.name))) draft.roster.push({id:member.id,name:member.name,role:member.role,team:member.team,parent:'',join:'',left:''});
  draft.tree = workbookTree(state,draft.roster);
  draft.recruiting = recruitingSummary({rows:arr(data.recruiting?.recruiters).map(row => ({...row,id:liveByName.get(nk(row.name))?.id || `name_${nk(row.name)}`,booking:num(row.booked),showup:num(row.showup),starter:num(row.starters ?? row.starter)})),source:'확정본 파일'});
  draft.qc.startCount = num(data.headcount?.monthStart);
  const eventDate = value => dateOnly(value) || dateOnly(`${month.slice(0,4)}-${String(value || '').replace('.', '-')}`);
  const eventMap = new Map(draft.events.map(e => [`${nk(e.name)}|${e.date}|${e.type === 'In' ? 'in' : 'out'}`,e]));
  for (const [key,type] of [['joins','In'],['exits','Out · 확인 필요']]) for (const row of arr(data.headcount?.[key])) {
    const date = eventDate(row.date), event = {id:id(),name:row.name,date,type,reason:'',action:'',owner:row.recruiter || '',status:''};
    eventMap.set(`${nk(row.name)}|${date}|${type === 'In' ? 'in' : 'out'}`,event);
  }
  draft.events = [...eventMap.values()];
  draft.importedFrom = 'confirmed-file';
  const errors = validate(draft);
  if (errors.length) throw new Error(errors.join('\n'));
  return draft;
}

export function validParent(tree, child, parent) {
  if (!parent) return true;
  const nodes = arr(tree), map = new Map(nodes.map(n => [n.id,n]));
  if (!map.has(parent) || child === parent) return false;
  const seen = new Set([child]);
  for (let node = map.get(parent); node; node = map.get(node.parent)) {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    if (node.parent && !map.has(node.parent)) return false;
  }
  return true;
}

export function validate(draft) {
  const errors = [];
  if (!draft || !monthValid(draft.month)) return ['올바른 월을 선택해 주세요.'];
  const weeks = schedule(draft.month), members = arr(draft.members), ids = new Set();
  if (draft.version !== 1) errors.push('지원하지 않는 리캡 형식입니다.');
  if (arr(draft.weeks).length !== weeks.length || weeks.some((w,i) => ['pay','we','start','end'].some(k => draft.weeks?.[i]?.[k] !== w[k]))) errors.push('월별 지급일과 필드 기간을 확인해 주세요.');
  for (const m of members) {
    if (!m.id || ids.has(m.id)) errors.push('팀원 ID가 누락되었거나 중복되었습니다.');
    ids.add(m.id);
    if (!m.name?.trim()) errors.push('팀원 이름을 입력해 주세요.');
    if (!Number.isInteger(num(m.days)) || num(m.days) < 0) errors.push(`${m.name}: 필드일을 확인해 주세요.`);
    const submitted = num(draft.callbacks?.[m.id]);
    if (draft.callbacks?.[m.id] != null && draft.callbacks[m.id] !== '' && submitted == null) errors.push(`${m.name}: 콜백 제출일은 숫자여야 합니다.`);
    if (submitted != null && (!Number.isInteger(submitted) || submitted < 0 || submitted > num(m.days))) errors.push(`${m.name}: 콜백 제출일은 0–${m.days}일의 정수여야 합니다.`);
    for (const field of ['scores','incomeWeeks','rejectWeeks']) if (arr(m[field]).length !== weeks.length) errors.push(`${m.name}: ${field} 주차 수가 맞지 않습니다.`);
    for (const value of [...arr(m.scores),...arr(m.incomeWeeks),m.bond,m.bep]) if (value != null && (num(value) == null || num(value) < 0)) errors.push(`${m.name}: 음수 또는 유효하지 않은 숫자가 있습니다.`);
    for (const row of arr(m.rejectWeeks)) if (row) for (const k of [...rejectKeys,'rawTotal','resubTotal']) if (row[k] != null && (!Number.isInteger(num(row[k])) || num(row[k]) < 0)) errors.push(`${m.name}: Reject 건수는 0 이상의 정수여야 합니다.`);
  }
  for (const row of callbackGroups(draft).rows) if (row.submitted != null && (!Number.isInteger(row.submitted) || row.submitted < 0 || row.submitted > row.days)) errors.push(`${row.name}: 콜백 제출일은 필드일 이하여야 합니다.`);
  const tree = arr(draft.tree), nodeIds = new Set();
  for (const node of tree) {
    if (!node.id || nodeIds.has(node.id)) errors.push('조직도 ID가 누락되었거나 중복되었습니다.');
    nodeIds.add(node.id);
    if (!node.name?.trim()) errors.push('조직도 이름을 입력해 주세요.');
    if (!validParent(tree,node.id,node.parent)) errors.push(`${node.name}: 조직도의 상위 리더 연결을 확인해 주세요.`);
  }
  for (const event of arr(draft.events)) if (!['In','Quit','Cut','Out · 확인 필요'].includes(event.type)) errors.push('입퇴사 유형을 확인해 주세요.');
  for (const row of recruitingSummary(draft.recruiting).rows) {
    for (const key of ['booking','showup','starter']) if (row[key] != null && (!Number.isInteger(row[key]) || row[key] < 0)) errors.push(`${row.name}: 리쿠르팅 실적은 0 이상의 정수여야 합니다.`);
    if (row.booking != null && row.showup != null && row.showup > row.booking) errors.push(`${row.name}: 쇼업이 부킹보다 큽니다.`);
    if (row.showup != null && row.starter != null && row.starter > row.showup) errors.push(`${row.name}: 스타터가 쇼업보다 큽니다.`);
  }
  for (const [key,value] of Object.entries(draft.goals || {})) if (['sales','avg','recruit','callback'].includes(key) && value != null && value !== '' && (num(value) == null || num(value) < 0 || (key === 'callback' && num(value) > 100))) errors.push('다음 달 목표 숫자를 확인해 주세요.');
  if (draft.qc?.startCount != null && (!Number.isInteger(num(draft.qc.startCount)) || num(draft.qc.startCount) < 0)) errors.push('월초 인원을 확인해 주세요.');
  for (const plan of Object.values(draft.icPlans || {})) for (const key of ['relate','booth','pitch','objection','agreement']) if (plan[key] != null && (num(plan[key]) == null || num(plan[key]) < 0 || num(plan[key]) > 5)) errors.push('IC 스킬 평가는 0–5 범위로 입력해 주세요.');
  return [...new Set(errors)];
}
