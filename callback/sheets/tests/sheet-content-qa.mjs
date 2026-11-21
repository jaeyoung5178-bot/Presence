import assert from 'node:assert/strict';
import { createSheet, createDonorCase } from '../sheet-model.js';
import { sameSheetContent } from '../sheet-content.js';

let checks = 0;
const check = (name, work) => { work(); checks++; console.log(`PASS ${name}`); };
const seed = () => {
  const sheet = createSheet(new Date('2026-08-06T03:00:00Z'));
  sheet.meta.name = '가상 검수자'; sheet.objections = '원문 메모';
  return sheet;
};
check('date correction and version metadata can reuse the entire original body', () => {
  const original = seed(), moved = structuredClone(original);
  moved.id = 'synthetic-comparison'; moved.date = '2026-08-04'; moved.updatedAt = '2026-08-07T03:00:00Z';
  assert.equal(sameSheetContent(original, moved), true);
});
check('zero, empty values and creation identity remain meaningful', () => {
  const original = seed();
  for (const mutate of [s => { s.rows[0].contact = 0; }, s => { s.createdAt = '2026-08-05T03:00:00Z'; }, s => { s.rows[0].id = 'different-row'; }]) {
    const changed = structuredClone(original); mutate(changed); assert.equal(sameSheetContent(original, changed), false);
  }
});
check('case identity, text and donor selections cannot be silently rebased', () => {
  const original = seed(); original.rows[0].donorCases = [createDonorCase(original.rows[0])];
  for (const mutate of [s => { s.rows[0].donorCases[0].id = 'different-case'; }, s => { s.rows[0].donorCases[0].note = '새 메모'; }, s => { s.rows[0].donorCases[0].donor = true; }, s => { s.objections += '\n'; }]) {
    const changed = structuredClone(original); mutate(changed); assert.equal(sameSheetContent(original, changed), false);
  }
});
check('goals and review changes stay protected from a stale date correction', () => {
  const original = seed();
  for (const mutate of [s => { s.goals.close = 0; }, s => { s.review.pitch.good = '가상 회고'; }]) {
    const changed = structuredClone(original); mutate(changed); assert.equal(sameSheetContent(original, changed), false);
  }
});
check('photo source and its interpretation stay exact during comparison', () => {
  const original = seed(); original.source = { type: 'photo', imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=', filename: 'synthetic.png', notes: '', duplicateCount: 0, dateBasis: 'written' };
  assert.equal(sameSheetContent(original, structuredClone(original)), true);
  for (const mutate of [s => { s.source.imageDataUrl = s.source.imageDataUrl.replace('P8/x8A', 'P8/x9A'); }, s => { s.source.filename = 'another.png'; }, s => { s.source.dateBasis = 'capture'; }]) {
    const changed = structuredClone(original); mutate(changed); assert.equal(sameSheetContent(original, changed), false);
  }
});
console.log(`${checks} sheet-content checks passed`);
