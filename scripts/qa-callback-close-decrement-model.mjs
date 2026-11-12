import assert from 'node:assert/strict';
import { createSheet, incrementPaperMetric, decrementPaperMetric, validateSheet, getPaperNotes } from '../callback/sheets/sheet-model.js';

let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
for (const metric of ['contact', 'stop', 'presentation', 'close']) {
  const sheet = createSheet(), row = sheet.rows[0];
  for (const value of [null, 0]) {
    row[metric] = value;
    const before = JSON.stringify(sheet);
    check(decrementPaperMetric(sheet, row.id, metric), null, `${metric}: zero/blank is a no-op`);
    check(JSON.stringify(sheet), before, `${metric}: zero/blank stays exactly unchanged`);
  }
  row[metric] = 3;
  decrementPaperMetric(sheet, row.id, metric);
  check(row[metric], 2, `${metric}: subtracts one`);
  check(validateSheet(sheet).valid, true, `${metric}: resulting record is valid`);
}

const sheet = createSheet(), row = sheet.rows[0];
for (let i = 0; i < 13; i++) incrementPaperMetric(sheet, row.id, 'close');
check(getPaperNotes(sheet).length, 13, 'thirteen Close counts create thirteen numbered notes');
decrementPaperMetric(sheet, row.id, 'close');
check(row.close, 12, 'Close count decreases');
check(getPaperNotes(sheet).length, 12, 'unused trailing empty placeholder is removed');
sheet.objections = sheet.objections.replace('12.', '12. 작성한 메모');
sheet.donorObjections = ['12. 작성한 메모'];
const beforeNotes = sheet.objections;
decrementPaperMetric(sheet, row.id, 'close');
check(sheet.objections, beforeNotes, 'written notes retain their text and numbering');
check(sheet.donorObjections, ['12. 작성한 메모'], 'donor note flags are preserved');
check(validateSheet(sheet).valid, true, 'preserved note beyond the Close total remains valid');
while (row.close) decrementPaperMetric(sheet, row.id, 'close');
check(row.close, 0, 'repeated subtraction reaches zero');
check(sheet.objections, '12. 작성한 메모', 'all empty placeholders disappear while a written note remains');
check(sheet.donorObjections, ['12. 작성한 메모'], 'zero Close counts never remove donor metadata');

const linked = createSheet(), linkedRow = linked.rows[0];
Object.assign(linkedRow, { close: 2, contact: 3, donorCases: [{ id: 'qa-case', donor: true, note: '보존할 케이스 메모', counts: { close: 2, contact: 1, stop: 0, presentation: 0 } }] });
const action = decrementPaperMetric(linked, linkedRow.id, 'close');
check(action.caseAdjusted, true, 'fully assigned total reduces the last matching case count');
check(linkedRow.donorCases[0].counts.close, 1, 'case count stays within the row total');
check(linkedRow.donorCases[0].note, '보존할 케이스 메모', 'linked case text is preserved');
check(linkedRow.donorCases[0].donor, true, 'linked donor flag is preserved');
check(validateSheet(linked).valid, true, 'linked decrement stays valid');
decrementPaperMetric(linked, linkedRow.id, 'contact');
check(linkedRow.donorCases[0].counts.contact, 1, 'unassigned counts are removed before assigned counts');
decrementPaperMetric(linked, linkedRow.id, 'close');
check(linkedRow.donorCases[0].counts.close, 0, 'last assigned Close can be subtracted');
check(getPaperNotes(linked).some(note => note.caseId === 'qa-case' && note.text === '보존할 케이스 메모'), true, 'case note remains available even with no assigned Close');
check(validateSheet(linked).valid, true, 'zero-count case with preserved metadata stays valid');

const invalid = createSheet();
invalid.rows[0].close = -1;
const beforeInvalid = JSON.stringify(invalid);
assert.throws(() => decrementPaperMetric(invalid, invalid.rows[0].id, 'close'));
checks++;
check(JSON.stringify(invalid), beforeInvalid, 'invalid baseline is rejected atomically');
console.log(JSON.stringify({ passed: checks, failed: 0 }));
