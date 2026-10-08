import { analyze, METRICS, localToday } from './analysis-model.js?v=20261009-transcription1';
import { readAccountIdentity } from '../sheets/cloud.js?v=20261009-transcription1';
import { validateSheet } from '../sheets/sheet-model.js?v=20261009-transcription1';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => value === null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
let records = [], period = 'month', report, request = 0, firstLoad = true, historical = false, signature = readAccountIdentity().signature;
$('#anchor-date').value = localToday();

// This page never imports the writer's storage singleton: its online listener can upload
// pending writes. Read only the current namespace in an existing IndexedDB database.
async function readLocalSheets(identity) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('presence-paper-sheets-v1'); let absent = false;
    open.onupgradeneeded = () => { absent = true; open.transaction.abort(); };
    open.onerror = () => absent ? resolve([]) : reject(new Error('저장된 기록을 읽지 못했어요. 다시 읽기를 눌러 주세요.'));
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('records')) { db.close(); resolve([]); return; }
      const tx = db.transaction('records', 'readonly'), get = tx.objectStore('records').index('namespace').getAll(identity.namespace);
      get.onsuccess = () => { const rows = get.result; db.close(); if (readAccountIdentity().signature !== identity.signature) { resolve(null); return; } resolve(rows.filter(row => !row.document?.deleted && validateSheet(row.document?.sheet).valid).map(row => row.document.sheet)); };
      get.onerror = () => { db.close(); reject(new Error('기록 목록을 읽지 못했어요. 다시 시도해 주세요.')); };
    };
  });
}
async function load() {
  const version = ++request, identity = readAccountIdentity();
  if (signature !== identity.signature) { records = []; signature = identity.signature; firstLoad = true; historical = false; $('#anchor-date').value = localToday(); $('#author-filter').innerHTML = '<option value="*">저장된 전체 기록 · 다른 작성자 포함</option>'; render(); }
  $('#refresh').disabled = true; $('#load-status').textContent = '나의 기록을 불러오는 중…'; $('#report').setAttribute('aria-busy', 'true'); $('#error').hidden = true;
  try {
    const loaded = await readLocalSheets(identity);
    if (version !== request || loaded === null || readAccountIdentity().signature !== identity.signature) return;
    records = loaded;
    const selectedAuthor = $('#author-filter').value;
    $('#author-filter').innerHTML = '<option value="*">저장된 전체 기록 · 다른 작성자 포함</option>' + [...new Set(records.map(record => record.meta?.name?.trim() || '이름 없음'))].sort().map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
    if ([...$('#author-filter').options].some(option => option.value === selectedAuthor)) $('#author-filter').value = selectedAuthor;
    if (firstLoad) { const initial = analyze(records, $('#anchor-date').value, period); if (!initial.current.records && initial.latest) { $('#anchor-date').value = initial.latest; historical = true; } firstLoad = false; }
    render(); $('#load-status').textContent = '이 브라우저에 저장된 수기·사진 콜백싯 기준';
  } catch (error) { if (version === request) { $('#error').textContent = error.message; $('#error').hidden = false; $('#load-status').textContent = '기록 읽기 실패'; } }
  finally { if (version === request) { $('#refresh').disabled = false; $('#report').setAttribute('aria-busy', 'false'); } }
}
function compare(now, before) {
  if (now.perDay === null || before.perDay === null) return '비교할 입력 기록이 부족해요';
  const diff = now.perDay - before.perDay;
  return `기록일 평균 ${diff > 0 ? '+' : ''}${number(diff)}${before.perDay > 0 ? ` (${diff > 0 ? '+' : ''}${number(diff / before.perDay * 100)}%)` : ' · 이전 평균 0'}`;
}
function render() {
  const author = $('#author-filter').value, selected = author === '*' ? records : records.filter(record => (record.meta?.name?.trim() || '이름 없음') === author);
  try { report = analyze(selected, $('#anchor-date').value, period); } catch (error) { $('#error').textContent = error.message; $('#error').hidden = false; return; }
  $('#error').hidden = true;
  const { range, current, previous } = report;
  $('#period-label').textContent = `${range.start} — ${range.end} · ${range.days}일`;
  $('#historical-notice').hidden = !historical; $('#historical-copy').textContent = `가장 최근 기록 ${$('#anchor-date').value} 기준으로 보고 있어요.`;
  $('#empty').hidden = current.records > 0; $('#report').hidden = current.records === 0;
  $('#jump-latest').hidden = !report.latest || current.records > 0;
  $('#coverage-title').textContent = `${current.days}일의 현장, ${current.records}개의 콜백싯`;
  $('#coverage-detail').textContent = `선택한 ${range.days}일 중 기록 ${current.days}일 · 사진 원본 ${current.photoRecords}개 중 읽어낸 기록 ${current.transcriptionRecords}개${current.partialTranscriptionRecords ? ` (일부 판독 ${current.partialTranscriptionRecords}개)` : ''} · 저장된 전체 기록 ${report.totalRecords}개`;
  $('#comparison-period').textContent = `이전 비교: ${range.previousStart} — ${range.previousEnd} (${previous.days}일 · ${previous.records}개 기록)`;
  $('#metrics').innerHTML = METRICS.map(({ id, label }) => { const now = current.metrics[id], before = previous.metrics[id]; return `<article class="metric-card"><h3>${label}</h3><div class="metric-number">${number(now.total)}<small>${id === 'donors' ? '명' : '회'}</small></div><p>${now.knownRecords}/${current.records}개 확인${now.missingRecords ? ` · ${now.missingRecords}개 미확인` : ''}${now.transcriptionRecords ? `<br>사진에서 읽은 합계 ${now.transcriptionRecords}개 포함` : ''}<br>기록일 평균 ${number(now.perDay)} · ${now.knownDays}일 기준</p><p class="comparison">${compare(now, before)}<br>이전 평균 ${number(before.perDay)} · ${before.knownDays}일 기준</p></article>`; }).join('');
  $('#rates').innerHTML = current.rates.map(rate => `<article class="rate"><h3>${rate.from === 'contact' ? 'Contact → Stop' : rate.from === 'stop' ? 'Stop → Presentation' : 'Presentation → Close'}</h3><strong>${rate.percent === null ? '—' : number(rate.percent) + '%'}</strong><p>${number(rate.numerator)} / ${number(rate.denominator)} · 시간별 입력 ${rate.rows}행 · 사진 합계 ${rate.photoRecords}개${rate.exceeds ? '<br>뒷 단계가 더 많아요. 입력 기준을 확인해 주세요.' : ''}</p></article>`).join('');
  $('#source-detail').textContent = `이번 기간 후원자 근거: 체크된 케이스·특이사항 ${current.donorBasis.cases}개 기록 · 입력 Rehash ${current.donorBasis.rehash}개 · 사진 확인값 ${current.donorBasis.photo}개 · 사진 전사 Rehash ${current.donorBasis.transcription}개 · 미확인 ${current.donorBasis.unknown}개. 자동 기록 도구의 세션은 이 분석에 아직 합산하지 않아요. 다른 기기의 기록은 콜백싯 열람에서 동기화한 뒤 다시 읽어 주세요.`;
  renderChart(); renderReview('pitch', 'Pitch · Skill', '설명과 대화에서 발견한 것'); renderReview('attitude', 'Attitude · Mental', '필드에 임하는 나의 태도');
}
function renderChart() {
  if (!report) return;
  const metric = $('#chart-metric').value, label = METRICS.find(item => item.id === metric).label;
  const points = report.trend, known = points.filter(item => item[metric] !== null), max = Math.max(1, ...known.map(item => item[metric]));
  const w = 900, h = 220, left = 42, right = 16, top = 18, bottom = 36;
  const x = i => left + i / Math.max(1, points.length - 1) * (w - left - right), y = value => top + (1 - value / max) * (h - top - bottom);
  let line = '', connected = false;
  points.forEach((item, i) => { if (item[metric] === null) { connected = false; return; } line += `${connected ? 'L' : 'M'}${x(i)},${y(item[metric])} `; connected = true; });
  $('#chart-summary').textContent = `${label} · 수치가 입력된 ${known.length}일${known.length ? ` · 하루 최대 ${number(Math.max(...known.map(item => item[metric])))}${metric === 'donors' ? '명' : '회'}` : ' · 아직 입력값이 없어요'}`;
  $('#chart').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)} 날짜별 추이. 정확한 값은 아래 수치 표에서 확인할 수 있어요."><title>${esc(label)} 날짜별 추이</title>${[0, .5, 1].map(fraction => `<line x1="${left}" x2="${w-right}" y1="${y(max*fraction)}" y2="${y(max*fraction)}" stroke="#354a3d"/><text class="chart-label" text-anchor="end" x="${left-9}" y="${y(max*fraction)+4}">${number(max*fraction)}</text>`).join('')}<path d="${line}" fill="none" stroke="#d3e6af" stroke-width="2.5"/>${points.map((item,i) => item[metric] === null ? '' : `<circle cx="${x(i)}" cy="${y(item[metric])}" r="3.5" fill="${item.missing[metric] ? '#dfba89' : '#d3e6af'}"><title>${item.date}: ${number(item[metric])}${item.missing[metric] ? ' + 미확인 기록' : ''}</title></circle>`).join('')}<text class="chart-label" x="${left}" y="${h-8}">${report.range.start}</text><text class="chart-label" text-anchor="end" x="${w-right}" y="${h-8}">${report.range.end}</text></svg>`;
  $('#trend-rows').innerHTML = points.filter(item => item.records).map(item => `<tr><td>${item.date}</td>${METRICS.map(({ id }) => `<td>${number(item[id])}${item.missing[id] && item[id] !== null ? ' + 미확인' : ''}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6">입력된 기록이 없어요.</td></tr>';
}
function quote(entry) { return `<blockquote class="quote"><p>${esc(entry.text)}</p><footer>${entry.date} · ${entry.kind === 'good' ? '잘한 점 (+)' : '개선할 점 (−)'} · ${entry.basis === 'transcription' ? '원본 사진에서 읽음' : '직접 입력'}</footer></blockquote>`; }
function renderReview(key, title, subtitle) {
  const review = report.reviews[key], container = $(`#${key}-review`);
  container.innerHTML = `<p class="eyebrow">${title.toUpperCase()}</p><h2>${subtitle}</h2><p class="review-caption">${report.current.records}개 기록 중 회고 ${review.coverage}개 · 문장에 나타난 주제별 정리</p>${review.themes.length ? `<div class="theme-chips">${review.themes.map(theme => `<span>${theme.label} · ${theme.count}개 기록</span>`).join('')}</div>` : ''}${review.coverage ? `<div class="review-block"><h3>계속 가져갈 점</h3>${review.good.map(quote).join('') || '<p class="review-empty">잘한 점에 입력된 내용이 없어요.</p>'}</div><div class="review-block"><h3>다음에 다듬을 점</h3>${review.bad.map(quote).join('') || '<p class="review-empty">개선할 점에 입력된 내용이 없어요.</p>'}</div><div class="review-block"><h3>기록을 바탕으로 해볼 연습</h3>${review.suggestions.map(theme => `<article class="practice"><strong>${theme.label}</strong><p>${theme.action}</p><small>근거: 개선 회고 ${theme.improvementCount}개 · ${theme.evidence.filter(item => item.kind === 'bad').map(item => item.date).join(', ') || '위 개선 회고'}</small></article>`).join('') || `<p class="review-empty">${review.bad.length ? '위 개선 회고에서 다음 필드에 바꿀 행동 하나를 정해 보세요. 다음 기록에 실행 여부와 실제 반응을 적으면 비교하기 쉬워요.' : '잘한 점 중 다음 필드에도 유지할 행동을 하나 골라 보세요. 개선할 점은 실제로 관찰한 내용이 생겼을 때 남겨요.'}</p>`}</div>` : '<p class="review-empty">이 기간에는 옮겨 적은 회고가 없어요. 사진 속 손글씨를 자동으로 읽었다고 가정하지 않습니다. 콜백싯의 잘한 점·개선할 점을 입력하면 근거와 함께 정리해 드려요.</p>'}`;
  container.querySelector('.review-caption').textContent += ` · 원본 사진에서 읽은 회고 ${review.transcriptionCoverage}개 포함`;
  if (!review.coverage) container.querySelector('.review-empty').textContent = '이 기간에는 판독되거나 직접 입력된 회고가 없어요. 읽지 못한 손글씨의 내용을 추측하지 않아요.';
}
document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => { period = button.dataset.period; document.querySelectorAll('[data-period]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); render(); }));
$('#anchor-date').addEventListener('change', () => { historical = false; render(); }); $('#anchor-today').addEventListener('click', () => { historical = false; $('#anchor-date').value = localToday(); render(); }); $('#chart-metric').addEventListener('change', renderChart); $('#refresh').addEventListener('click', load);
$('#jump-latest').addEventListener('click', () => { if (report?.latest) { $('#anchor-date').value = report.latest; render(); } });
$('#author-filter').addEventListener('change', render);
window.addEventListener('storage', event => { if (['fcos_hub_identity', 'fcos_callback_access_key', 'fcos_personal_launch_v2', null].includes(event.key)) load(); });
window.addEventListener('focus', () => { if (signature !== readAccountIdentity().signature) load(); });
load();
