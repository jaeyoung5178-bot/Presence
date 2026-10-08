import assert from 'node:assert/strict';
import { LOA_THEMES } from '../callback/analysis/loa-themes.js';
import { analyze, filterAuthor } from '../callback/analysis/analysis-model.js';
import { createSheet } from '../callback/sheets/sheet-model.js';
import { projectAnalysisRecord } from '../callback/analysis/analysis-projection.js';

const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
const matching = text => LOA_THEMES.filter(theme => theme.pattern.test(text)).map(theme => theme.label);
// Synthetic phrases exercise the vocabulary without committing personal reviews.
check('process goals and opportunity counts match without implying conversion or time', () => {
  for (const text of ['과정 목표를 적었다', 'Contact 목표 초과 달성', '목표한 넘버 달성', '넘버가 부족했다', '컨택 횟수를 확인했다']) {
    assert.deepEqual(matching(text), ['과정 목표와 기회량']);
  }
});
check('English stage transitions, compact arrows and Korean loss terms share one theme', () => {
  for (const text of ['contact to STOP', 'PT→Close', 'Contact -> Stop', '컨택에서 스탑', '전환율을 확인했다', '유실이 있었다']) {
    assert.deepEqual(matching(text), ['단계 전환과 유실']);
  }
});
check('hourly pacing, late field time and gaps are time evidence', () => {
  for (const text of ['시간당 횟수 점검', '18시 이후 기록', '필드시간 확보', 'Close공백 확인', '휴식 시간 확인']) {
    assert.deepEqual(matching(text), ['시간 배분과 공백']);
  }
});
check('site changes, traffic and rain contingency are field evidence', () => {
  for (const text of ['테리 이동 시점 점검', '사이트 운영 계획', '현장 변경 검토', '유동 인구 확인', '우천 대비 B플랜']) {
    assert.deepEqual(matching(text), ['현장 이동과 유동']);
  }
});
check('generic number, outcomes or mindset alone do not produce LOA themes', () => {
  for (const text of ['', '넘버 GOOD', 'Close PB', '집중력과 자신감', '밝게 인사', '설명을 짧게']) assert.deepEqual(matching(text), []);
});
check('two explicitly mentioned topics remain discoverable without unrelated matches', () => {
  assert.deepEqual(matching('시간당 과정 목표 점검'), ['과정 목표와 기회량', '시간 배분과 공백']);
  assert.deepEqual(matching('사이트 이동, PT→Close 확인'), ['단계 전환과 유실', '현장 이동과 유동']);
});
check('repeated entries produce stable matches in the reviewAnalysis pattern contract', () => {
  const text = '목표한 넘버 달성, PT→Close 확인, Close 공백과 테리 이동';
  const first = matching(text);
  assert.equal(first.length, 4);
  assert.deepEqual(matching(text), first);
  for (const theme of LOA_THEMES) {
    assert(theme.pattern instanceof RegExp);
    assert.equal(theme.pattern.global || theme.pattern.sticky, false);
    assert.ok(theme.action.trim());
  }
});
const sheet = (id, name='재영') => { const value=createSheet(new Date('2024-05-01T12:00:00Z'));value.id=id;value.meta.name=name;return value; };
const photo=sheet('photo');photo.source={type:'photo',imageDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lU8AAAAASUVORK5CYII=',filename:'synthetic.png',duplicateCount:0,dateBasis:'capture',notes:'',transcription:{version:1,status:'partial',totals:{contact:null,stop:null,presentation:null,close:null,rehash:null},review:{loa:{good:'과정 목표 달성',bad:'Close 공백 점검'},pitch:{good:'설명을 짧게',bad:''},attitude:{good:'밝게 인사',bad:''}}}};
const manual=sheet('manual');manual.review.loa={good:'Contact to Stop 전환 확인',bad:'사이트 이동 시점 점검'};
const empty=sheet('empty'),other=sheet('other','다른 작성자');other.review.loa.bad='Contact 목표 재점검';
const report=analyze(filterAuthor([photo,manual,empty,other],'name:임재영'),'2024-05-01');
check('LOA uses photo transcription and manual reviews without counting missing or other-author text',()=>{assert.equal(report.reviews.loa.coverage,2);assert.equal(report.reviews.loa.transcriptionCoverage,1);assert.equal(report.reviews.loa.good.length,2);assert.equal(report.reviews.loa.bad.length,2);});
check('LOA source quotes preserve text, kind, date and capture-date warning',()=>{const entry=report.reviews.loa.bad.find(item=>item.id==='photo');assert.equal(entry.text,'Close 공백 점검');assert.equal(entry.date,'2024-05-01');assert.equal(entry.kind,'bad');assert.equal(entry.dateBasis,'capture');assert.equal(entry.basis,'transcription');});
check('suggestions require an improvement entry; positive-only topics are not fabricated problems',()=>{assert.deepEqual(new Set(report.reviews.loa.suggestions.map(item=>item.label)),new Set(['시간 배분과 공백','현장 이동과 유동']));assert.equal(report.reviews.loa.themes.find(item=>item.label==='과정 목표와 기회량').improvementCount,0);});
check('a manually edited LOA field overrides only the same photo field',()=>{const edited=structuredClone(photo);edited.review.loa.good='기회량 확보';const review=analyze([edited],'2024-05-01').reviews.loa;assert.equal(review.good[0].text,'기회량 확보');assert.equal(review.good[0].basis,'manual');assert.equal(review.bad[0].text,'Close 공백 점검');});
check('a different period or empty review has no invented LOA observation or practice',()=>{for(const review of [analyze([photo],'2025-05-01').reviews.loa,analyze([empty],'2024-05-01').reviews.loa]){assert.equal(review.coverage,0);assert.deepEqual(review.suggestions,[]);assert.deepEqual(review.good,[]);}});
check('adding LOA preserves existing pitch and attitude review coverage',()=>{assert.equal(report.reviews.pitch.good[0].text,'설명을 짧게');assert.equal(report.reviews.attitude.good[0].text,'밝게 인사');});
const dto=await projectAnalysisRecord(photo);
check('image-free index preserves all three review categories exactly',()=>{assert.deepEqual(analyze([dto],'2024-05-01').reviews,analyze([photo],'2024-05-01').reviews);});
check('older improvement evidence is not displaced by two newer positive reviews',()=>{
  const older=sheet('older');older.date='2024-04-29';older.review.pitch.bad='핵심 설명을 짧게';
  const recent=sheet('recent');recent.review.pitch.good='설명과 핵심 전달을 잘했다';
  const newer=sheet('newer');newer.review.pitch.good='짧게 설명했다';
  const practice=analyze([older,recent,newer],'2024-05-01').reviews.pitch.suggestions.find(item=>item.label==='설명과 핵심 전달');
  assert.equal(practice.count,3);assert.equal(practice.improvementCount,1);assert.equal(practice.evidence.length,1);assert.equal(practice.evidence[0].date,'2024-04-29');assert.equal(practice.evidence[0].kind,'bad');assert.equal(practice.evidence[0].text,'핵심 설명을 짧게');
});
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
