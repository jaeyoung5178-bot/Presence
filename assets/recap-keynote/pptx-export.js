import * as M from './model.js?v=20261009-callback-1';

// All content is drawn as editable PowerPoint text, tables, shapes and charts.
// The only runtime dependency is the same-origin, locally vendored bundle.
const W=13.333333,H=7.5,FONT='Malgun Gothic';
const C={ink:'142139',blue:'245AFF',pale:'EAF0FF',muted:'64748B',line:'DCE3ED',paper:'FFFFFF',soft:'F5F7FB',red:'C93232',green:'237E63'};
const CHAPTERS=[['PERFORMANCE','팀 세일즈 분석'],['RECRUITING','팀 리쿠르팅 분석'],['QUALITY CONTROL','팀원 QC · In & Out'],['WIN & HOW','Win & HOW'],['CHALLENGES','챌린지 & 개선 액션'],['LEARNING PLAN','러닝 플랜'],['TEAM TREE','팀 트리'],['PROMOTION GOAL','프로모션 골'],['OVERVIEW','전체 종합']];
const ABILITIES=[['relate','릴레이트'],['booth','부스 컨트롤'],['pitch','피치 능력'],['objection','오브젝션 대응력'],['agreement','약정서 숙련도']];
const n=M.num,fmt=v=>n(v)==null?'—':n(v).toLocaleString('ko-KR',{maximumFractionDigits:1});
const avg=v=>n(v)==null?'—':n(v).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=v=>n(v)==null?'—':Math.round(n(v)).toLocaleString('ko-KR')+'원';
const pct=v=>n(v)==null?'N/A':n(v).toFixed(1)+'%';
const total=values=>values.reduce((a,b)=>a+(n(b)??0),0);
const text=v=>String(v??'');
const monthTitle=month=>`${month.slice(0,4)}년 ${Number(month.slice(5))}월`;
const rawText=v=>text(v).replace(/\r\n/g,'\n');
function box(slide,value,x,y,w,h,size=16,options={}) {
  slide.addText(rawText(value),{x,y,w,h,fontFace:FONT,fontSize:size,color:C.ink,margin:0,breakLine:false,vertAnchor:'top',
    valign:'mid',fit:'shrink',paraSpaceAfterPt:0,...options});
}
function rect(slide,x,y,w,h,fill=C.soft,line=fill,options={}) {
  slide.addShape('rect',{x,y,w,h,fill:{color:fill},line:{color:line,width:0.6},...options});
}
function line(slide,x,y,w,h,color=C.line,width=1,options={}) {
  slide.addShape('line',{x,y,w,h,line:{color,width},...options});
}
function bar(slide,value,max,x,y,w,h,color=C.blue) {
  rect(slide,x,y,w,h,C.pale);if(n(value)!=null&&value>0)rect(slide,x,y,w*Math.max(0,Math.min(1,value/Math.max(1,max))),h,color);
}
function empty(slide,message='아직 기록하지 않았습니다.') {
  box(slide,message,.7,2.8,11.9,1.1,24,{align:'center',color:C.muted});
}
function table(slide,headers,rows,x,y,widths,{fontSize=14,rowH=.44,footer=null}={}) {
  const make=(cells,header=false,last=false)=>cells.map(value=>({text:typeof value==='object'?text(value.text):text(value),options:{bold:header||last,
    color:header?C.paper:C.ink,fill:header?C.ink:last?C.pale:C.paper,align:'center',...(typeof value==='object'?value.options:{})}}));
  const data=[make(headers,true),...rows.map(row=>make(row))];if(footer)data.push(make(footer,false,true));
  slide.addTable(data,{x,y,w:total(widths),colW:widths,rowH,fontFace:FONT,fontSize,color:C.ink,
    margin:[.055,.07,.045,.07],border:{type:'solid',color:C.line,pt:.6},autoPage:false,verbose:false,
    valign:'mid',paraSpaceAfterPt:0});
}
function kpis(slide,values,y=1.5) {
  const gap=.18,w=(11.93-gap*(values.length-1))/values.length;
  values.forEach(([label,value,note],i)=>{const x=.7+i*(w+gap);rect(slide,x,y,w,1.02,i===0?C.ink:C.soft);
    box(slide,label,x+.16,y+.1,w-.3,.2,11,{color:i===0?'CAD5E8':C.muted});
    box(slide,value,x+.16,y+.34,w-.3,.36,26,{bold:true,color:i===0?C.paper:C.ink});
    if(note)box(slide,note,x+.16,y+.78,w-.3,.14,9,{color:i===0?'CAD5E8':C.muted});});
}
function header(slide,view,draft,index,count,logoData) {
  slide.background={color:C.paper};
  if(logoData)slide.addImage({data:logoData,x:11.58,y:.25,w:1.04,h:1.04*198/310,altText:'Presence'});
  if(view.id!=='cover'){
    const title=view.kind==='note'?view.noteTitle:view.title;
    box(slide,view.c>=0?`${String(view.c+1).padStart(2,'0')}  ${CHAPTERS[view.c]?.[0]||''}`:'CONTENTS',.7,.32,8,.25,10,{bold:true,color:C.blue});
    box(slide,title||'',.7,.7,10.6,.45,29,{bold:true});
    if(view.parts>1&&!['wins','challenges'].includes(view.id))box(slide,`${(view.part||0)+1} / ${view.parts}`,11.3,1.03,1.3,.2,12,{align:'right',color:C.muted});
    line(slide,.7,1.29,11.93,0,C.line);
  }
  if(['wins','challenges'].includes(view.id))return;
  line(slide,.7,7.01,11.93,0,C.line);
  box(slide,view.id==='cover'?`Presence · ${draft.leader||'임재영'} ${(draft.members||[]).find(m=>m.name===draft.leader)?.role||'AOP'}`:[draft.teamName||'Presence',monthTitle(draft.month),draft.leader].filter(Boolean).join(' · '),.7,7.12,10,.15,8.5,{color:C.muted});
  box(slide,`${String(index+1).padStart(2,'0')} / ${count}`,11.4,7.1,1.2,.19,9,{align:'right',color:C.muted});
}
function cover(slide,d) {
  const weeks=d.weeks||[],first=weeks[0]||{},last=weeks.at(-1)||{};
  const range=(a,b)=>a&&b?`${a.replaceAll('-','.')}–${(a.slice(0,4)===b.slice(0,4)?b.slice(5):b).replaceAll('-','.')}`:'미확인';
  box(slide,'PRESENCE · TEAM RECAP',.85,.75,7,.3,13,{bold:true,color:C.blue});
  box(slide,d.month.slice(0,4),.85,1.64,7,.4,24,{color:C.muted});
  box(slide,`${Number(d.month.slice(5))}월 리캡`,.85,2.2,8,1.05,62,{bold:true});
  box(slide,`필드   ${range(first.start,last.end)}`,.88,3.6,7.4,.8,19,{breakLine:false,lineSpacingMultiple:1.2});

  rect(slide,9.6,1.2,2.9,5.5,C.blue);box(slide,d.month.slice(5),9.8,2.35,2.5,1.5,93,{bold:true,align:'center',color:C.paper});
  box(slide,'MONTHLY\nRECAP',9.95,4.25,2.25,.8,19,{bold:true,color:C.paper,align:'center'});
}
function contents(slide) {
  CHAPTERS.forEach(([en,ko],i)=>{const col=i%3,row=Math.floor(i/3),x=.7+col*4.03,y=1.65+row*1.55;
    box(slide,String(i+1).padStart(2,'0'),x,y,.54,.38,24,{bold:true,color:C.blue});
    box(slide,ko,x+.68,y,3.1,.53,19,{bold:true});box(slide,en,x+.68,y+.63,3.1,.23,10,{color:C.muted});line(slide,x,y+1.13,3.76,0);});
}
function sales(slide,d,v) {
  const all=[...d.members].sort((a,b)=>(M.memberMetric(b).sales??0)-(M.memberMetric(a).sales??0)),rows=v.items||all,t=M.totals(d);
  if(!rows.length)return empty(slide,'이달의 워크북 기록이 없습니다.');
  const widths=[1.35,.65,2.72,2.03,2.69,.85,1.64],x=.7,y=1.58,rh=.44;
  const data=rows.map(m=>{const a=M.memberMetric(m);return [m.name+' '+m.role,fmt(a.days),'','',money(a.income)+(a.incomeComplete?'':' *'),fmt(a.reject),{text:pct(a.rate),options:{color:a.alert?C.red:C.ink,bold:a.alert}}];});
  table(slide,['팀원','필드일','세일즈 (건)','AVG (건/일)','실인컴','리젝','리젝률'],data,x,y,widths,{fontSize:12.5,rowH:rh,footer:['팀 합계',fmt(t.days),fmt(t.sales),avg(t.avg),money(t.income),fmt(t.reject),pct(t.rate)]});
  const max=Math.max(1,...all.map(m=>M.memberMetric(m).sales||0)),maxAvg=Math.max(1,...all.map(m=>M.memberMetric(m).avg||0));
  rows.forEach((m,i)=>{const a=M.memberMetric(m),rowY=y+(i+1)*rh+.16;
    bar(slide,a.sales,max,2.82,rowY,1.8,.13);box(slide,fmt(a.sales),4.68,rowY-.06,.61,.24,12,{bold:true});
    bar(slide,a.avg,maxAvg,5.54,rowY,1.14,.13,'7C9CF6');box(slide,avg(a.avg),6.73,rowY-.06,.61,.24,12,{bold:true});
  });
  box(slide,'관리 필요: 리젝률 35% 초과 · 리젝은 리섭 차감 후 기준'+(t.incomeComplete?'':' · * 일부 급여 주차 미입력'),.7,6.67,11.9,.2,10,{color:C.muted});
}
function weekly(slide,d,v,pptx) {
  const totals=M.totals(d),weeks=d.weeks,values=totals.weekly;
  if(!weeks.length)return empty(slide,'주차 기록이 없습니다.');
  // A native chart includes an editable embedded workbook, not an image of bars.
  slide.addChart(pptx.ChartType.bar,[{name:'팀 세일즈',labels:weeks.map((_,i)=>`W${i+1}`),values:values.map(value=>n(value))}],
    {x:.75,y:1.54,w:5.45,h:4.85,barDir:'col',catAxisLabelFontFace:FONT,catAxisLabelFontSize:12,valAxisLabelFontSize:10,
      showLegend:false,showTitle:false,showValue:true,dataLabelPosition:'outEnd',dataLabelFormatCode:'0',dataLabelBkgrdColor:C.paper,
      chartColors:[C.blue],showBorder:false,valGridLine:{color:C.line,width:.4},catAxisLineShow:false,
      valAxisLineShow:false,catAxisLabelColor:C.ink,valAxisLabelColor:C.muted,showCatName:false});
  const rows=v.items||d.members,widths=[1.1,...weeks.map(()=>.76),.86];
  table(slide,['팀원',...weeks.map((_,i)=>`W${i+1}`),'합계'],rows.map(m=>[m.name,...weeks.map((_,i)=>fmt(m.scores?.[i])),fmt(M.memberMetric(m).sales)]),7.25,1.58,widths,{fontSize:12,rowH:.43,footer:['팀 합계',...values.map(fmt),fmt(totals.sales)]});
}
function income(slide,d,v) {
  const t=M.totals(d),all=[...d.members].sort((a,b)=>(M.memberMetric(b).income??-1)-(M.memberMetric(a).income??-1)),rows=v.items||all;
  const shown=t.incomeComplete?t.income:d.members.some(m=>m.incomeWeeks.some(x=>n(x)!=null))?t.knownIncome:null;
  rect(slide,.7,1.5,11.93,1.0,C.ink);box(slide,t.incomeComplete?'TEAM INCOME':'확인된 인컴',.94,1.63,3,.2,11,{color:'BBCBE3'});
  box(slide,money(shown),.94,1.97,8,.33,29,{bold:true,color:C.paper});
  const max=Math.max(1,...all.map(m=>M.memberMetric(m).income||0));
  rows.forEach((m,i)=>{const a=M.memberMetric(m),y=2.77+i*.4;box(slide,String((v.part||0)*9+i+1).padStart(2,'0'),.75,y,.48,.25,13,{color:C.blue,bold:true});
    box(slide,m.name,1.36,y,1.25,.25,15,{bold:true,color:a.alert?C.red:C.ink});box(slide,m.role,2.63,y,.65,.25,11,{color:C.muted});
    bar(slide,a.income,max,3.42,y+.05,6.62,.14,i? '7C9CF6':C.blue);box(slide,money(a.income)+(a.incomeComplete?'':' *'),10.27,y,2.28,.27,15,{align:'right',bold:true});});
  if(!t.incomeComplete)box(slide,'미입력 급여는 0원으로 확정하지 않습니다.',.7,6.65,11.9,.23,10,{color:C.muted});
}
function recruit(slide,d,v,rank=false) {
  const r=M.recruitingSummary(d.recruiting);
  if(rank){const rows=v.items||r.rows;return rows.length?table(slide,['랭킹 · 팀원','부킹','쇼업','스타터'],rows.map((row,i)=>[`${(v.part||0)*9+i+1}  ${row.name}`,fmt(row.booking??row.booked),fmt(row.showup),fmt(row.starter??row.starters)]),.7,1.65,[4.7,2.4,2.4,2.43],{rowH:.45,footer:['팀 합계',fmt(r.booking),fmt(r.showup),fmt(r.starter)]}):empty(slide,'리쿠르팅 실적 미입력');}
  [['BOOKING','부킹',r.booking],['SHOW UP','쇼업',r.showup],['STARTER','스타터',r.starter]].forEach(([en,ko,value],i)=>{const x=.7+i*4.03;rect(slide,x,1.75,3.76,2.55,i===0?C.ink:i===1?C.blue:C.pale);const color=i<2?C.paper:C.ink;
    box(slide,en,x+.25,2.02,3.26,.25,13,{color,bold:true});box(slide,fmt(value),x+.25,2.65,3.26,.8,56,{color,bold:true});box(slide,ko,x+.25,3.72,3.26,.25,16,{color});});
  box(slide,'부킹 → 쇼업',.85,4.92,5.3,.3,18,{color:C.muted});box(slide,pct(M.ratio(r.showup,r.booking)),.85,5.42,5.3,.55,35,{bold:true,color:C.blue});
  box(slide,'쇼업 → 스타터',6.7,4.92,5.3,.3,18,{color:C.muted});box(slide,pct(M.ratio(r.starter,r.showup)),6.7,5.42,5.3,.55,35,{bold:true,color:C.blue});
}
function qc(slide,d,v) {
  const events=d.events||[],ins=n(d.qc?.inCount)??events.filter(e=>e.type==='In').length,outs=n(d.qc?.outCount)??events.filter(e=>e.type!=='In').length,start=n(d.qc?.startCount);
  kpis(slide,[['월초 인원',fmt(start)],['In',fmt(ins)],['Out',fmt(outs)],['월말 인원',start==null?'—':fmt(start+ins-outs)]]);
  const rows=v.items||events;if(!rows.length)return box(slide,'이달의 In · Out 기록이 없습니다.',.7,3.8,11.9,.8,22,{align:'center',color:C.muted});
  table(slide,['팀원','일자','구분','사유 · 후속 액션','담당자'],rows.map(e=>[e.name,e.date||'미입력',e.type,[e.reason||'사유 미입력',e.action].filter(Boolean).join('\n'),e.owner||'미지정']),.7,2.87,[1.2,1.35,1.35,6.62,1.41],{fontSize:11.5,rowH:.51});
}
function stories(slide,d,v) {
  const rows=v.items||[],win=v.id==='wins';if(!rows.length)return empty(slide);
  slide.background={color:'EEF7FF'};
  const widths=[5.01,3.29,3.29],gap=.17,xs=[.7,5.88,9.34],h=1.56;
  rows.forEach((row,i)=>{
    const y=1.57+i*1.73;
    widths.forEach((w,j)=>slide.addShape('roundRect',{x:xs[j],y,w,h,rectRadius:.13,fill:{color:C.paper},line:{color:C.paper,width:0}}));
    rect(slide,xs[0]+.17,y+.13,.7,.31,'1475D1');
    box(slide,String((v.part||0)*3+i+1).padStart(2,'0'),xs[0]+.17,y+.13,.7,.31,14,{bold:true,color:C.paper,align:'center'});
    box(slide,row.title||'제목 없음',xs[0]+.24,y+(win?.58:.52),widths[0]-.48,win?.66:.38,19,{bold:true,align:'center'});
    if(!win)box(slide,row.cause||'아직 기록하지 않았습니다.',xs[0]+.27,y+.97,widths[0]-.54,.44,13,{align:'center'});
    box(slide,win?'WIN':'Sol.',xs[1]+.19,y+.15,widths[1]-.38,.3,18,{bold:true,color:'1475D1'});
    box(slide,(win?row.win:row.action)||'아직 기록하지 않았습니다.',xs[1]+.19,y+.61,widths[1]-.38,.8,14.5);
    box(slide,win?'HOW':'Res. 목표',xs[2]+.19,y+.15,widths[2]-.38,.3,18,{bold:true,color:'1475D1'});
    const value=win?[row.how,row.next&&'NEXT\n'+row.next].filter(Boolean).join('\n\n'):row.result;
    box(slide,value||'아직 기록하지 않았습니다.',xs[2]+.19,y+.61,widths[2]-.38,win?.8:.61,14.5);
    if(!win)box(slide,[row.owner&&'담당 · '+row.owner,row.due,row.status].filter(Boolean).join(' · '),xs[2]+.19,y+1.31,widths[2]-.38,.16,9,{color:C.muted});
  });
}
function callback(slide,d,v) {
  const all=d.members.map(m=>({...m,days:M.callbackDays(d,m),submitted:n(d.callbacks?.[m.id])})),days=total(all.map(m=>m.days)),submitted=total(all.map(m=>m.submitted)),missing=all.filter(m=>m.days>0&&m.submitted==null).length;
  kpis(slide,[['팀 전체 제출률',missing?'입력 중':pct(M.ratio(submitted,days))],['콜백싯 제출',`${fmt(submitted)}회`],['콜백 기준일수',`${fmt(days)}일`],['미입력',`${missing}명`]]);
  const groups=v.items||[];if(!groups.length)return box(slide,'콜백 기록이 없습니다.',.7,4,11.9,.6,22,{align:'center'});
  groups.forEach((group,i)=>{const columns=Math.min(3,groups.length),w=(11.93-(columns-1)*.18)/columns,x=.7+i*(w+.18),people=group.all||group.rows||[],sumDays=total(people.map(m=>m.days)),sumSub=total(people.map(m=>m.submitted)),miss=people.filter(m=>m.days>0&&m.submitted==null).length;
    box(slide,group.name+(group.totalParts>1?` · ${group.part+1}/${group.totalParts}`:''),x,2.87,w,.35,22,{bold:true});
    box(slide,`제출 ${fmt(sumSub)}회 / 기준 ${fmt(sumDays)}일 · ${miss?'입력 중':pct(M.ratio(sumSub,sumDays))}`,x,3.35,w,.26,13,{color:C.muted});
    table(slide,['팀원','기준일','제출','제출률'],(group.rows||[]).map(m=>[m.name,fmt(m.days),m.submitted==null?'미입력':fmt(m.submitted),!m.days?'해당 없음':m.submitted==null?'미입력':pct(M.ratio(m.submitted,m.days))]),x,3.88,[w*.28,w*.2,w*.24,w*.28],{fontSize:groups.length>2?10.5:12,rowH:.36});});
  box(slide,'빈칸과 0회는 다릅니다. 제출률은 총 제출 횟수 ÷ 콜백 기준일수입니다.',.7,6.7,11.9,.2,10,{color:C.muted});
}
function learning(slide,d,v) {
  const rows=v.items||[];if(!rows.length)return empty(slide);
  rows.forEach((row,i)=>{const x=.7+i*4.03,w=3.86;rect(slide,x,1.58,w,5.12,C.soft);box(slide,[row.track,row.period].filter(Boolean).join(' · '),x+.2,1.83,w-.4,.28,11,{color:C.blue,bold:true});
    box(slide,(row.title||'학습 기록')+(row.continuation?' · 계속':''),x+.2,2.37,w-.4,.64,22,{bold:true});
    box(slide,[row.action||'실행 내용 미입력',row.result&&'배운 점 · 기대 결과\n'+row.result].filter(Boolean).join('\n\n'),x+.2,3.22,w-.4,2.73,16,{valign:'top'});
    box(slide,[row.owner,row.due,row.status].filter(Boolean).join(' · ')||'담당자 · 일정 미입력',x+.2,6.23,w-.4,.25,10,{color:C.muted});});
}
function ic(slide,d,v) {
  const m=v.items?.[0];if(!m)return empty(slide,'IC 성장 플랜이 없습니다.');const p=d.icPlans?.[m.id]||{},days=(p.firstDays?.length?p.firstDays.map(sales=>({date:'',sales})):m.firstFive||[]).slice(0,5),known=days.filter(row=>n(row.sales)!=null),sales=known.length?total(known.map(row=>row.sales)):null;
  rect(slide,.7,1.53,4.0,5.17,C.ink);box(slide,m.name,.95,1.88,3.5,.55,31,{bold:true,color:C.paper});box(slide,[m.team||'팀 미지정',m.role||'IC'].join(' · '),.95,2.55,3.5,.3,16,{color:'C4D1E6'});
  box(slide,'실제 첫 5일 기록',.95,3.16,3.5,.26,13,{color:C.paper,bold:true});
  for(let i=0;i<5;i++){const x=.95+i*.69;box(slide,`D${i+1}\n${days[i]?.date?.slice(5)||'—'}`,x,3.58,.64,.5,10,{align:'center',color:'C4D1E6'});box(slide,fmt(days[i]?.sales),x,4.18,.64,.38,22,{bold:true,align:'center',color:C.paper});}
  box(slide,`첫 5일 확인 성과   ${fmt(sales)}건\n확인 일수 AVG   ${avg(known.length?sales/known.length:null)}\n확인 ${known.length} / 5일`,.95,5.08,3.5,1.0,16,{color:C.paper});
  const monthly=d.members.find(row=>row.id===m.id);box(slide,monthly?`월간 세일즈 ${fmt(M.memberMetric(monthly).sales)}건 · 필드 ${fmt(monthly.days)}일`:'이달 성과 집계에 포함되지 않은 팀원',.95,6.3,3.5,.2,9,{color:'C4D1E6'});
  box(slide,'다섯 가지 역량',5.07,1.65,7.1,.4,23,{bold:true});
  ABILITIES.forEach(([key,label],i)=>{const y=2.28+i*.52;box(slide,label,5.07,y,2.25,.27,14,{bold:true});bar(slide,n(p[key]),5,7.56,y+.07,3.2,.14);box(slide,n(p[key])==null?'평가 대기':p.scoreScale===10?`${fmt(p[key]*2)}/10`:p.scorePercent?`${fmt(p[key]*20)}%`:`${fmt(p[key])}/5`,11.0,y,1.36,.27,13,{align:'right',color:n(p[key])==null?C.muted:C.blue});});
  box(slide,'피치 능력: Tone of Voice · Body Language',5.07,4.96,7.1,.23,10,{color:C.muted});
  box(slide,'집중 역량',5.07,5.37,1.2,.24,11,{bold:true,color:C.blue});box(slide,p.focus||'아직 설정하지 않았습니다.',6.37,5.23,5.95,.72,12);
  for(let i=1;i<=3;i++){const x=5.07+(i-1)*2.49;box(slide,`DAY ${i}`,x,6.0,2.26,.2,10,{color:C.blue,bold:true});const value=p[`day${i}`];box(slide,value?.length>70?'상세 계획은 이어지는 페이지에서 확인합니다.':value||'계획 미입력',x,6.3,2.26,.36,12,{valign:'top'});}
}
function tree(slide,d,v,pptx,index) {
  const nodes=v.items||d.tree||[];if(!nodes.length)return empty(slide,'저장된 팀 관계가 없습니다.');
  if(v.treeRows){const rows=v.items||nodes;return table(slide,['팀원','역할','직접 리더','이끄는 팀','구분'],rows.map(node=>[node.name,node.role,nodes.find(p=>p.id===node.parent)?.name||'최상위',node.team||'—',node.planned?'추가 예정':'기존 팀원']),.7,1.64,[2.5,1.1,2.5,4.4,1.43],{fontSize:14,rowH:.52});}
  const map=new Map(nodes.map(node=>[node.id,node])),children=id=>nodes.filter(node=>node.parent===id),roots=nodes.filter(node=>!map.has(node.parent));
  const weights=new Map(),depths=new Map();let maxDepth=0;
  function weigh(node,depth,seen=new Set()){if(seen.has(node.id))throw new Error('순환하는 팀 트리는 PPTX로 내보낼 수 없습니다.');const next=new Set([...seen,node.id]);depths.set(node.id,depth);maxDepth=Math.max(maxDepth,depth);const kids=children(node.id);const value=kids.length?kids.reduce((sum,child)=>sum+weigh(child,depth+1,next),0):1;weights.set(node.id,value);return value;}
  roots.forEach(node=>weigh(node,0));if(weights.size!==nodes.length)throw new Error('팀 트리의 루트와 리더 연결을 확인해 주세요.');
  const positions=new Map(),leafCount=roots.reduce((sum,node)=>sum+weights.get(node.id),0),span=11.65/Math.max(1,leafCount),cardW=Math.min(2.5,span*.91),cardH=.79,step=Math.min(1.25,4.32/Math.max(1,maxDepth));
  function place(node,start){const width=weights.get(node.id)*span,depth=depths.get(node.id);positions.set(node.id,{x:.84+start+width/2-cardW/2,y:1.71+depth*step,w:cardW,h:cardH});let cursor=start;children(node.id).forEach(child=>{place(child,cursor);cursor+=weights.get(child.id)*span;});}
  let cursor=0;roots.forEach(node=>{place(node,cursor);cursor+=weights.get(node.id)*span;});
  const teamColor=node=>{let top=node;const seen=new Set();while(map.get(top.parent)?.parent&&!seen.has(top.id)){seen.add(top.id);top=map.get(top.parent);}const first=roots.flatMap(r=>children(r.id));return ['2460D8','8954C8','16856F'][Math.max(0,first.findIndex(n=>n.id===top.id))%3];};
  const nodeNames=new Map(nodes.map((node,i)=>[node.id,`org-node-${i}`]));
  nodes.forEach((node,i)=>{if(!map.has(node.parent))return;const from=positions.get(node.parent),to=positions.get(node.id),a=from.x+from.w/2,b=to.x+to.w/2;
    const edgeName=`org-edge-${i}`;slide.addShape('bentConnector3',{x:Math.min(a,b),y:from.y+from.h,w:Math.max(.001,Math.abs(a-b)),h:Math.max(.001,to.y-from.y-from.h),flipH:b<a,line:{color:'7B94BF',width:1.2,dashType:node.planned?'dash':'solid'},objectName:edgeName});
    pptx._recapConnections.push({slide:index+1,name:edgeName,parent:nodeNames.get(node.parent),child:nodeNames.get(node.id)});});
  nodes.forEach(node=>{const p=positions.get(node.id),root=!map.has(node.parent),fill=root?C.ink:node.planned?C.paper:C.pale;
    slide.addText([{text:node.name,options:{bold:true,breakLine:true,fontSize:14}},{text:(node.role||'')+(node.targetRole?' → '+node.targetRole:'')+(node.planned?' · 예정':''),options:{fontSize:10,breakLine:!!node.team}},...(node.team?[{text:node.team,options:{fontSize:10}}]:[])],
      {...p,shape:'roundRect',fontFace:FONT,color:root?C.paper:C.ink,align:'center',valign:'mid',margin:.055,fit:'shrink',fill:{color:fill},line:{color:node.planned?C.blue:root?C.ink:teamColor(node),width:2,dashType:node.planned?'dash':'solid'},objectName:nodeNames.get(node.id)});});
  box(slide,`${nodes.filter(node=>!node.planned).length}명${nodes.some(node=>node.planned)?` · 추가 예정 ${nodes.filter(node=>node.planned).length}명`:''}`,.7,6.65,11.9,.23,10,{color:C.muted});
}
function promotion(slide,d,v,pptx,index) {
  if(v.kind==='tree')return tree(slide,d,v,pptx,index);
  const rows=v.items||d.promotions||[];if(!rows.length)return empty(slide,'등록된 프로모션 골이 없습니다.');
  rows.forEach((row,i)=>{const x=.7+i*6.06,w=5.87,person=[...d.members,...d.roster,...d.tree].find(m=>m.id===row.memberId);rect(slide,x,1.58,w,5.1,C.soft);
    box(slide,person?.name||row.name||'팀원 확인 필요',x+.23,1.88,w-.46,.4,27,{bold:true});box(slide,`${person?.role||'현재 역할 미확인'} → ${row.targetRole||'목표 역할 미입력'}`,x+.23,2.48,w-.46,.3,17,{color:C.blue,bold:true});
    box(slide,row.action||'준비 액션 미입력',x+.23,3.05,w-.46,1.25,17,{valign:'top'});
    box(slide,(row.checks||[]).map(check=>`${check.done?'☑':'☐'} ${check.text}`).join('\n'),x+.23,4.56,w-.46,1.45,14,{valign:'top'});
    box(slide,[row.due||'기한 미정',row.status||'계획'].join(' · '),x+.23,6.26,w-.46,.23,11,{color:C.muted});});
}
function goalPage(slide,d){const g=d.goals||{};[['SALES',fmt(g.sales)+'+'],['INCOME',money(g.income)],['SCORING HC',fmt(g.headcount)+'명']].forEach(([label,value],i)=>{const x=.7+i*4.03;rect(slide,x,1.6,3.85,1.45,C.pale);box(slide,label,x+.2,1.82,3.45,.25,13,{color:C.blue,bold:true});box(slide,value,x+.2,2.26,3.45,.52,i===1?27:40,{bold:true,color:C.ink});});box(slide,'집중 목표',.8,3.4,5.5,.35,22,{bold:true});box(slide,g.focus||'미입력',.8,3.91,5.45,1.55,21,{valign:'top'});box(slide,'실행 계획',6.8,3.4,5.6,.35,22,{bold:true});box(slide,g.actions||'미입력',6.8,3.91,5.65,1.75,18,{valign:'top'});box(slide,'LEARNING',.8,6.05,1.5,.24,13,{bold:true,color:C.blue});box(slide,(d.learning||[]).map(x=>x.title).join(' · '),2.4,6.0,10,.55,17,{valign:'top'});}
function overview(slide,d) {
  const t=M.totals(d),r=M.recruitingSummary(d.recruiting),rows=d.members.map(m=>({...m,submitted:n(d.callbacks?.[m.id])})),cbDays=total(rows.map(m=>m.days)),cbSub=total(rows.map(m=>m.submitted)),missing=rows.filter(m=>m.days>0&&m.submitted==null).length,g=d.goals||{};
  rect(slide,.7,1.52,11.93,1.3,C.blue);box(slide,`${Number(d.month.slice(5))}월 팀 성과 요약`,.97,1.85,8.6,.54,29,{bold:true,color:C.paper});box(slide,fmt(t.sales),10.3,1.81,2.0,.64,44,{bold:true,color:C.paper,align:'right'});
  if(d.wins?.[0]?.title)box(slide,d.wins[0].title,.97,2.47,8.8,.22,12,{color:C.paper});
  const values=[['AVG',avg(t.avg),`필드 ${fmt(t.days)}일`],[t.incomeComplete?'TEAM INCOME':'확인된 인컴',money(t.incomeComplete?t.income:t.knownIncome),'입력 급여 주차 합계'],['REJECTION',pct(t.rate),'리섭 차감 후 기준'],['RECRUITING',`${fmt(r.starter)}명`,`부킹 ${fmt(r.booking)} · 쇼업 ${fmt(r.showup)}`],['CALLBACK',missing?'입력 중':pct(M.ratio(cbSub,cbDays)),`${cbSub}회 / ${cbDays}일 · 미입력 ${missing}명`],['LEARNING',`${(d.learning||[]).length}개`,'회고와 다음 달 계획']];
  values.forEach(([label,value,note],i)=>{const x=.7+(i%3)*4.03,y=3.07+Math.floor(i/3)*1.15;box(slide,label,x,y,3.78,.24,11,{color:C.muted,bold:true});box(slide,value,x,y+.36,3.78,.43,26,{bold:true});box(slide,note,x,y+.87,3.78,.19,10,{color:C.muted});});
  rect(slide,.7,5.68,11.93,.94,C.soft);box(slide,'NEXT GOAL',.93,5.95,1.6,.28,13,{color:C.blue,bold:true});
  box(slide,`세일즈 ${fmt(g.sales)}${g.income?' · 인컴 '+money(g.income):''}${g.headcount?' · HC '+fmt(g.headcount)+'명':''}\nAVG ${avg(g.avg)} · 스타터 ${fmt(g.recruit)}명 · 콜백 ${pct(g.callback)}`,2.72,5.82,9.55,.65,14,{bold:true});
}

export function buildPptx({draft,views,month,logoData},PptxGenJS) {
  if(typeof PptxGenJS!=='function')throw new Error('PPTX 생성기를 불러오지 못했습니다.');
  const errors=M.validate(draft);if(errors.length)throw new Error(errors.join('\n'));
  if(month&&month!==draft.month)throw new Error('선택 월과 리캡 월이 다릅니다.');
  if(!Array.isArray(views)||!views.length)throw new Error('내보낼 리캡 페이지가 없습니다.');
  const d=M.clone(draft),pages=M.clone(views),pptx=new PptxGenJS();
  pptx.layout='LAYOUT_WIDE';pptx.author=d.leader||'Presence';pptx.subject='저장된 월별 Team Recap';pptx.title=`${monthTitle(d.month)} ${d.teamName||'Presence'} Recap`;
  pptx.company=d.teamName||'Presence';pptx.lang='ko-KR';pptx.theme={headFontFace:FONT,bodyFontFace:FONT,lang:'ko-KR'};
  pptx._recapConnections=[];
  pages.forEach((v,index)=>{const slide=pptx.addSlide();header(slide,v,d,index,pages.length,logoData);
    slide.addNotes(`Presence Team Recap · ${d.month}\n원본 페이지 ${index+1}/${pages.length}: ${v.noteTitle||v.title}\n저장 버전 ${d.revision||0}\n모든 수치는 전달된 리캡 스냅샷 기준입니다. 빈값은 미확인 상태입니다.`);
    if(v.kind==='goals'){goalPage(slide,d);return;}
    if(v.kind==='note'){box(slide,v.items||v.noteText||'기록된 내용이 없습니다.',.85,1.75,11.63,4.8,24,{valign:'top',breakLine:false});return;}
    switch(v.id){case'cover':cover(slide,d);break;case'contents':contents(slide);break;case'sales':sales(slide,d,v);break;case'weekly':weekly(slide,d,v,pptx);break;case'income':income(slide,d,v);break;case'recruit':recruit(slide,d,v);break;case'rank':recruit(slide,d,v,true);break;case'qc':qc(slide,d,v);break;case'wins':case'challenges':stories(slide,d,v);break;case'callback':callback(slide,d,v);break;case'learning':learning(slide,d,v);break;case'ic':ic(slide,d,v);break;case'tree':tree(slide,d,v,pptx,index);break;case'promotion':promotion(slide,d,v,pptx,index);break;case'overview':overview(slide,d);break;default:throw new Error(`지원하지 않는 리캡 페이지: ${v.id}`);}
  });
  if(pptx._slides.length!==pages.length)throw new Error('PPTX 페이지 수를 확인해 주세요.');
  return pptx;
}

// PptxGenJS emits connector geometry as ordinary shapes. Promote only our named
// hierarchy edges to real OOXML connectors with references to editable node shapes.
export async function editablePptxBytes(pptx,JSZip=globalThis.JSZip) {
  if(!JSZip?.loadAsync)throw new Error('PPTX 압축 모듈을 불러오지 못했습니다.');
  const bytes=await pptx.write({outputType:'uint8array',compression:true}),zip=await JSZip.loadAsync(bytes);
  const bySlide=new Map();for(const binding of pptx._recapConnections||[]){if(!bySlide.has(binding.slide))bySlide.set(binding.slide,[]);bySlide.get(binding.slide).push(binding);}
  for(const [index,bindings]of bySlide){const name=`ppt/slides/slide${index}.xml`;let xml=await zip.file(name).async('string');
    const ids=new Map([...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"[^>]*\bname="([^"]+)"/g)].map(match=>[match[2],match[1]]));
    for(const binding of bindings){const start=ids.get(binding.parent),end=ids.get(binding.child);if(!start||!end)throw new Error('팀 트리 도형 연결을 확인해 주세요.');let converted=false;
      xml=xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>{if(!shape.includes(`name="${binding.name}"`))return shape;converted=true;return shape.replace('<p:sp>','<p:cxnSp>').replace('</p:sp>','</p:cxnSp>').replace('<p:nvSpPr>','<p:nvCxnSpPr>').replace('</p:nvSpPr>','</p:nvCxnSpPr>').replace(/<p:cNvSpPr\b[^>]*(?:\/>|>[\s\S]*?<\/p:cNvSpPr>)/,`<p:cNvCxnSpPr><a:stCxn id="${start}" idx="2"/><a:endCxn id="${end}" idx="0"/></p:cNvCxnSpPr>`);});
      if(!converted)throw new Error('팀 트리 연결선 내보내기를 완료하지 못했습니다.');
    }zip.file(name,xml);
  }
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}

let bundlePromise;
function loadBundle(){
  const constructor=()=>globalThis.PptxGenJS||globalThis.pptxgen;
  if(constructor()&&globalThis.JSZip)return Promise.resolve(constructor());
  if(!bundlePromise)bundlePromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/pptxgen.bundle.js',import.meta.url).href;script.async=true;
    const timer=setTimeout(()=>{script.remove();reject(new Error('PPTX 생성기 연결 시간이 초과되었습니다. 다시 시도해 주세요.'));},20000);
    script.onload=()=>{clearTimeout(timer);constructor()&&globalThis.JSZip?resolve(constructor()):reject(new Error('PPTX 생성기 초기화에 실패했습니다.'));};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('PPTX 생성기를 불러오지 못했습니다. 연결을 확인해 주세요.'));};document.head.append(script);
  }).catch(error=>{bundlePromise=null;throw error;});return bundlePromise;
}
let brandPromise;
function loadBrand(){if(!brandPromise)brandPromise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=310;canvas.height=198;const ctx=canvas.getContext('2d');ctx.drawImage(image,3,0,310,198,0,0,310,198);ctx.globalCompositeOperation='source-in';ctx.fillStyle='#142139';ctx.fillRect(0,0,310,198);resolve(canvas.toDataURL('image/png'));};image.onerror=()=>reject(new Error('Presence 로고를 불러오지 못했습니다.'));image.src=new URL('./presence-brand-original.png',import.meta.url).href;}).catch(error=>{brandPromise=null;throw error;});return brandPromise;}
export async function exportPptx(payload) {
  const [Constructor,logoData]=await Promise.all([loadBundle(),loadBrand()]),pptx=buildPptx({...payload,logoData},Constructor),bytes=await editablePptxBytes(pptx);
  const fileName=`Presence-Team-Recap-${payload.draft.month}.pptx`,blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  return {fileName,slides:payload.views.length};
}
