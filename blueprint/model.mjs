import {FRAMEWORKS,QUESTIONS,FOUNDATIONS} from './content.mjs';
export const todayKST = (now=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function emptyDocument(){return {
  version:1,identity:{name:'Presence · 프레젠스',meaning:'',vision:'',mission:'',influence:'',boundaries:'',chant:'',status:'draft',logo:'01-mutual',logoNotes:''},
  values:{framework:'people',status:'draft',drafts:Object.fromEntries(Object.entries(FRAMEWORKS).map(([key,value])=>[key,value.rows.map(r=>({letter:r[0],word:r[1],meaning:r[2],behavior:r[3],evidence:r[4],avoid:r[5]}))]))},
  goals:{deadline:'2026-12-31',asOf:todayKST(),includes:'unknown',total:{current:null,target:null},leaders:{current:null,target:null},first:{current:null,target:null},quality:'',recruiting:'',notes:''},
  promotion:{currentRole:'',targetRole:'',deadline:'',firstRequired:null,leadersRequired:null,source:'',otherCriteria:'',candidate:'',candidateGap:'',nextAction:'',reviewer:'',status:'unverified'},
  foundations:Object.fromEntries(FOUNDATIONS.map(([id])=>[id,{answer:'',owner:'',next:'',status:'draft'}])),
  answers:{},actions:[],reviews:[],nextReview:''
};}
export function ratio(current,target){if(current===null||target===null||!Number.isFinite(current)||!Number.isFinite(target)||target<=0)return null;return {percent:Math.round(current/target*1000)/10,remaining:Math.max(0,target-current),complete:current>=target};}
export function daysLeft(deadline,now=todayKST()){if(!validDate(deadline)||!validDate(now))return null;return Math.ceil((Date.parse(deadline+'T00:00:00Z')-Date.parse(now+'T00:00:00Z'))/86400000);}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
export function insights(doc){const {total,leaders,first,includes}=doc.goals,out=[];if(includes==='included'){
 if(total.current!==null&&leaders.current!==null&&leaders.current>total.current)out.push('집계 확인: 전체 리더 수가 전체 인원보다 많습니다.');
 if(leaders.current!==null&&first.current!==null&&first.current>leaders.current)out.push('집계 확인: 퍼스트 리더 수가 전체 리더 수보다 많습니다.');
 if(total.current!==null&&leaders.target!==null&&leaders.target>total.current)out.push(`리더 목표를 이루려면 현재 전체 인원보다 최소 ${leaders.target-total.current}명의 순인원 증가가 필요합니다. 채용·정착·이탈 계획을 함께 확인하세요.`);
 if(total.target!==null&&leaders.target!==null&&leaders.target>total.target)out.push('목표 확인: 전체 리더 목표가 전체 인원 목표보다 많습니다.');
 if(leaders.target!==null&&first.target!==null&&first.target>leaders.target)out.push('목표 확인: 퍼스트 리더 목표가 전체 리더 목표보다 많습니다.');
 }else out.push('전체 인원·전체 리더·퍼스트 리더의 포함 관계를 먼저 확인하세요.');return out;}
export function nextQuestions(doc){const answer=id=>doc.answers[id]?.text?.trim()||({influence:doc.identity.influence,boundaries:doc.identity.boundaries,candidate:doc.promotion.candidate&&doc.promotion.candidateGap,promotionDate:doc.promotion.deadline&&doc.promotion.reviewer,recruiting:doc.goals.recruiting,quality:doc.goals.quality}[id]);return QUESTIONS.filter(([id])=>!answer(id)).slice(0,3);}
export function answeredCount(doc){return QUESTIONS.filter(([id])=>doc.answers[id]?.text?.trim()).length;}
const text=(v,max=12000)=>{if(typeof v!=='string'||v.length>max)throw Error('텍스트 형식 또는 길이를 확인해주세요.');return v;};
const number=v=>{if(v===null||v==='')return null;if(typeof v!=='number'||!Number.isInteger(v)||v<0||v>1000000)throw Error('인원은 0 이상의 정수로 입력해주세요.');return v;};
const choose=(v,options)=>{if(!options.includes(v))throw Error('선택값을 확인해주세요.');return v;};
const date=v=>{text(v,10);if(v&&!validDate(v))throw Error('날짜를 확인해주세요.');return v;};
export function validateDocument(input){if(!input||input.version!==1)throw Error('지원하지 않는 초안 형식입니다.');const d=emptyDocument();
 for(const key of Object.keys(d.identity))d.identity[key]=text(input.identity?.[key]??d.identity[key]);
 choose(d.identity.status,['draft','decided']);choose(d.identity.logo,['01-mutual','02-common-path','03-open-circle','04-join','05-side-by-side']);
 d.values.framework=choose(input.values?.framework||'people',Object.keys(FRAMEWORKS));d.values.status=choose(input.values?.status||'draft',['draft','decided']);
 for(const key of Object.keys(FRAMEWORKS)){const rows=input.values?.drafts?.[key];if(!rows)continue;if(!Array.isArray(rows)||rows.length!==d.values.drafts[key].length)throw Error('코어밸류 항목을 확인해주세요.');d.values.drafts[key]=rows.map((r,i)=>Object.fromEntries(Object.keys(d.values.drafts[key][i]).map(k=>[k,text(r[k]??'')])));}
 for(const key of ['deadline','asOf'])d.goals[key]=date(input.goals?.[key]??d.goals[key]);
 d.goals.includes=choose(input.goals?.includes||'unknown',['included','separate','unknown']);
 for(const group of ['total','leaders','first'])for(const key of ['current','target'])d.goals[group][key]=number(input.goals?.[group]?.[key]??null);
 for(const key of ['quality','recruiting','notes'])d.goals[key]=text(input.goals?.[key]??'');
 for(const key of Object.keys(d.promotion)){const value=input.promotion?.[key]??d.promotion[key];d.promotion[key]=['firstRequired','leadersRequired'].includes(key)?number(value):key==='deadline'?date(value):text(value);}
 choose(d.promotion.status,['unverified','verified']);
 for(const [id]of FOUNDATIONS)for(const key of Object.keys(d.foundations[id]))d.foundations[id][key]=text(input.foundations?.[id]?.[key]??d.foundations[id][key]);
 for(const item of Object.values(d.foundations))choose(item.status,['draft','decided','tested']);
 for(const [id]of QUESTIONS){if(!input.answers?.[id])continue;d.answers[id]={text:text(input.answers[id].text||''),status:choose(input.answers[id].status||'draft',['draft','decided'])};}
 for(const kind of ['actions','reviews']){const rows=input[kind]||[];if(!Array.isArray(rows)||rows.length>200)throw Error('기록은 종류별 200개까지 저장할 수 있습니다.');d[kind]=rows.map(r=>kind==='actions'?{id:text(r.id,100),title:text(r.title,500),owner:text(r.owner||'',100),due:date(r.due||''),done:r.done===true}:{id:text(r.id,100),date:date(r.date||''),text:text(r.text||'')});if(new Set(d[kind].map(r=>r.id)).size!==rows.length)throw Error('기록 ID가 중복됩니다.');}
 d.nextReview=date(input.nextReview||'');return d;
}
export function summary(doc,scopes=['identity','values']){const lines=['PRESENCE · 팀 설계 노트',`작성 기준: ${todayKST()} (한국 시간)`];
 if(scopes.includes('identity')){const x=doc.identity;lines.push('\n[이름과 비전 · '+(x.status==='decided'?'확정':'초안')+']',x.name,'이름의 의미: '+x.meaning,'비전: '+x.vision,'미션: '+x.mission,'함께할 사람: '+x.influence,'팀챈트:\n'+x.chant);}
 if(scopes.includes('values')){lines.push('\n[코어밸류 · '+(doc.values.status==='decided'?'확정':'제안 / 검토 중')+']',FRAMEWORKS[doc.values.framework].name);for(const r of doc.values.drafts[doc.values.framework])lines.push(`${r.letter} · ${r.word} — ${r.meaning}`,`행동: ${r.behavior}`,`증거: ${r.evidence}`,`하지 않을 행동: ${r.avoid}`);lines.push('절대 넘지 않을 선: '+doc.identity.boundaries);}
 if(scopes.includes('goals')){lines.push('\n[연말 성장 목표]',`기준일 ${doc.goals.asOf} / 마감 ${doc.goals.deadline}`);for(const [key,label]of [['total','전체 인원'],['leaders','전체 리더'],['first','퍼스트 리더']]){const g=doc.goals[key],r=ratio(g.current,g.target);lines.push(`${label}: ${g.current??'미입력'} / ${g.target??'미정'}명${r?` · 현재 인원 기준 ${r.percent}% · ${r.remaining}명 남음`:''}`);}lines.push('집계: '+({included:'전체 인원 안에 전체 리더, 전체 리더 안에 퍼스트 리더 포함',separate:'별도 인원 집계',unknown:'포함 관계 미확인'}[doc.goals.includes]),'품질 기준: '+doc.goals.quality,'채용·정착: '+doc.goals.recruiting);}
 if(scopes.includes('promotion')){const p=doc.promotion;lines.push('\n[프로모션 · '+(p.status==='verified'?'조건 확인됨':'조건 확인 필요')+']',`${p.currentRole} → ${p.targetRole}`,`목표일: ${p.deadline||'미정'}`,`퍼스트 리더: ${doc.goals.first.current??'미입력'}/${p.firstRequired??'미정'}`,`전체 리더: ${doc.goals.leaders.current??'미입력'}/${p.leadersRequired??'미정'}`,'조건 근거: '+p.source,'추가 조건: '+p.otherCriteria,'후보: '+p.candidate,'남은 과제: '+p.candidateGap,'다음 행동: '+p.nextAction,'최종 프로모션은 공식 기준과 심사 확인이 필요합니다.');}
 if(scopes.includes('company'))for(const [id,label]of FOUNDATIONS){const x=doc.foundations[id];lines.push(`\n[${label} · ${x.status}]`,x.answer,`담당: ${x.owner} / 다음 행동: ${x.next}`);}
 if(scopes.includes('dialogue')){lines.push('\n[질문과 답변]');for(const [id,,q]of QUESTIONS)if(doc.answers[id]?.text)lines.push(q,doc.answers[id].text);lines.push('\n[이어갈 질문]',...nextQuestions(doc).map(q=>q[2]),'\n[실행]',...doc.actions.map(x=>`${x.done?'완료':'진행 전'} · ${x.title} · ${x.owner} · ${x.due}`));}
 return lines.join('\n');}
