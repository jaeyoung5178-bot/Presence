import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Requires Playwright and Python 3; all remote network requests are blocked.
const {chromium}=await import(process.env.PRESENCE_PLAYWRIGHT_MODULE || 'playwright');
const root=process.env.PRESENCE_QA_ROOT||fileURLToPath(new URL('../../../',import.meta.url));
const out=process.env.PRESENCE_QA_OUTPUT||await fs.mkdtemp(path.join(os.tmpdir(),'presence-date-move-qa-'));
await fs.mkdir(out,{recursive:true});
const port=process.env.PRESENCE_QA_PORT||'3282',baseline=process.env.PRESENCE_QA_BASELINE==='1';
const server=spawn(process.env.PRESENCE_QA_PYTHON||'python3',['-m','http.server',port,'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
await new Promise(r=>setTimeout(r,500));
const browser=await chromium.launch({headless:true,executablePath:process.env.PRESENCE_QA_CHROME||undefined});
const context=await browser.newContext({timezoneId:'Asia/Seoul'}),page=await context.newPage();
const blocked=[],pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===`http://127.0.0.1:${port}`)return r.continue();blocked.push(r.request().url());return r.abort();});
let result;
try{
 await page.goto(`http://127.0.0.1:${port}/callback/sheets/index.html`);
 result=await page.evaluate(async({baseline})=>{
  const {createSheetStorage}=await import('./storage.js?qa=date-move-isolated');
  const {createSheet}=await import('./sheet-model.js?qa=date-move-isolated');
  const copy=x=>structuredClone(x),oldDate='2026-08-06',newDate='2026-08-04',cases=[];
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const sourceImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=';
  function seed(id='synthetic-original',date=oldDate){const s=createSheet(new Date('2026-08-06T03:00:00Z'));s.id=id;s.date=date;s.meta.name='가상날짜검수';s.meta.location='합성 원본 장소';s.rows[0].contact=7;s.objections='합성 기록 원본 보존';return s;}
  function setup({kind='normal',guest=false,other=false,photo=false}={}){
   let identity={uid:guest?'':'qa-date-a',namespace:guest?'guest':'user:qa-date-a',name:'가상날짜검수',signature:guest?'guest':'qa-date-a-signature',accessKey:guest?'':'synthetic-only'};
   const initial=seed();if(photo)initial.source={type:'photo',imageDataUrl:sourceImage,filename:'synthetic-original.png',notes:'원본 보존',duplicateCount:0,dateBasis:'written'};
   const documents={},versions={},calls={reads:0,writes:0,maxConcurrent:0,activeWrites:0,deletes:0},perUid=new Map();
   const pack=(s,revision='base-revision')=>({version:1,revision,updatedAt:s.updatedAt,deleted:false,sheet:copy(s)});
   documents[initial.id]=pack(initial);versions[initial.id]=1;
   if(other){const s=seed('synthetic-existing-target',newDate);s.objections='목적지의 별개 기록 반드시 보존';documents[s.id]=pack(s,'other-revision');versions[s.id]=1;}
   perUid.set('qa-date-a',documents);
   const cloud={
    readAll:async ctx=>{calls.reads++;return copy(perUid.get(ctx.uid)||{});},
    read:async(id,ctx)=>{calls.reads++;return{ok:true,status:200,data:copy((perUid.get(ctx.uid)||{})[id]||null),etag:`"qa-${versions[id]||0}"`};},
    write:async(id,doc,etag,ctx)=>{
     calls.writes++;calls.activeWrites++;calls.maxConcurrent=Math.max(calls.maxConcurrent,calls.activeWrites);
     try{
      if(kind==='delayed')await new Promise(r=>setTimeout(r,40));
      if(kind==='etag-same'&&calls.writes===1){documents[id]={...copy(documents[id]),revision:'external-version-only',updatedAt:'2026-08-06T03:00:01Z',sheet:{...copy(documents[id].sheet),updatedAt:'2026-08-06T03:00:01Z'}};versions[id]++;return{ok:false,status:412};}
      if(kind==='etag-real'&&calls.writes===1){documents[id]={...copy(documents[id]),revision:'external-meaningful-change',updatedAt:'2026-08-06T03:00:01Z',sheet:{...copy(documents[id].sheet),objections:'다른 기기의 실제 변경 반드시 보존',updatedAt:'2026-08-06T03:00:01Z'}};versions[id]++;return{ok:false,status:412};}
      if(etag!==`"qa-${versions[id]||0}"`)return{ok:false,status:412};
      if(doc.deleted)calls.deletes++;
      const records=perUid.get(ctx.uid)||{};records[id]=copy(doc);perUid.set(ctx.uid,records);versions[id]=(versions[id]||0)+1;return{ok:true,status:200};
     }finally{calls.activeWrites--;}
    }
   };
   const dbName=`qa-date-move-${kind}-${crypto.randomUUID()}`;
   const storage=createSheetStorage({dbName,readIdentity:()=>copy(identity),cloud,eventTarget:new EventTarget(),broadcast:null});
   const fresh=()=>createSheetStorage({dbName:`qa-date-reload-${crypto.randomUUID()}`,readIdentity:()=>copy(identity),cloud,eventTarget:new EventTarget(),broadcast:null});
   return{storage,fresh,cloud,initial,documents,calls,identity:()=>copy(identity),switchIdentity:v=>identity=v,pack};
  }
  async function connected(f){if(f.identity().uid)await f.storage.syncSheets();else await f.storage.saveSheet(f.initial,{deferSync:true});return(await f.storage.loadSheets()).find(s=>s.id===f.initial.id);}
  async function summarize(name,f,expectedCount=1){const rows=await f.storage.loadSheets();const remote=Object.values(f.documents).filter(d=>!d.deleted);const value={name,local:rows.map(s=>({id:s.id,date:s.date,text:s.objections})),remote:remote.map(d=>({id:d.sheet.id,date:d.sheet.date,text:d.sheet.objections})),calls:copy(f.calls)};cases.push(value);assert(f.calls.deletes===0,`${name}: date edits must not delete records`);assert(rows.length===expectedCount,`${name}: local count ${rows.length} expected ${expectedCount}`);return rows;}
  for(const photo of [false,true]){
   const f=setup({kind:photo?'restore-photo':'restore-manual',photo,other:true}),original=await connected(f);
   const rawBackup=JSON.stringify(original),targetBefore=JSON.stringify((await f.storage.loadSheets()).find(s=>s.id==='synthetic-existing-target'));
   await f.storage.deleteSheet(original.id,{owner:f.identity().namespace});
   let rows=await f.storage.loadSheets();assert(rows.length===1&&JSON.stringify(rows[0])===targetBefore,'delete only source, preserve target exact');
   if(photo){const skipped=await f.storage.saveSheet(JSON.parse(rawBackup),{owner:f.identity().namespace,importOriginal:true});assert(skipped.skipped&&skipped.deleted,'same-id photo tombstone requires a new restore id');assert((await f.storage.loadSheets()).length===1,'same-id photo import remains deleted');}
   const restore=JSON.parse(rawBackup);restore.id=photo?'synthetic-restored-photo':'synthetic-restored-manual';
   await f.storage.saveSheet(restore,{owner:f.identity().namespace,importOriginal:photo});
   rows=await f.storage.loadSheets();const restored=rows.find(s=>s.id===restore.id),strip=s=>{const c=copy(s);delete c.id;delete c.updatedAt;return c;};
   assert(rows.length===2&&JSON.stringify(strip(restored))===JSON.stringify(strip(JSON.parse(rawBackup))),'backup import restores exact body including source and row ids');
   assert(JSON.stringify(rows.find(s=>s.id==='synthetic-existing-target'))===targetBefore,'restore preserves existing target exact');
   const reload=f.fresh();await reload.syncSheets();const freshRows=await reload.loadSheets();assert(freshRows.length===2&&freshRows.some(s=>s.id===restore.id),'restored body survives fresh cloud reload');
   cases.push({name:photo?'photo-delete-new-id-backup-import-recovery':'manual-delete-new-id-backup-import-recovery',passed:true,backup:JSON.parse(rawBackup),restoredId:restore.id,bodyExactExceptIdAndUpdatedAt:true,existingTargetUntouched:true,freshReload:true,sameIdPhotoImportSkips:photo,calls:copy(f.calls)});
  }
  {
   const f=setup(),original=await connected(f),saved=await f.storage.saveSheet({...copy(original),date:newDate},{baseDate:oldDate});
   const rows=await summarize('normal-same-id-date-move',f);assert(saved.sheet.id===original.id&&rows[0].date===newDate,'normal move identity/date');
   const reload=f.fresh();await reload.syncSheets();const freshRows=await reload.loadSheets();assert(freshRows.length===1&&freshRows[0].date===newDate,'normal move cloud fresh reload');
  }
  {
   const f=setup({kind:'stale'}),original=await connected(f);await f.storage.saveSheet(copy(original));await f.storage.saveSheet({...copy(original),date:newDate},{baseDate:oldDate});
   const rows=await summarize('stale-version-date-only-move',f,baseline?2:1);if(!baseline)assert(rows[0].id===original.id&&rows[0].date===newDate,'stale move must preserve canonical id');
  }
  {
   const f=setup({kind:'delayed'}),original=await connected(f),input={...copy(original),date:newDate};
   await Promise.all([f.storage.saveSheet(copy(input),{baseDate:oldDate}),f.storage.saveSheet(copy(input),{baseDate:oldDate})]);
   const rows=await summarize('double-save-delayed-response',f,baseline?2:1);assert(f.calls.maxConcurrent===1,'save serialization');if(!baseline)assert(rows[0].id===original.id&&rows[0].date===newDate,'double save canonical id');
  }
  {
   const f=setup({other:true}),original=await connected(f);await f.storage.saveSheet({...copy(original),date:newDate},{baseDate:oldDate});
   const rows=await summarize('existing-target-date-record-preserved',f,2);assert(rows.every(s=>s.date===newDate),'old date removed with target data');assert(rows.some(s=>s.id==='synthetic-existing-target'&&s.objections==='목적지의 별개 기록 반드시 보존'),'target existing preserved');
  }
  {
   const f=setup({photo:true}),original=await connected(f);await f.storage.saveSheet({...copy(original),date:newDate},{baseDate:oldDate});const rows=await summarize('original-photo-preserved',f);assert(rows[0].source.imageDataUrl===sourceImage&&rows[0].source.filename==='synthetic-original.png','original photo payload unchanged');
  }
  {
   const f=setup({kind:'stale-photo',photo:true}),original=await connected(f);await f.storage.saveSheet(copy(original));await f.storage.saveSheet({...copy(original),date:newDate},{baseDate:oldDate});const rows=await summarize('stale-original-photo-preserved',f,baseline?2:1);assert(rows.every(s=>s.source.imageDataUrl===sourceImage&&s.source.filename==='synthetic-original.png'),'stale move original photo payload unchanged');if(!baseline)assert(rows[0].id===original.id&&rows[0].date===newDate,'stale photo canonical id');
  }
  {
   const f=setup({kind:'true-content-conflict'}),original=await connected(f);const changed=copy(original);changed.rows[0].contact=8;await f.storage.saveSheet(changed);let blocked=false;try{await f.storage.saveSheet({...copy(original),date:newDate},{baseDate:oldDate});}catch(e){assert(!baseline&&e.name==='DateMoveConflictError','typed date conflict');blocked=true;}
   const rows=await summarize('stale-meaningful-count-conflict-preserved',f,baseline?2:1);assert(rows.some(s=>s.rows[0].contact===8&&s.date===oldDate),'latest count preserved');if(baseline)assert(rows.some(s=>s.rows[0].contact===7&&s.date===newDate),'baseline fork body preserved');else{assert(blocked,'meaningful stale date move blocked');await f.storage.saveDraft({...copy(original),date:newDate},{baseDate:oldDate});const d=await f.storage.loadDraft({includeBase:true});assert(d.baseDate===oldDate&&d.sheet.date===newDate&&d.sheet.rows[0].contact===7,'blocked input retained in draft');}
  }
  {
   const f=setup({guest:true}),original=await connected(f);await f.storage.saveSheet(copy(original),{deferSync:true});await f.storage.saveSheet({...copy(original),date:newDate},{deferSync:true,baseDate:oldDate});const rows=await summarize('guest-stale-date-only-move',f,baseline?2:1);assert(f.calls.reads===0&&f.calls.writes===0,'guest remains local');if(!baseline)assert(rows[0].id===original.id,'guest canonical id');
  }
  {
   const f=setup({kind:'account'}),original=await connected(f);f.switchIdentity({uid:'qa-date-b',namespace:'user:qa-date-b',name:'다른가상계정',signature:'qa-date-b-signature',accessKey:'synthetic-only-b'});
   let rejected=false;try{await f.storage.saveSheet({...copy(original),date:newDate},{owner:'user:qa-date-a'});}catch(e){rejected=e.name==='IdentityChangedError';}assert(rejected,'cross-account stale owner rejected');await f.storage.syncSheets();assert((await f.storage.loadSheets()).length===0,'other account cannot see original');assert(f.documents[original.id].sheet.date===oldDate,'original account record unchanged');cases.push({name:'account-owner-isolation',passed:true,calls:copy(f.calls)});
  }
  for(const kind of ['etag-same','etag-real']){
   const f=setup({kind}),original=await connected(f);let blocked=false;try{await f.storage.saveSheet({...copy(original),date:newDate},{baseDate:oldDate});}catch(e){assert(!baseline&&kind==='etag-real'&&e.name==='DateMoveConflictError','typed ETag date conflict');blocked=true;}
   const rows=await summarize(kind,f,baseline?2:1);
   if(kind==='etag-real'){if(baseline)assert(rows.some(s=>s.objections==='다른 기기의 실제 변경 반드시 보존'),'meaningful remote change preserved');else{assert(blocked,'meaningful remote date move blocked');assert(f.documents[original.id].sheet.objections==='다른 기기의 실제 변경 반드시 보존','server original preserved');assert(rows[0].id===original.id&&rows[0].date===newDate&&f.storage.getStorageStatus().pending===1,'local input pending same id');}assert(rows.some(s=>s.objections==='합성 기록 원본 보존'&&s.date===newDate),'local date correction preserved');}
   else if(!baseline)assert(rows[0].id===original.id&&rows[0].date===newDate,'version-only ETag conflict must not duplicate');
  }
  if(!baseline){
   const f=setup({kind:'unknown-base'}),original=await connected(f);await f.storage.saveSheet(copy(original));let blocked=false;try{await f.storage.saveSheet({...copy(original),date:newDate});}catch(e){blocked=e.name==='DateMoveConflictError';}assert(blocked,'stale date move without known base is blocked');const rows=await summarize('unknown-base-legacy-draft-blocked',f);assert(rows[0].date===oldDate&&rows[0].id===original.id,'unverified date move not applied');
   await f.storage.saveDraft({...copy(original),date:newDate},{baseDate:oldDate});assert((await f.storage.loadDraft()).date===newDate,'legacy loadDraft shape remains sheet');const draft=await f.storage.loadDraft({includeBase:true});assert(draft.baseDate===oldDate&&draft.sheet.date===newDate,'new draft baseDate retained');
   const g=setup({kind:'etag-real',other:true}),a=await connected(g);let aBlocked=false;try{await g.storage.saveSheet({...copy(a),date:newDate},{baseDate:oldDate});}catch(e){aBlocked=e.name==='DateMoveConflictError';}assert(aBlocked,'A date conflict initially blocked');const b=(await g.storage.loadSheets()).find(s=>s.id==='synthetic-existing-target');const savedB=await g.storage.saveSheet({...copy(b),objections:'B 정상 저장 확인'},{baseDate:b.date});assert(savedB.cloudSaved===true,'B reported cloud saved despite A pending');assert(g.documents[b.id].sheet.objections==='B 정상 저장 확인','B reached remote');const aLocal=(await g.storage.loadSheets()).find(s=>s.id===a.id);assert(aLocal.date===newDate&&aLocal.objections==='합성 기록 원본 보존','A local pending input still preserved');assert(g.documents[a.id].sheet.date===oldDate&&g.documents[a.id].sheet.objections==='다른 기기의 실제 변경 반드시 보존','A remote original still preserved');assert(g.storage.getStorageStatus().pending===1&&g.storage.getStorageStatus().blockedDateMoves===1,'only A is pending/blocked');cases.push({name:'blocked-A-does-not-block-normal-B',passed:true,aPendingPreserved:true,bCloudSaved:true,blockedDateMoves:1,calls:copy(g.calls)});
  }
  return{passed:true,baseline,cases,realDataRequests:0,realWrites:0};
 },{baseline});
 result.pageErrors=pageErrors;result.blockedExternal=blocked;
 await fs.writeFile(`${out}/${baseline?'baseline':'fixed'}-storage-report.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}catch(e){await fs.writeFile(`${out}/${baseline?'baseline':'fixed'}-storage-failure.json`,JSON.stringify({passed:false,message:e.message,stack:e.stack,pageErrors,blocked},null,2));throw e;}
finally{await browser.close();server.kill();}
