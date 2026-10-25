export function reconcileShowup(candidate,remote){
  if(remote.conflict)throw Error('시트와 페이지가 동시에 수정됐어요. '+candidate.name+' 기록을 다시 확인해 주세요.');
  const next=structuredClone(candidate),id='sheet-show-'+candidate.id;
  next.events={...next.events};
  if(!next.channel&&remote.channel)next.channel=remote.channel;
  if(remote.showed&&['booked','noShow'].includes(next.status)){
    next.status='showed';next.showedDate=remote.interviewDate||next.interviewDate;
    next.events[id]={id,type:'showed',day:next.showedDate,at:Date.now(),source:'interview-sheet'};
  }else if(!remote.showed&&next.status==='showed'&&next.events[id]){
    delete next.events[id];next.status='booked';delete next.showedDate;
  }
  next.sheetState={hash:remote.hash,row:remote.row,sheet:remote.sheet,showed:remote.showed};
  return JSON.stringify(next)===JSON.stringify(candidate)?null:next;
}
