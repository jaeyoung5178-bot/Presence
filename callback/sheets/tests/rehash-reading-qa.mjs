import assert from 'node:assert/strict';
import { createSheet, createDonorCase, getMetricReading, getDonorSummary, getTotals, getPaperNotes, setPaperNoteDonor, normalizeSheet, incrementPaperMetric, decrementPaperMetric } from '../sheet-model.js';

let checks = 0;
const check = (name, work) => { work(); checks++; console.log(`PASS ${name}`); };
const fresh = () => createSheet(new Date('2026-08-06T03:00:00Z'));
const rehash = sheet => getMetricReading(sheet, 'rehash');
check('untouched historical manual Rehash including explicit zero stays available', () => {
  const sheet = fresh(); assert.deepEqual(rehash(sheet), { value: null, basis: 'unknown' });
  sheet.rows[0].rehash = 7; assert.deepEqual(rehash(sheet), { value: 7, basis: 'manual' });
  sheet.rows[0].rehash = 0; assert.deepEqual(rehash(sheet), { value: 0, basis: 'manual' });
});
check('memo check 1 to 2 to 1 to 0 updates the result without rewriting hourly data or Close', () => {
  const sheet = fresh(); sheet.rows[0].rehash = 9; sheet.rows[0].close = 6;
  sheet.objections = '1. 가상 첫 메모\n\n2. 가상 두 번째 메모';
  const rows = JSON.stringify(sheet.rows), text = sheet.objections;
  const [first, second] = getPaperNotes(sheet).filter(note => !note.virtual);
  for (const [target, selected, count] of [[first, true, 1], [second, true, 2], [first, false, 1], [second, false, 0]]) {
    setPaperNoteDonor(sheet, target, selected);
    assert.deepEqual(rehash(sheet), { value: count, basis: 'donors' });
    assert.equal(getDonorSummary(sheet).count, count);
    assert.equal(JSON.stringify(sheet.rows), rows); assert.equal(sheet.objections, text);
    assert.equal(getTotals(sheet).rehash, 9); assert.equal(getMetricReading(sheet, 'close').value, 6);
  }
});
check('explicit unchecked zero survives normalize and JSON reload rather than reviving manual Rehash', () => {
  const sheet = fresh(); sheet.rows[0].rehash = 12; sheet.objections = '별도 가상 메모';
  const target = getPaperNotes(sheet)[0]; setPaperNoteDonor(sheet, target, true); setPaperNoteDonor(sheet, target, false);
  const loaded = normalizeSheet(JSON.parse(JSON.stringify(sheet)));
  assert.deepEqual(loaded.donorObjections, []);
  assert.deepEqual(rehash(loaded), { value: 0, basis: 'donors' }); assert.equal(loaded.rows[0].rehash, 12);
});
check('identical separate paragraphs count independently and never duplicate on repeat checks', () => {
  const sheet = fresh(); sheet.objections = '동일한 가상 메모\n\n동일한 가상 메모';
  const [first, second] = getPaperNotes(sheet); setPaperNoteDonor(sheet, first, true); setPaperNoteDonor(sheet, first, true);
  assert.equal(rehash(sheet).value, 1); setPaperNoteDonor(sheet, second, true); assert.equal(rehash(normalizeSheet(sheet)).value, 2);
});
check('case and its matching memo count once and clearing a case keeps explicit zero', () => {
  const sheet = fresh(), row = sheet.rows[0]; row.close = 1; row.rehash = 8;
  const item = createDonorCase(row); item.note = '가상 케이스'; item.donor = true; row.donorCases = [item];
  sheet.objections = '1. 가상 케이스'; sheet.donorObjections = [sheet.objections];
  assert.deepEqual(rehash(sheet), { value: 1, basis: 'donors' });
  setPaperNoteDonor(sheet, getPaperNotes(sheet)[0], false);
  assert.deepEqual(rehash(normalizeSheet(sheet)), { value: 0, basis: 'donors' }); assert.equal(row.rehash, 8); assert.equal(row.close, 1);
});
check('empty untouched case list preserves historical manual Rehash fallback', () => {
  const sheet = fresh(); sheet.rows[0].rehash = 4; sheet.rows[0].donorCases = [];
  assert.deepEqual(rehash(normalizeSheet(sheet)), { value: 4, basis: 'manual' });
});
check('paper tally mutations cannot change hidden raw Rehash values', () => {
  const sheet = fresh(); sheet.rows[0].rehash = 7; sheet.objections = '가상 메모';
  setPaperNoteDonor(sheet, getPaperNotes(sheet)[0], true);
  const before = JSON.stringify(sheet);
  assert.throws(() => incrementPaperMetric(sheet, sheet.rows[0].id, 'rehash'));
  assert.throws(() => decrementPaperMetric(sheet, sheet.rows[0].id, 'rehash'));
  assert.equal(JSON.stringify(sheet), before); assert.equal(rehash(sheet).value, 1);
});
console.log(`${checks} Rehash reading checks passed`);
