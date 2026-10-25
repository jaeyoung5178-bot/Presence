import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('./sales-model.js',import.meta.url),'utf8');
const {buildRecentSales} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const member = {id:'a',sourceId:'a',name:'가람'};
const state = {users:{a:{name:'가람'},b:{name:'나래'}},sales:{
  '2026-10-20':{a:{count:2,t:1},가람:{name:'가람',count:3,t:2}},
  '2026-10-21|가람':{count:0},
  '2026-10-22|가람':{uid:'a',name:'old name',count:4,rejectCLCount:90,resubmitSWCount:80},
  '2026-10-23|a':{uid:'a',type:'CL',count:2},
  '2026-10-23|가람':{uid:'a',type:'SW',count:3},
  '2026-10-24|가람':{count:0,na:true},
  '2026-10-25|가람':{uid:'b',count:999},
  '2026-10-26|가람':{count:999},
}};
const result = buildRecentSales(state,member,{today:'2026-10-25'});
assert.deepEqual(result.sevenDays.map(day => day.sales),[null,3,0,4,5,null,null]);
assert.equal(result.recent7.total,12);
assert.equal(result.recent7.recordedDays,4);
assert.equal(result.recent7.average,3);
assert.equal(result.calendar30.days.length,30);
assert.equal(result.calendar30.weeks.flat().filter(Boolean).length,30);
assert.ok(result.calendar30.weeks.every(week => week.length === 7));
assert.equal(JSON.stringify(state).includes('_identity'),false,'pure input');
for (const [today,start] of [['2024-03-01','2024-02-01'],['2025-01-01','2024-12-03'],['2026-03-01','2026-01-31']]) {
  const r = buildRecentSales({},member,{today});
  assert.equal(r.calendar30.start,start);
  assert.equal(r.recent7.total,null);
  assert.equal(r.recent7.average,null);
  const first = r.calendar30.weeks[0].findIndex(Boolean);
  assert.equal(first,(new Date(`${start}T00:00:00Z`).getUTCDay()+6)%7);
}
assert.equal(buildRecentSales({},member,{today:'2026-10-24T14:59:59Z'}).today,'2026-10-24');
assert.equal(buildRecentSales({},member,{today:'2026-10-24T15:00:00Z'}).today,'2026-10-25');
const duplicateNames = {users:{a:{name:'동명이인'},b:{name:'동명이인'}},sales:{'2026-10-25':{동명이인:{count:9},a:{uid:'a',type:'CL',count:1},b:{uid:'b',type:'SW',count:8}}}};
assert.equal(buildRecentSales(duplicateNames,{id:'a',name:'동명이인'},{today:'2026-10-25'}).recent7.total,1);
const excluded = {users:{a:{name:'가람',surveys:{first:{answers:{firstField:'2026-10-22'}}}}},sales:{'2026-10-21|가람':{count:8},'2026-10-22|가람':{count:2},'2026-10-23|가람':{count:0,rally:true},'2026-10-24|가람':{count:3,cleared:true},'2026-10-25|가람':{count:''}}};
assert.equal(buildRecentSales(excluded,member,{today:'2026-10-25'}).recent7.total,2);
assert.throws(() => buildRecentSales({},member,{today:'invalid'}),TypeError);
console.log('sales-model: identity, aliases, campaign totals, zero/missing, exclusions, date boundaries and KST passed');
