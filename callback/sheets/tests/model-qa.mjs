import assert from 'node:assert/strict';
const m = await import(new URL('../field-days.js', import.meta.url));
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log(`PASS ${name}`);};
const ctx={date:'2026-11-10',name:'가상멤버',firstField:'2026-11-03',today:'2026-11-21'};
check('saved checked zero is worked',()=>assert.equal(m.isWorkedDay({name:'가상멤버',count:0,checked:true},ctx),true));
check('positive count is worked',()=>assert.equal(m.isWorkedDay({name:'가상멤버',count:2},ctx),true));
for(const [name,entry,extra={}] of [
 ['unrecorded',null],['unchecked zero',{count:0}],['NA',{count:8,checked:true,na:true}],
 ['rally',{count:8,checked:true,rally:true}],['cleared',{count:8,checked:true,cleared:true}],
 ['different name',{name:'다른사람',count:8,checked:true}],
 ['before first field',{count:8,checked:true},{date:'2026-11-02'}],
 ['future',{count:8,checked:true},{date:'2026-11-22'}],
 ['invalid calendar date',{count:8,checked:true},{date:'2026-11-31'}]
])check(`exclude ${name}`,()=>assert.equal(m.isWorkedDay(entry,{...ctx,...extra}),false));
check('month date scope bounded to today',()=>assert.deepEqual(m.monthDates('2026-11','2026-11-03'),['2026-11-01','2026-11-02','2026-11-03']));
check('future month has no worked candidates',()=>assert.deepEqual(m.monthDates('2026-12','2026-11-21'),[]));
check('real leap date only',()=>{assert.equal(m.validDate('2024-02-29'),true);assert.equal(m.validDate('2026-02-29'),false);});
check('workbook today uses KST at UTC day boundary',()=>{assert.equal(m.workbookToday(new Date('2026-11-21T20:00:00Z')),'2026-11-22');assert.equal(m.workbookToday(new Date('2026-11-21T14:59:59Z')),'2026-11-21');});
const stamp='2026-11-10T08:00:00.000Z';
const legacy={info:{date:ctx.date,name:ctx.name},logs:[{type:'contact',t:stamp}]};
check('legacy meaningful record exists',()=>assert.equal(m.legacyRecordStatus(legacy,ctx.date,ctx.name),'legacy'));
check('empty auto-created legacy session not record',()=>assert.equal(m.legacyRecordStatus({info:{date:ctx.date,name:ctx.name},logs:[],rehashes:[],objections:[]},ctx.date,ctx.name),'missing'));
check('tombstoned legacy action ignored',()=>assert.equal(m.legacyRecordStatus({...legacy,tomb:{[`l:${stamp}|contact`]:true}},ctx.date,ctx.name),'missing'));
check('other name legacy cannot satisfy submission',()=>assert.equal(m.legacyRecordStatus(legacy,ctx.date,'다른사람'),'unknown'));
check('wrong dated legacy record not satisfy submission',()=>assert.equal(m.legacyRecordStatus(legacy,'2026-11-09',ctx.name),'unknown'));
const paper={id:'synthetic-paper',date:ctx.date,rows:[{contact:0,stop:null,presentation:null,close:null,rehash:null}],review:{}};
check('explicit zero paper valid evidence',()=>assert.equal(m.paperRecordStatus(paper),'paper'));
check('empty draft is not paper evidence',()=>assert.equal(m.paperRecordStatus({...paper,rows:[{}]}),'missing'));
check('written-date photo counts, capture-date photo unknown',()=>{assert.equal(m.paperRecordStatus({...paper,source:{type:'photo',dateBasis:'written'}}),'paper');assert.equal(m.paperRecordStatus({...paper,source:{type:'photo',dateBasis:'capture'}}),'unknown');});
check('deleted paper ignored',()=>assert.equal(m.paperRecordStatus({...paper,deleted:true}),'missing'));
const days=[{date:ctx.date,count:0,legacyStatus:'missing'}];
check('confirmed missing is pending',()=>assert.equal(m.compareFieldDays(days,[],{archiveConfirmed:true})[0].recordStatus,'missing'));
check('failed/unconfirmed read cannot assert missing',()=>assert.equal(m.compareFieldDays(days,[],{archiveConfirmed:false})[0].recordStatus,'unknown'));
check('legacy duplicate still one satisfied date',()=>{const r=m.compareFieldDays([{...days[0],legacyStatus:'legacy'}],[paper,{...paper,id:'duplicate'}],{archiveConfirmed:true});assert.equal(r.length,1);assert.equal(r[0].recordStatus,'paper');});
check('local pending paper clearly differentiated',()=>{const r=m.compareFieldDays(days,[paper],{archiveConfirmed:false,archivePending:true})[0];assert.equal(r.recordStatus,'paper');assert.equal(r.localPending,true);});
check('unknown old/photo evidence not missing',()=>{assert.equal(m.compareFieldDays([{...days[0],legacyStatus:'unknown'}],[],{archiveConfirmed:true})[0].recordStatus,'unknown');assert.equal(m.compareFieldDays(days,[{...paper,source:{type:'photo',dateBasis:'capture'}}],{archiveConfirmed:true})[0].recordStatus,'unknown');});
console.log(JSON.stringify({checks,passed:true,realDataRequests:0,realWrites:0}));
