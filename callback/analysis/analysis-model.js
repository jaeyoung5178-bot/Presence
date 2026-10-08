import { getDonorSummary, getMetricReading, getReviewReading, hasValues } from '../sheets/sheet-model.js?v=20261009-transcription1';
export const PERIODS = [{ id: 'week', label: '1주', days: 7 }, { id: 'month', label: '1개월', months: 1 }, { id: 'quarter', label: '3개월', months: 3 }, { id: 'half', label: '6개월', months: 6 }, { id: 'year', label: '1년', months: 12 }];
export const METRICS = [{ id: 'contact', label: 'Contact' }, { id: 'stop', label: 'Stop' }, { id: 'presentation', label: 'Presentation' }, { id: 'close', label: 'Close' }, { id: 'donors', label: '후원자' }];
// Only this alias pair has been confirmed by the owner. Never infer other surnames.
export function authorKey(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  return value ? `name:${value === '재영' ? '임재영' : value}` : 'unknown';
}
export function defaultAuthor(identity) { return identity?.uid ? (authorKey(identity.name) === 'unknown' ? 'account:unknown' : authorKey(identity.name)) : '*'; }
export function authorLabel(key) { return key === 'unknown' ? '이름 없음' : key === 'account:unknown' ? '연결 계정 · 이름 확인 필요' : key === 'name:임재영' ? '임재영 · 재영' : key.replace(/^name:/, ''); }
export function filterAuthor(records, key) { return key === '*' ? records : records.filter(record => authorKey(record.meta?.name) === key); }
const DAY = 86400000;
const date = value => new Date(`${value}T12:00:00Z`);
const iso = value => value.toISOString().slice(0, 10);
export const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+date(value)) && iso(date(value)) === value;
export function localToday(now = new Date()) { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
export function periodRange(anchor, period = 'month') {
  if (!validDate(anchor)) throw new Error('분석 기준일을 확인해 주세요.');
  const option = PERIODS.find(item => item.id === period) || PERIODS[1];
  const end = date(anchor); let start;
  if (option.days) start = new Date(+end - (option.days - 1) * DAY);
  else { const target = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - option.months, 1, 12)); const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate(); target.setUTCDate(Math.min(end.getUTCDate(), last)); start = new Date(+target + DAY); }
  const days = Math.round((end - start) / DAY) + 1;
  return { start: iso(start), end: anchor, days, previousStart: iso(new Date(+start - days * DAY)), previousEnd: iso(new Date(+start - DAY)), label: option.label };
}
function donorValue(sheet) {
  const summary = getDonorSummary(sheet);
  return { value: summary.count, basis: summary.basis };
}
export function metricValue(sheet, metric) {
  if (metric === 'donors') return donorValue(sheet).value;
  return getMetricReading(sheet, metric).value;
}
export function uniqueRecords(records) {
  const ids = new Set(), photos = new Set();
  return [...records].filter(record => validDate(record.date)).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).filter(record => { if (ids.has(record.id)) return false; ids.add(record.id); if (record.source?.type === 'photo' && record.source.imageDataUrl) { if (photos.has(record.source.imageDataUrl)) return false; photos.add(record.source.imageDataUrl); } return true; });
}
function dateBasisCounts(records) {
  return records.reduce((counts, record) => {
    if (record.source?.type === 'photo' && (record.source.dateBasis === 'capture' || record.source.dateBasis === 'unknown')) counts[record.source.dateBasis]++;
    return counts;
  }, { capture: 0, unknown: 0 });
}
function aggregate(records) {
  const days = new Set(records.map(record => record.date)).size;
  const metrics = Object.fromEntries(METRICS.map(({ id }) => {
    const known = records.map(record => ({ record, value: metricValue(record, id) })).filter(item => item.value !== null);
    const total = known.reduce((sum, item) => sum + item.value, 0), knownDays = new Set(known.map(item => item.record.date)).size;
    const transcriptionRecords = known.filter(({ record }) => id === 'donors' ? donorValue(record).basis === 'transcription' : getMetricReading(record, id).basis === 'transcription').length;
    return [id, { total: known.length ? total : null, knownRecords: known.length, missingRecords: records.length - known.length, knownDays, perDay: knownDays ? total / knownDays : null, transcriptionRecords }];
  }));
  const rates = [['contact', 'stop'], ['stop', 'presentation'], ['presentation', 'close']].map(([from, to]) => {
    const matched = records.flatMap(record => (record.rows || []).filter(row => Number.isInteger(row[from]) && Number.isInteger(row[to]) && row[from] >= 0 && row[to] >= 0));
    const photos = records.filter(record => !hasValues(record, from) && !hasValues(record, to) && getMetricReading(record, from).basis === 'transcription' && getMetricReading(record, to).basis === 'transcription');
    const numerator = matched.reduce((sum, row) => sum + row[to], 0) + photos.reduce((sum, record) => sum + metricValue(record, to), 0), denominator = matched.reduce((sum, row) => sum + row[from], 0) + photos.reduce((sum, record) => sum + metricValue(record, from), 0);
    return { from, to, rows: matched.length, photoRecords: photos.length, numerator, denominator, percent: denominator > 0 ? numerator / denominator * 100 : null, exceeds: numerator > denominator };
  });
  return { records: records.length, days, metrics, rates, dateBasis: dateBasisCounts(records), photoRecords: records.filter(record => record.source?.type === 'photo').length, transcriptionRecords: records.filter(record => record.source?.transcription).length, partialTranscriptionRecords: records.filter(record => record.source?.transcription?.status === 'partial').length, donorBasis: records.reduce((result, record) => { result[donorValue(record).basis]++; return result; }, { cases: 0, rehash: 0, photo: 0, transcription: 0, unknown: 0 }) };
}
const THEMES = {
  pitch: [
    { label: '경청과 질문', pattern: /경청|질문|듣|기다|말.*길|말.*짧/, action: '다음 필드에서 질문 하나를 한 뒤 답이 끝날 때까지 기다려 보세요. 회고에 상대의 답과 달라진 설명을 한 줄씩 남겨요.' },
    { label: '설명과 핵심 전달', pattern: /설명|핵심|피치|피칭|멘트|스토리|3\s*step|T\.?O\.?V/i, action: '가장 중요한 설명을 두 문장으로 준비해 보세요. 사용한 문장과 상대의 반응을 다음 콜백싯에 함께 적어요.' },
    { label: '질문·거절 대응', pattern: /핸들링|거절|오브젝|반론|대처|금액/, action: '반복된 질문 하나를 골라 공감 한 문장과 확인 질문 한 문장을 준비해 보세요. 실제 반응을 케이스 메모로 남겨요.' },
  ],
  attitude: [
    { label: '집중과 마음가짐', pattern: /집중|마음|마인드|멘탈|흔들|긍정|자신감/, action: '필드 시작 전에 오늘 지킬 행동 한 가지를 정하고, 중간에 한 번 확인해 보세요. 마무리 회고에는 지킨 순간을 적어요.' },
    { label: '체력과 페이스', pattern: /피곤|체력|휴식|쉬|컨디션|호흡|페이스|지치/, action: '시간 기록에 짧은 휴식 시점을 함께 표시해 보세요. 쉬기 전후의 집중 상태를 회고에 적어 나에게 맞는 페이스를 비교해요.' },
    { label: '인사와 꾸준함', pattern: /인사|밝|웃|꾸준|끝까지|포기|시도/, action: '다음 필드에서 인사와 마무리 행동을 일정하게 유지해 보세요. 잘 지킨 시간대와 어려웠던 시간대를 각각 남겨요.' },
  ],
};
function reviewAnalysis(records, category) {
  const entries = records.flatMap(record => ['good', 'bad'].map(kind => ({ id: record.id, date: record.date, dateBasis: record.source?.type === 'photo' ? record.source.dateBasis : 'written', kind, ...getReviewReading(record, category, kind) })).filter(item => item.text));
  const themes = THEMES[category].map(theme => { const evidence = entries.filter(item => theme.pattern.test(item.text)); return { label: theme.label, action: theme.action, count: new Set(evidence.map(item => item.id)).size, improvementCount: new Set(evidence.filter(item => item.kind === 'bad').map(item => item.id)).size, evidence: evidence.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2) }; }).filter(theme => theme.count).sort((a, b) => b.improvementCount - a.improvementCount || b.count - a.count);
  return { coverage: new Set(entries.map(item => item.id)).size, transcriptionCoverage: new Set(entries.filter(item => item.basis === 'transcription').map(item => item.id)).size, good: entries.filter(item => item.kind === 'good').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), bad: entries.filter(item => item.kind === 'bad').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), themes, suggestions: themes.filter(theme => theme.improvementCount).slice(0, 2) };
}
export function analyze(records, anchor = localToday(), period = 'month') {
  const all = uniqueRecords(records), range = periodRange(anchor, period);
  const currentRecords = all.filter(record => record.date >= range.start && record.date <= range.end), previousRecords = all.filter(record => record.date >= range.previousStart && record.date <= range.previousEnd);
  const current = aggregate(currentRecords), previous = aggregate(previousRecords);
  const trend = [];
  for (let stamp = +date(range.start); stamp <= +date(range.end); stamp += DAY) {
    const day = iso(new Date(stamp)), records = currentRecords.filter(record => record.date === day);
    trend.push({ date: day, records: records.length, dateBasis: dateBasisCounts(records), ...Object.fromEntries(METRICS.map(({ id }) => { const values = records.map(record => metricValue(record, id)).filter(value => value !== null); return [id, values.length ? values.reduce((a, b) => a + b, 0) : null]; })), missing: Object.fromEntries(METRICS.map(({ id }) => [id, records.filter(record => metricValue(record, id) === null).length])) });
  }
  return { range, current, previous, trend, latest: all.map(record => record.date).sort().at(-1) || null, totalRecords: all.length, reviews: { pitch: reviewAnalysis(currentRecords, 'pitch'), attitude: reviewAnalysis(currentRecords, 'attitude') } };
}
