import assert from 'node:assert/strict';
import { createSheet, createDonorCase, getPaperNotes, getDonorSummary, setPaperNoteDonor, normalizeSheet } from '../sheet-model.js';
import { planFieldTimeRange } from '../quick-controls.js';

let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const fresh = () => createSheet(new Date('2026-11-20T00:00:00Z'));
const intervals = plan => plan.rows.map(row => [row.time, row.endTime]);
check('minute boundaries create only the selected interval without mutating input', () => {
  const sheet = fresh(), before = JSON.stringify(sheet);
  assert.deepEqual(intervals(planFieldTimeRange(sheet, '09:30', '12:20')), [['09:30', '10:00'], ['10:00', '11:00'], ['11:00', '12:00'], ['12:00', '12:20']]);
  assert.equal(JSON.stringify(sheet), before);
});
check('overnight range includes midnight and exact final minute', () => {
  const plan = planFieldTimeRange(fresh(), '23:30', '01:20');
  assert.equal(plan.overnight, true); assert.equal(plan.minutes, 110);
  assert.deepEqual(intervals(plan), [['23:30', '00:00'], ['00:00', '01:00'], ['01:00', '01:20']]);
});
check('missing, invalid and identical times reject without mutation', () => {
  const sheet = fresh(), before = JSON.stringify(sheet);
  for (const [start, end] of [['', '12:00'], ['25:00', '12:00'], ['12:00', '12:00']]) assert.throws(() => planFieldTimeRange(sheet, start, end));
  assert.equal(JSON.stringify(sheet), before);
});
check('zero, handwritten note and all case data retain exact original row', () => {
  const sheet = fresh(); sheet.rows = planFieldTimeRange(sheet, '09:30', '12:20').rows;
  const row = sheet.rows[1]; row.contact = 0; row.close = 1;
  const item = createDonorCase(row); item.note = '가상 원문과 메모'; row.donorCases = [item];
  const before = JSON.stringify(row), plan = planFieldTimeRange(sheet, '09:45', '13:15');
  assert.equal(plan.rows[1], row); assert.equal(JSON.stringify(plan.rows[1]), before); assert.equal(plan.kept, 1);
  assert.throws(() => planFieldTimeRange(sheet, '11:30', '13:00'));
});
check('recorded non-hourly boundaries stay exact and empty gaps are filled', () => {
  const sheet = fresh(), row = sheet.rows[0]; row.time = '10:15'; row.endTime = '10:45'; row.rehash = 0;
  const plan = planFieldTimeRange(sheet, '09:30', '11:15');
  assert.deepEqual(intervals(plan), [['09:30', '10:00'], ['10:00', '10:15'], ['10:15', '10:45'], ['10:45', '11:00'], ['11:00', '11:15']]);
  assert.equal(plan.rows[2], row);
});
check('overlap, reverse order and missing recorded times reject atomically', () => {
  const sheet = fresh(); sheet.rows = planFieldTimeRange(sheet, '09:00', '12:00').rows;
  sheet.rows[0].contact = 1; sheet.rows[1].contact = 0;
  sheet.rows[1].time = '09:30'; let before = JSON.stringify(sheet);
  assert.throws(() => planFieldTimeRange(sheet, '09:00', '13:00')); assert.equal(JSON.stringify(sheet), before);
  sheet.rows[1].time = '08:00'; assert.throws(() => planFieldTimeRange(sheet, '08:00', '13:00'));
  sheet.rows[1].time = ''; assert.throws(() => planFieldTimeRange(sheet, '08:00', '13:00'));
});
check('legacy individual selection repeats safely and deselects without editing original text', () => {
  const sheet = fresh(); sheet.objections = '1. 가상 첫 메모\n\n2. 가상 둘째 메모';
  const before = sheet.objections, target = getPaperNotes(sheet)[1];
  setPaperNoteDonor(sheet, target, true); setPaperNoteDonor(sheet, target, true);
  assert.equal(getDonorSummary(sheet).count, 1); assert.equal(getPaperNotes(sheet)[1].donor, true); assert.equal(sheet.objections, before);
  setPaperNoteDonor(sheet, target, false); assert.equal(getDonorSummary(sheet).count, 0);
  assert.equal(sheet.objections, before); assert.equal(getDonorSummary(normalizeSheet(sheet)).count, 0);
});
check('plain legacy memo selection keeps line breaks and bytes', () => {
  const sheet = fresh(); sheet.objections = '가상 첫 문장\n같은 메모의 둘째 줄\n\n가상 두 번째 메모';
  const before = sheet.objections;
  setPaperNoteDonor(sheet, getPaperNotes(sheet)[0], true);
  assert.equal(sheet.objections, before); assert.equal(getDonorSummary(sheet).count, 1);
});
check('virtual numbered memo becomes one stable legacy note on first selection', () => {
  const sheet = fresh(); sheet.rows[0].close = 1;
  let target = getPaperNotes(sheet)[0]; target = setPaperNoteDonor(sheet, target, true);
  assert.equal(target.virtual, false); assert.equal(sheet.objections, '1.');
  setPaperNoteDonor(sheet, target, true); assert.equal(getDonorSummary(sheet).count, 1);
  setPaperNoteDonor(sheet, target, false); assert.equal(getDonorSummary(sheet).count, 0);
});
check('each numbered selection counts once even with identical or empty bodies', () => {
  const sheet = fresh(); sheet.rows[0].close = 2;
  for (const slot of [1, 2]) setPaperNoteDonor(sheet, getPaperNotes(sheet).find(note => note.slot === slot), true);
  assert.equal(getDonorSummary(sheet).count, 2);
  setPaperNoteDonor(sheet, getPaperNotes(sheet).find(note => note.slot === 1), false);
  assert.equal(getDonorSummary(sheet).count, 1);
  sheet.objections = '1. 같은 가상 내용\n\n2. 같은 가상 내용'; sheet.donorObjections = [];
  for (const target of getPaperNotes(sheet)) setPaperNoteDonor(sheet, target, true);
  assert.equal(getDonorSummary(sheet).count, 2);
  assert.equal(getDonorSummary(normalizeSheet(sheet)).count, 2);
});
check('case and common memo selection represent one donor and uncheck clears both', () => {
  const sheet = fresh(); const row = sheet.rows[0]; row.contact = row.stop = row.presentation = row.close = 1;
  const item = createDonorCase(row); item.note = '가상 케이스 원문'; row.donorCases = [item];
  sheet.objections = '1. 함께 기록된 기존 원문'; sheet.donorObjections = [sheet.objections];
  const target = getPaperNotes(sheet)[0], before = sheet.objections;
  assert.equal(target.donor, true); setPaperNoteDonor(sheet, target, true);
  assert.equal(item.donor, true); assert.equal(getDonorSummary(sheet).count, 1);
  setPaperNoteDonor(sheet, target, false); assert.equal(getDonorSummary(sheet).count, 0);
  assert.equal(sheet.objections, before); assert.equal(item.note, '가상 케이스 원문');
});
check('a distinct numbered memo with a case-matching body is still another selection', () => {
  const sheet = fresh(), row = sheet.rows[0]; row.close = 1;
  const item = createDonorCase(row); item.note = '같은 가상 내용'; item.donor = true; row.donorCases = [item];
  sheet.objections = '1. 같은 가상 내용\n\n2. 같은 가상 내용';
  const target = getPaperNotes(sheet).find(note => note.kind === 'objection' && note.slot === 2);
  setPaperNoteDonor(sheet, target, true); assert.equal(getDonorSummary(sheet).count, 2);
});
check('stale target fails without changing a different note', () => {
  const sheet = fresh(); sheet.objections = '1. 이전 메모'; const target = getPaperNotes(sheet)[0];
  sheet.objections = '1. 새 메모'; const before = JSON.stringify(sheet);
  assert.throws(() => setPaperNoteDonor(sheet, target, true)); assert.equal(JSON.stringify(sheet), before);
});
console.log(`${checks} quick-control checks passed`);
