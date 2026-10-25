// Presence Interview Log bridge. Deploy as the owner, access: Anyone.
// Every request verifies the existing Firebase login. No public read endpoint.
const INTERVIEW_SHEET='1-c7Zc2fJEKcmZgu1UxRqdAehZIXrOoRN48U-XL4cozA';
const FIREBASE_ROOT='https://presence-team-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_KEY='AIzaSyCYKKnK8myrSM-eip9HEJxYRq_hzpfPUY0';
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function request_(url,options){const r=UrlFetchApp.fetch(url,Object.assign({muteHttpExceptions:true},options));if(r.getResponseCode()!==200)throw Error('로그인을 확인해 주세요.');return JSON.parse(r.getContentText());}
function identify_(token){
  if(typeof token!=='string'||token.length>5000)throw Error('로그인이 필요합니다.');
  const account=request_('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+FIREBASE_KEY,{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token})});
  const authUid=account.users&&account.users[0]&&account.users[0].localId;if(!authUid)throw Error('로그인이 필요합니다.');
  const session=request_(FIREBASE_ROOT+'/authSessions/'+encodeURIComponent(authUid)+'.json?auth='+encodeURIComponent(token));
  if(!session||session.userUid!=='admin')throw Error('현재 인터뷰 시트는 임재영 계정에 연결되어 있습니다.');
  const profile=request_(FIREBASE_ROOT+'/users/admin.json?auth='+encodeURIComponent(token));
  if(!profile||profile.status!=='active')throw Error('활성 계정이 필요합니다.');
  return {uid:'admin',name:profile.name||'임재영'};
}
function date_(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return '';return Number(s.slice(5,7))+'/'+Number(s.slice(8));}
function phone_(s){return String(s||'').replace(/\D/g,'');}
function clean_(s){s=String(s||'').replace(/[\t\r\n]+/g,' ').slice(0,4000);return /^[=+@-]/.test(s)?"'"+s:s;}
function hash_(row){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row))).slice(0,32);}
function doGet(){return json_({ok:false,error:'로그인한 Crew Camp에서 연결해 주세요.'});}
function doPost(e){
  let lock;
  try{
    if(!e||!e.postData||e.postData.contents.length>200000)throw Error('요청을 확인해 주세요.');
    const input=JSON.parse(e.postData.contents),user=identify_(input.token);
    if(!Array.isArray(input.candidates)||input.candidates.length>300)throw Error('한 번에 최대 300명까지 연결할 수 있습니다.');
    lock=LockService.getScriptLock();lock.waitLock(15000);
    const book=SpreadsheetApp.openById(INTERVIEW_SHEET),props=PropertiesService.getScriptProperties(),records=[];
    for(const c of input.candidates){
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(c.id||'')||!/^202\d-\d{2}-\d{2}$/.test(c.interviewDate||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.interviewTime||'')||!/^01[016789]\d{7,8}$/.test(phone_(c.mobile))||!c.name)throw Error('면접자 정보를 확인해 주세요.');
      const tab=c.interviewDate.slice(2,4)+'년 '+Number(c.interviewDate.slice(5,7))+'월',sheet=book.getSheetByName(tab);
      if(!sheet)throw Error(tab+' 인터뷰 시트가 없습니다.');
      const key=user.uid+':'+c.id,mapped=JSON.parse(props.getProperty(key)||'null');
      let values=sheet.getRange(2,1,Math.max(sheet.getLastRow()-1,1),14).getDisplayValues();
      let offset=values.findIndex(r=>phone_(r[10])===phone_(c.mobile)&&r[7]===c.name&&r[2]===date_(c.interviewDate)&&r[4]===c.interviewTime);
      if(offset<0&&mapped&&mapped.sheet===tab){offset=values.findIndex(r=>phone_(r[10])===mapped.phone&&r[7]===mapped.name&&r[2]===mapped.date&&r[4]===mapped.time);}
      let lastUsed=-1;for(let n=values.length-1;n>=0;n--){if(values[n].some(Boolean)){lastUsed=n;break;}}
      let row=offset<0?Math.max(2,lastUsed+3):offset+2;
      const current=offset<0?Array(14).fill(''):values[offset],remoteShow=current[3]==='O';
      const candidateShow=['showed','starter'].includes(c.status),prior=c.sheetState;
      // A changed sheet O wins over a stale page; page result changes win only against its last observed O.
      let showed=remoteShow;
      if(offset<0)showed=candidateShow;
      else if(prior&&remoteShow===prior.showed&&candidateShow!==prior.showed)showed=candidateShow;
      const next=[clean_(c.channel||current[0]||''),date_(c.bookedDate),date_(c.interviewDate),showed?'O':'',c.interviewTime,'NM','OUT',clean_(c.name),clean_(c.age),c.gender,clean_(c.mobile),user.name,'PR',clean_(c.note==='인터뷰 로그에서 등록'?'':c.note)];
      const inputHash=hash_([c.channel,c.name,c.age,c.gender,c.mobile,c.interviewDate,c.interviewTime,c.bookedDate,c.note]);
      const shouldWrite=offset<0||!mapped||mapped.inputHash!==inputHash||current[3]!==next[3];
      // After adoption, external edits other than O are preserved until the corresponding page record changes.
      if(shouldWrite){
        if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
        if(offset<0){const template=Math.max(2,row-1);sheet.getRange(template,1,1,14).copyTo(sheet.getRange(row,1,1,14),SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);sheet.getRange(template,1,1,14).copyTo(sheet.getRange(row,1,1,14),SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,false);}
        if(mapped&&mapped.inputHash===inputHash&&offset>=0)sheet.getRange(row,4).setValue(showed?'O':'');
        else sheet.getRange(row,1,1,14).setValues([next]);
      }
      props.setProperty(key,JSON.stringify({sheet:tab,phone:phone_(c.mobile),name:c.name,date:date_(c.interviewDate),time:c.interviewTime,inputHash}));
      records.push({id:c.id,row,sheet:tab,showed,channel:next[0],interviewDate:c.interviewDate,hash:inputHash});
    }
    SpreadsheetApp.flush();return json_({ok:true,records});
  }catch(error){return json_({ok:false,error:error.message});}
  finally{if(lock)try{lock.releaseLock();}catch(ignore){}}
}
