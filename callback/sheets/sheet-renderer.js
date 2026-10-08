import { METRICS, getTotals, hasValues } from './sheet-model.js?v=20261008-calendar1';

const WIDTH = 900, MARGIN = 48, INNER = WIDTH - MARGIN * 2;
export const INK = '#292c2a', DONOR_INK = '#b13e43';
const GRAPHITE = '#555954', PAPER = '#fffef9';
export const PRINTED_EXAMPLES = ['Ex) 유니세프 하는 중', 'Ex) swp2400001/카드/3만/', '71년생 어머님/ 자모후'];
let fontsReady;
export function loadPaperFonts() {
  return fontsReady ||= document.fonts.load('24px "Callback Hand"').catch(() => []).then(() => document.fonts.ready);
}
function pen(ctx, size = 24) { ctx.font = `${size}px "Callback Hand", "Apple SD Gothic Neo", sans-serif`; ctx.fillStyle = INK; }
function print(ctx, size = 14, weight = 500) { ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Arial, sans-serif`; ctx.fillStyle = '#2e3535'; }
// Character-based wrapping also handles Korean and a long URL without clipping.
function wrap(ctx, value, width) {
  const lines = [];
  for (const paragraph of String(value || '').replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const letter of Array.from(paragraph)) {
      if (line && ctx.measureText(line + letter).width > width) { lines.push(line); line = letter; } else line += letter;
    }
    lines.push(line);
  }
  return lines;
}
function handLines(ctx, lines, x, y, lineHeight = 25, size = 24, color = INK) { pen(ctx, size); ctx.fillStyle = color; lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight)); }
function line(ctx, x, y, x2, y2, color = GRAPHITE, width = 1) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
function box(ctx, x, y, width, height, fill) { if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, width, height); } ctx.strokeStyle = GRAPHITE; ctx.lineWidth = .8; ctx.strokeRect(x, y, width, height); }
function centered(ctx, text, x, y) { const previous = ctx.textAlign; ctx.textAlign = 'center'; ctx.fillText(text, x, y); ctx.textAlign = previous; }

/** True 正 stroke order: top, centre down, centre-right, left down, baseline. */
export function tallyStrokes(count) {
  if (!Number.isInteger(count) || count < 0 || count > 5) throw new RangeError('Tally strokes must be 0–5.');
  return [ [[2, 3], [20, 2.5]], [[11, 3], [10.7, 23]], [[11, 12], [20, 11.5]], [[3.5, 11], [3, 23]], [[1, 24], [22, 23.4]] ].slice(0, count);
}
export function tallyGroups(value) {
  if (value === null || value === undefined) return [];
  if (!Number.isInteger(value) || value < 0 || value > 999) throw new RangeError('Tally must be 0–999.');
  return Array.from({ length: Math.ceil(value / 5) }, (_, i) => Math.min(5, value - i * 5));
}
function tallyHeight(value, width) { const cols = Math.max(1, Math.floor((width - 18) / 25)); return Math.max(40, Math.ceil(Math.ceil((value || 0) / 5) / cols) * 29 + 16); }
export function tallyInk(row, metric) {
  const total = row[metric] ?? 0, cases = row.donorCases || [], assigned = cases.reduce((sum, item) => sum + item.counts[metric], 0);
  // Unclassified contacts remain black; explicit cases keep their entered order.
  const colors = Array.from({ length: Math.max(0, total - assigned) }, () => INK);
  for (const item of cases) for (let i = 0; i < item.counts[metric] && colors.length < total; i++) colors.push(item.donor ? DONOR_INK : INK);
  return colors;
}
function drawTally(ctx, value, x, y, width, height, seed, colors = []) {
  if (value === null || value === undefined) return;
  if (value === 0) { line(ctx, x + width / 2 - 7, y + height / 2 + 1, x + width / 2 + 8, y + height / 2 - 1, INK, 1.5); return; }
  const groups = tallyGroups(value), cols = Math.max(1, Math.floor((width - 18) / 25)), visibleCols = Math.min(cols, groups.length);
  const startX = x + (width - visibleCols * 25) / 2, startY = y + Math.max(8, (height - Math.ceil(groups.length / cols) * 29) / 2);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  groups.forEach((strokes, i) => {
    const jitter = Math.sin(seed * 13 + i * 11) * .7;
    ctx.save(); ctx.translate(startX + i % cols * 25, startY + Math.floor(i / cols) * 29 + jitter); ctx.rotate(Math.sin(seed + i * 7) * .024);
    tallyStrokes(strokes).forEach(([[a, b], [c, d]], s) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2 + Math.sin(seed + i + s) * .5, (b + d) / 2 + .35, c, d); ctx.strokeStyle = colors[i * 5 + s] || INK; ctx.lineWidth = 1.55; ctx.stroke(); });
    ctx.restore();
  });
  ctx.restore();
}
function plan(ctx, sheet) {
  const metaColumns = [ [['Name:', sheet.meta.name], ['Weather:', sheet.meta.weather]], [['Team:', sheet.meta.team], ['Location:', sheet.meta.location]], [['Date:', sheet.date.replaceAll('-', '. ')], ['오늘의 테마:', sheet.meta.theme]] ];
  const metadata = metaColumns.map((col, i) => col.map(([label, value]) => {
    const offset = [40, 16, 0][i]; print(ctx, 14, 700); const labelWidth = ctx.measureText(label).width + 10;
    pen(ctx, 23); return { label, x: MARGIN + i * INNER / 3 + offset, labelWidth, lines: wrap(ctx, value, INNER / 3 - offset - labelWidth - 10) };
  }));
  const metaFirstHeight = Math.max(...metadata.map(col => col[0].lines.length)) * 24 + 10;
  const metaSecondHeight = Math.max(...metadata.map(col => col[1].lines.length)) * 24;
  const tableY = 112 + metaFirstHeight + metaSecondHeight + 16;
  const cols = [144, 134, 112, 108, 108, 198];
  pen(ctx, 22);
  const processLines = METRICS.slice(0, 4).map((key, i) => wrap(ctx, sheet.processGoals[key], cols[i + 1] - 16));
  const goalHeight = Math.max(34, ...processLines.map(lines => lines.length * 23 + 10));
  const rowHeights = sheet.rows.map(row => Math.max(43, ...METRICS.slice(0, 4).map((key, i) => tallyHeight(row[key], cols[i + 1]))));
  pen(ctx, 23);
  const objectionLines = wrap(ctx, sheet.objections, cols[5] - 24);
  const notes = sheet.objections ? [{ lines: objectionLines, color: INK }] : [];
  let caseNumber = 0;
  sheet.rows.forEach(row => (row.donorCases || []).forEach(item => {
    caseNumber++;
    if (item.note) notes.push({ lines: wrap(ctx, `${caseNumber <= 20 ? String.fromCodePoint(0x245f + caseNumber) : `${caseNumber}.`} ${item.note}`, cols[5] - 20), color: item.donor ? DONOR_INK : INK });
  }));
  print(ctx, 12);
  const exampleLines = PRINTED_EXAMPLES.flatMap(text => wrap(ctx, text, cols[5] - 18));
  const exampleHeight = exampleLines.length * 21 + 15;
  const rowTotal = rowHeights.reduce((a, b) => a + b, 0);
  const tableBodyHeight = Math.max(rowTotal, exampleHeight + notes.reduce((sum, note) => sum + note.lines.length * 23 + 7, 0) + 16);
  if (tableBodyHeight > rowTotal) rowHeights[rowHeights.length - 1] += tableBodyHeight - rowTotal;
  const summaryY = tableY + 32 + goalHeight + tableBodyHeight + 23;
  const reviewY = summaryY + 102;
  pen(ctx, 24);
  const reviews = ['loa', 'pitch', 'attitude'].map(key => ({ good: wrap(ctx, sheet.review[key].good, INNER / 3 - 26), bad: wrap(ctx, sheet.review[key].bad, INNER / 3 - 26) }));
  const goodHeight = Math.max(145, ...reviews.map(r => r.good.length * 25 + 52));
  const badHeight = Math.max(145, ...reviews.map(r => r.bad.length * 25 + 46));
  const height = Math.max(Math.round(WIDTH * 297 / 210), reviewY + 32 + goodHeight + badHeight + 66);
  return { metadata, metaFirstHeight, tableY, cols, goalHeight, processLines, rowHeights, tableBodyHeight, notes, exampleLines, exampleHeight, summaryY, reviewY, reviews, goodHeight, badHeight, height };
}
export async function renderSheet(canvas, sheet, { scale = 1.7 } = {}) {
  await loadPaperFonts();
  const ctx = canvas.getContext('2d'), p = plan(ctx, sheet);
  // Keep large handwritten records within cross-browser canvas limits without dropping content.
  const actualScale = Math.min(scale, 16380 / p.height, Math.sqrt(16000000 / (WIDTH * p.height)));
  if (actualScale < .65) throw new Error('기록이 한 장의 이미지로 만들기에는 너무 길어요. 시간 기록이나 메모를 나누어 저장해 주세요. 작성 내용은 그대로 유지돼요.');
  canvas.width = Math.ceil(WIDTH * actualScale); canvas.height = Math.ceil(p.height * actualScale);
  canvas.style.aspectRatio = `${WIDTH} / ${p.height}`;
  ctx.scale(actualScale, actualScale); ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, WIDTH, p.height);
  print(ctx, 26, 700); centered(ctx, 'Call Back Sheet', WIDTH / 2, 64);
  p.metadata.forEach(col => col.forEach((field, j) => { const y = 112 + (j ? p.metaFirstHeight : 0); print(ctx, 14, 700); ctx.fillText(field.label, field.x, y); handLines(ctx, field.lines, field.x + field.labelWidth, y, 24, 23); }));
  const headers = ['Field Time', 'Contact', 'Stop', 'Presentation', 'Close', '오브젝션 핸들링 사유'];
  let x = MARGIN;
  p.cols.forEach((w, i) => { box(ctx, x, p.tableY, w, 32, '#e9eae4'); print(ctx, i === 5 ? 14 : 15, 700); centered(ctx, headers[i], x + w / 2, p.tableY + 22); x += w; });
  x = MARGIN;
  p.cols.forEach((w, i) => { box(ctx, x, p.tableY + 32, w, p.goalHeight, '#f0f0e9'); if (!i) { print(ctx, 14, 700); centered(ctx, '과정 목표(Goal)', x + w / 2, p.tableY + 32 + p.goalHeight / 2 + 5); } else if (i < 5) handLines(ctx, p.processLines[i - 1], x + 10, p.tableY + 56, 23, 22); else { print(ctx, 15, 700); centered(ctx, '시리얼(기본정보)', x + w / 2, p.tableY + 32 + p.goalHeight / 2 + 5); } x += w; });
  let y = p.tableY + 32 + p.goalHeight;
  const notesX = MARGIN + p.cols.slice(0, 5).reduce((a, b) => a + b, 0);
  box(ctx, notesX, y, p.cols[5], p.tableBodyHeight);
  print(ctx, 12); p.exampleLines.forEach((text, index) => ctx.fillText(text, notesX + 9, y + 25 + index * 21));
  let noteY = y + p.exampleHeight + 19;
  p.notes.forEach(note => { handLines(ctx, note.lines, notesX + 10, noteY, 23, 23, note.color); noteY += note.lines.length * 23 + 7; });
  sheet.rows.forEach((row, index) => {
    const h = p.rowHeights[index]; x = MARGIN;
    p.cols.slice(0, 5).forEach((w, i) => { box(ctx, x, y, w, h); if (i) drawTally(ctx, row[METRICS[i - 1]], x, y, w, h, index * 5 + i, tallyInk(row, METRICS[i - 1])); else {
      const baseline = y + Math.min(29, h / 2 + 8);
      pen(ctx, 22); ctx.fillText(row.time, x + 10, baseline); if (row.endTime) ctx.fillText(row.endTime, x + 91, baseline);
      print(ctx, 27, 750); centered(ctx, '/', x + 81, baseline + 1);
    } x += w; }); y += h;
  });
  box(ctx, MARGIN, p.summaryY, INNER, 30, '#e9eae4'); print(ctx, 15, 700); centered(ctx, '오늘의 목표 & 결과 (환경을 탓하지 말고 나의 노력을 탓하라)', WIDTH / 2, p.summaryY + 21);
  const summaryLabels = ['Contact', 'Stop', 'Presentation', 'Close', 'Rehash'], totals = getTotals(sheet);
  METRICS.forEach((key, i) => {
    const w = INNER / 5, x = MARGIN + i * w;
    box(ctx, x, p.summaryY + 30, w, 27, '#f0f0e9'); print(ctx, 15, 700); centered(ctx, summaryLabels[i], x + w / 2, p.summaryY + 49);
    box(ctx, x, p.summaryY + 57, w, 45);
    // The paper prints a slash, with independently positioned handwritten goal/result values.
    pen(ctx, 28); ctx.textAlign = 'right'; ctx.fillText(sheet.goals[key] ?? '', x + w / 2 - 16, p.summaryY + 87); ctx.textAlign = 'left'; ctx.fillText(hasValues(sheet, key) ? totals[key] : '', x + w / 2 + 15, p.summaryY + 87);
    print(ctx, 27, 750); centered(ctx, '/', x + w / 2, p.summaryY + 89);
  });
  box(ctx, MARGIN, p.reviewY, INNER, 32, '#e9eae4'); print(ctx, 14, 700); centered(ctx, '내일을 위한 Analysis & Evaluation', WIDTH / 2, p.reviewY + 22);
  p.reviews.forEach((review, i) => {
    const w = INNER / 3, x = MARGIN + i * w;
    for (const [key, top, height] of [['good', p.reviewY + 32, p.goodHeight], ['bad', p.reviewY + 32 + p.goodHeight, p.badHeight]]) {
      box(ctx, x, top, w, height); print(ctx, 15, 700);
      if (key === 'good') { const title = ['Number', 'Pitch(Skill)', 'Attitude(Mental)'][i]; ctx.fillText(title, x + 10, top + 23); line(ctx, x + 10, top + 26, x + 10 + ctx.measureText(title).width, top + 26, '#2e3535', 1); }
      ctx.textAlign = 'right'; ctx.fillText(key === 'good' ? '(+)' : '(−)', x + w - 12, top + 23); ctx.textAlign = 'left';
      handLines(ctx, review[key], x + 13, top + (key === 'good' ? 53 : 47), 25, 24);
    }
  });
  return { width: canvas.width, height: canvas.height, logicalHeight: p.height };
}
export async function exportSheetPNG(sheet) {
  const canvas = document.createElement('canvas');
  await renderSheet(canvas, sheet, { scale: 2.5 });
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지를 만들지 못했어요. 다시 시도해 주세요.')), 'image/png'));
  return { blob, width: canvas.width, height: canvas.height, filename: `콜백싯_${sheet.date}_${(sheet.meta.name || '기록').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 40)}.png` };
}
