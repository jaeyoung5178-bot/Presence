// Dry run by default. Production publication is deliberately separate from preparation.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const OWNER='umqn5es9t',NAME='박인선',ROOT='teamBuildingSupport';
const base='https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app';
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const sha=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const node=()=>read(path.join(__dirname,'teamBuildingSupport.node.json'));
function guard(rules){if(rules.rules?.['.read']!==false||rules.rules?.['.write']!==false)throw Error('Root ancestor permissions changed; review required');if(rules.rules[ROOT]!==undefined)throw Error('Team-building rule node already exists; never overwrite');}
function withoutFeature(rules){const r=structuredClone(rules);delete r.rules[ROOT];return r;}
function names(value){if(Array.isArray(value))return value.filter(x=>typeof x==='string');return Object.entries(value||{}).flatMap(([k,v])=>typeof v==='string'?[v]:v===true||v?.name?[v?.name||k]:[]);}
function propose(source,live){
 const users=source.users||{},dossier=source.dossier||{},matches=Object.entries(users).filter(([,u])=>u?.name===NAME);
 if(matches.length!==1||matches[0][0]!==OWNER||matches[0][1].status!=='active'||matches[0][1].role!=='LR')throw Error('Canonical Park Inseon identity requires fresh administrator review');
 const allowed=new Set(names(source.allowedMembers)),removed=new Set([...names(source.removedMembers),...names(source.departedMembers)]),byName=new Map(Object.entries(users).map(([uid,u])=>[u?.name,{uid,...u}])),members={},candidates=[];
 for(const [key,p]of Object.entries(dossier)){const name=p?.name||key;if(name===NAME||/테스트|test|검증/i.test(name))continue;let cursor=name,descendant=false;const seen=new Set();for(let i=0;i<100;i++){if(seen.has(cursor))break;seen.add(cursor);const row=dossier[cursor]||Object.values(dossier).find(x=>x?.name===cursor);const up=row?.upline;if(up===NAME){descendant=true;break;}if(!up)break;cursor=up;}if(!descendant)continue;
  const account=byName.get(name),eligible=!removed.has(name)&&(account?account.status==='active'&&!account.test:allowed.has(name));
  const id=account?.uid||'member_'+crypto.createHash('sha256').update('presence-dossier:'+name).digest('hex').slice(0,24);
  candidates.push({id,name,role:account?.role||'IC',upline:p?.upline||'',eligible:live?eligible:null,accountStatus:account?.status||'no-account',signupListed:live?allowed.has(name):null,removedOrDeparted:live?removed.has(name):null,status:live?(eligible?'current-confirmed':'excluded-current-source'):'needs-live-validation'});
  if(live&&eligible)members[id]={name,role:account?.role||'IC',active:true};
 }
 const now=Date.now(),ready=live&&Object.keys(members).length>0;
 return {readyForPublication:ready,observedAt:new Date(now).toISOString(),owner:{uid:OWNER,name:NAME,role:matches[0][1].role,status:matches[0][1].status},source:live?'fresh server users+dossier+signup/departure lists':'previous authenticated local snapshot; not publication evidence',candidates,seed:ready?{config:{version:1,ownerUid:OWNER,ownerName:NAME,ownerRole:'LR',enabled:true,updatedAt:now,updatedBy:'admin'},directory:{[OWNER]:{version:1,updatedAt:now,updatedBy:'admin',members}}}:null};
}
async function connection(){
 // This does not initiate OAuth or add scopes. Run only after the user's deployment-auth approval.
 const auth=require('/Users/jaeyoung5178/.npm/_npx/872b751b2f16d338/node_modules/firebase-tools/lib/auth');
 const c=read('/Users/jaeyoung5178/.config/configstore/firebase-tools.json');
 const scopes=Array.isArray(c.tokens.scopes)?c.tokens.scopes:String(c.tokens.scope||'').split(/\s+/).filter(Boolean);
 if(!scopes.length)throw Error('Established Firebase CLI login has no recorded scope metadata');
 const token=typeof c.tokens.access_token==='string'&&c.tokens.expires_at>Date.now()+30000?c.tokens.access_token:(await auth.getAccessToken(c.tokens.refresh_token,scopes)).access_token;
 const headers={Authorization:'Bearer '+token};
 async function request(p,options={}){const r=await fetch(base+'/'+p+'.json',{...options,headers:{...headers,...options.headers}});if(!r.ok)throw Error('Firebase '+(options.method||'GET')+' '+p+' HTTP '+r.status);return {value:await r.json(),etag:r.headers.get('etag')};}
 return request;
}
(async()=>{
 const args=process.argv.slice(2),flag=k=>args.includes('--'+k),arg=k=>args.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3);
 const apply=flag('apply'),live=flag('prepare-live');
 if(!apply&&!live&&!flag('prepare-local'))throw Error('Choose --prepare-local, --prepare-live or --apply explicitly');
 if(apply&&(!flag('approved')||!arg('approved-merged-sha')||!arg('review-dir')))throw Error('Publication requires explicit approval, review directory and reviewed merged SHA');
 let rules,etag,source,request;
 if(live||apply){if(!flag('deployment-auth-approved'))throw Error('Deployment authentication scope approval is required before contacting Firebase');request=await connection();const v=await request('.settings/rules',{headers:{'X-Firebase-ETag':'true'}});rules=v.value;etag=v.etag;}
 if(!apply){
  if(!live){if(!arg('baseline')||!arg('source'))throw Error('Local preparation needs --baseline and --source');rules=read(arg('baseline'));source=read(arg('source'));}
  else{const keys={users:'users',dossier:'dossier',allowedMembers:'privateConfig/allowedMembers',removedMembers:'removedMembers',departedMembers:'privateConfig/departedMembers'},values=await Promise.all(Object.values(keys).map(p=>request(p).then(x=>x.value)));source=Object.fromEntries(Object.keys(keys).map((k,i)=>[k,values[i]]));}
  guard(rules);const proposal=propose(source,live),merged=structuredClone(rules);merged.rules[ROOT]=node();const dir=arg('output')||path.join('/private/tmp','team-building-review-'+Date.now());fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const metadata={preparedAt:new Date().toISOString(),liveValidated:live,readyForPublication:proposal.readyForPublication,beforeSHA:sha(rules),mergedSHA:sha(merged),featureNodeSHA:sha(node()),unrelatedRulesSHA:sha(withoutFeature(merged)),conditionalPUT:!!etag,changedTopLevelNodes:[ROOT]};
  for(const [name,value]of [['before.json',rules],['merged.json',merged],['roster-proposal.json',proposal],['metadata.json',metadata]])fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({mode:live?'PREPARED_LIVE_REVIEW':'PREPARED_LOCAL_ONLY',directory:dir,...metadata,candidateNames:proposal.candidates.map(x=>x.name)}));return;
 }
 const dir=arg('review-dir'),before=read(path.join(dir,'before.json')),merged=read(path.join(dir,'merged.json')),proposal=read(path.join(dir,'roster-proposal.json')),meta=read(path.join(dir,'metadata.json'));
 guard(before);guard(rules);if(!meta.liveValidated||!proposal.readyForPublication||!proposal.seed)throw Error('Local-only or incomplete roster proposal cannot be deployed');
 if(Date.now()-new Date(meta.preparedAt)>300000)throw Error('Review is older than five minutes; refresh live evidence and review again');
 if(sha(merged)!==arg('approved-merged-sha')||sha(merged)!==meta.mergedSHA||sha(merged.rules[ROOT])!==sha(node()))throw Error('Reviewed source/hash changed');
 if(sha(withoutFeature(merged))!==sha(before)||sha(rules)!==sha(before))throw Error('Unrelated or concurrent rule changes detected');
 if(!etag&&!flag('allow-no-etag'))throw Error('Rules endpoint has no ETag; explicit root-reviewed --allow-no-etag decision required');
 const freshKeys={users:'users',dossier:'dossier',allowedMembers:'privateConfig/allowedMembers',removedMembers:'removedMembers',departedMembers:'privateConfig/departedMembers'},freshValues=await Promise.all(Object.values(freshKeys).map(p=>request(p).then(x=>x.value))),freshSource=Object.fromEntries(Object.keys(freshKeys).map((k,i)=>[k,freshValues[i]])),freshProposal=propose(freshSource,true);
 if(!freshProposal.readyForPublication||stable(freshProposal.seed.directory[OWNER].members)!==stable(proposal.seed.directory[OWNER].members))throw Error('Canonical owner or eligible teammate hierarchy changed after review');
 const existing=await request(ROOT);if(existing.value!==null)throw Error('Team-building data already exists; never overwrite');
 const immediate=await request('.settings/rules',{headers:{'X-Firebase-ETag':'true'}});if(sha(immediate.value)!==sha(before))throw Error('Rules changed immediately before publication');
 await request('.settings/rules',{method:'PUT',headers:{'Content-Type':'application/json',...(immediate.etag?{'if-match':immediate.etag}:{})},body:JSON.stringify(merged)});
 const after=await request('.settings/rules');if(sha(after.value)!==sha(merged)||sha(withoutFeature(after.value))!==sha(before))throw Error('Post-publication rule readback differs; inspect before any retry');
 // Only configuration and the verified sanitized roster are initialized; never daily records.
 await request(ROOT,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(proposal.seed)});
 const saved=await request(ROOT);if(stable(saved.value)!==stable(proposal.seed))throw Error('Configuration readback differs; inspect before any retry');
 const proof={publishedAt:new Date().toISOString(),mergedSHA:sha(after.value),unrelatedRulesSHA:sha(withoutFeature(after.value)),initializedNodes:['config','directory'],initializedDailyRecords:0};fs.writeFileSync(path.join(dir,'publication-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({mode:'PUBLISHED_AND_READBACK_VERIFIED',...proof}));
})().catch(e=>{console.error(e.message);process.exit(1)});
