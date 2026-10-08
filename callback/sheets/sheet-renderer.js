import { METRICS, getTotals, hasValues } from './sheet-model.js';

const WIDTH = 900, MARGIN = 44, INNER = WIDTH - MARGIN * 2;
const INK = '#244d76', GRAPHITE = '#565957', PAPER = '#fffdf7';
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
function handLines(ctx, lines, x, y, lineHeight = 25, size = 24) { pen(ctx, size); lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight)); }
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
function drawTally(ctx, value, x, y, width, height, seed) {
  if (value === null || value === undefined) return;
  if (value === 0) { line(ctx, x + width / 2 - 7, y + height / 2 + 1, x + width / 2 + 8, y + height / 2 - 1, INK, 1.5); return; }
  const groups = tallyGroups(value), cols = Math.max(1, Math.floor((width - 18) / 25)), visibleCols = Math.min(cols, groups.length);
  const startX = x + (width - visibleCols * 25) / 2, startY = y + Math.max(8, (height - Math.ceil(groups.length / cols) * 29) / 2);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  groups.forEach((strokes, i) => {
    const jitter = Math.sin(seed * 13 + i * 11) * .7;
    ctx.save(); ctx.translate(startX + i % cols * 25, startY + Math.floor(i / cols) * 29 + jitter); ctx.rotate(Math.sin(seed + i * 7) * .024);
    tallyStrokes(strokes).forEach(([[a, b], [c, d]], s) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2 + Math.sin(seed + i + s) * .5, (b + d) / 2 + .35, c, d); ctx.strokeStyle = INK; ctx.lineWidth = 1.55; ctx.stroke(); });
    ctx.restore();
  });
  ctx.restore();
}
function plan(ctx, sheet) {
  const metaColumns = [ [['Name', sheet.meta.name], ['Date', sheet.date.replaceAll('-', '. ')]], [['Location', sheet.meta.location], ['Team', sheet.meta.team]], [['Weather', sheet.meta.weather], ['Theme 테마', sheet.meta.theme]] ];
  pen(ctx, 23);
  const metadata = metaColumns.map(col => col.map(([label, value]) => ({ label, lines: wrap(ctx, value, INNER / 3 - 32) })));
  const metaFirstHeight = Math.max(...metadata.map(col => col[0].lines.length)) * 23 + 24;
  const metaSecondHeight = Math.max(...metadata.map(col => col[1].lines.length)) * 23 + 24;
  const tableY = 104 + metaFirstHeight + metaSecondHeight;
  const cols = [90, 126, 126, 126, 126, 218];
  pen(ctx, 22);
  const processLines = METRICS.slice(0, 4).map((key, i) => wrap(ctx, sheet.processGoals[key], cols[i + 1] - 16));
  const goalHeight = Math.max(36, ...processLines.map(lines => lines.length * 23 + 12));
  const rowHeights = sheet.rows.map(row => Math.max(44, ...METRICS.slice(0, 4).map((key, i) => tallyHeight(row[key], cols[i + 1])), row.rehash !== null ? (row.endTime ? 80 : 58) : 44, row.endTime ? 58 : 44));
  pen(ctx, 23);
  const objectionLines = wrap(ctx, sheet.objections, cols[5] - 24);
  const rowTotal = rowHeights.reduce((a, b) => a + b, 0);
  const tableBodyHeight = Math.max(rowTotal, objectionLines.length * 24 + 22);
  if (tableBodyHeight > rowTotal) rowHeights[rowHeights.length - 1] += tableBodyHeight - rowTotal;
  const summaryY = tableY + 36 + goalHeight + tableBodyHeight + 24;
  const reviewY = summaryY + 117;
  pen(ctx, 24);
  const reviews = ['loa', 'pitch', 'attitude'].map(key => ({ good: wrap(ctx, sheet.review[key].good, INNER / 3 - 26), bad: wrap(ctx, sheet.review[key].bad, INNER / 3 - 26) }));
  const goodHeight = Math.max(152, ...reviews.map(r => r.good.length * 25 + 52));
  const badHeight = Math.max(152, ...reviews.map(r => r.bad.length * 25 + 52));
  const height = Math.max(Math.round(WIDTH * 297 / 210), reviewY + 32 + goodHeight + badHeight + 62);
  return { metadata, metaFirstHeight, tableY, cols, goalHeight, processLines, rowHeights, tableBodyHeight, objectionLines, summaryY, reviewY, reviews, goodHeight, badHeight, height };
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
  ctx.fillStyle = 'rgba(98,84,44,.026)';
  for (let i = 0; i < p.height * 2; i++) { const x = (Math.sin(i * 12.9898) * 43758.5453) % 1; const y = (Math.cos(i * 7.233) * 16384.73) % 1; ctx.fillRect(Math.abs(x) * WIDTH, Math.abs(y) * p.height, .75, .75); }
  print(ctx, 26, 700); centered(ctx, 'Call Back Sheet', WIDTH / 2, 64);
  print(ctx, 9, 600); ctx.fillStyle = '#8d938d'; centered(ctx, 'P R E S E N C E   /   F I E L D   N O T E S', WIDTH / 2, 85);
  p.metadata.forEach((col, i) => col.forEach((field, j) => { const x = MARGIN + i * INNER / 3 + 10, y = 118 + (j ? p.metaFirstHeight : 0); print(ctx, 12, 650); ctx.fillText(field.label, x, y); handLines(ctx, field.lines, x, y + 25, 23, 23); }));
  const headers = ['Field Time', 'Contact / Intro', 'Stop / Qualifying', 'Presentation', 'Close', 'Time & Why'];
  let x = MARGIN;
  p.cols.forEach((w, i) => { box(ctx, x, p.tableY, w, 36, '#e9eae4'); print(ctx, i === 2 ? 11 : 12, 650); centered(ctx, headers[i], x + w / 2, p.tableY + 23); x += w; });
  x = MARGIN;
  p.cols.forEach((w, i) => { box(ctx, x, p.tableY + 36, w, p.goalHeight, '#f3f2eb'); if (!i) { print(ctx, 12, 650); centered(ctx, '과정목표', x + w / 2, p.tableY + 36 + p.goalHeight / 2 + 5); } else if (i < 5) handLines(ctx, p.processLines[i - 1], x + 10, p.tableY + 60, 23, 22); else { print(ctx, 11); centered(ctx, '오브젝션 · 핸들링 사유', x + w / 2, p.tableY + 36 + p.goalHeight / 2 + 4); } x += w; });
  let y = p.tableY + 36 + p.goalHeight;
  const notesX = MARGIN + p.cols.slice(0, 5).reduce((a, b) => a + b, 0);
  box(ctx, notesX, y, p.cols[5], p.tableBodyHeight);
  handLines(ctx, p.objectionLines, notesX + 12, y + 28, 24, 23);
  sheet.rows.forEach((row, index) => {
    const h = p.rowHeights[index]; x = MARGIN;
    p.cols.slice(0, 5).forEach((w, i) => { box(ctx, x, y, w, h); if (i) drawTally(ctx, row[METRICS[i - 1]], x, y, w, h, index * 5 + i); else {
      const timeline = row.time && row.endTime ? [row.time, `– ${row.endTime}`] : [row.time || (row.endTime ? `– ${row.endTime}` : '')];
      const linesH = timeline.length * 21 + (row.rehash !== null ? 16 : 0), start = y + Math.min(24, (h - linesH) / 2 + 19);
      pen(ctx, 23); timeline.forEach((value, j) => centered(ctx, value, x + w / 2, start + j * 21));
      if (row.rehash !== null) { print(ctx, 10); ctx.fillStyle = INK; centered(ctx, `Rehash ${row.rehash}`, x + w / 2, start + timeline.length * 21 - 2); }
    } x += w; }); y += h;
  });
  box(ctx, MARGIN, p.summaryY, INNER, 30, '#e9eae4'); print(ctx, 15, 700); centered(ctx, '오늘의 목표 & 결과', WIDTH / 2, p.summaryY + 21);
  const summaryLabels = ['Contact / Intro', 'Stop / Short Story', 'Presentation', 'Close', 'Rehash'], totals = getTotals(sheet);
  METRICS.forEach((key, i) => {
    const w = INNER / 5, x = MARGIN + i * w;
    box(ctx, x, p.summaryY + 30, w, 28, '#f3f2eb'); print(ctx, 11, 650); centered(ctx, summaryLabels[i], x + w / 2, p.summaryY + 49);
    box(ctx, x, p.summaryY + 58, w, 59); pen(ctx, 29); centered(ctx, `${sheet.goals[key] ?? '—'}   /   ${hasValues(sheet, key) ? totals[key] : '—'}`, x + w / 2, p.summaryY + 88);
    print(ctx, 9); ctx.fillStyle = '#818b87'; centered(ctx, '목표  /  결과', x + w / 2, p.summaryY + 106);
  });
  box(ctx, MARGIN, p.reviewY, INNER, 32, '#e9eae4'); print(ctx, 14, 700); centered(ctx, '내일을 위한 Analysis & Evaluation', WIDTH / 2, p.reviewY + 22);
  p.reviews.forEach((review, i) => {
    const w = INNER / 3, x = MARGIN + i * w;
    for (const [key, top, height] of [['good', p.reviewY + 32, p.goodHeight], ['bad', p.reviewY + 32 + p.goodHeight, p.badHeight]]) {
      box(ctx, x, top, w, height); print(ctx, 13, 700); ctx.fillText(['L.O.A', 'Pitch / Skill', 'Attitude'][i], x + 12, top + 23); ctx.textAlign = 'right'; ctx.fillText(key === 'good' ? '(+)' : '(−)', x + w - 12, top + 23); ctx.textAlign = 'left';
      handLines(ctx, review[key], x + 13, top + 53, 25, 24);
    }
  });
  print(ctx, 9); ctx.fillStyle = '#9b9f94'; centered(ctx, '매일의 기록이 내일의 나를 만듭니다.', WIDTH / 2, p.height - 26);
  return { width: canvas.width, height: canvas.height, logicalHeight: p.height };
}
export async function exportSheetPNG(sheet) {
  const canvas = document.createElement('canvas');
  await renderSheet(canvas, sheet, { scale: 2.5 });
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지를 만들지 못했어요. 다시 시도해 주세요.')), 'image/png'));
  return { blob, width: canvas.width, height: canvas.height, filename: `콜백싯_${sheet.date}_${(sheet.meta.name || '기록').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 40)}.png` };
}
