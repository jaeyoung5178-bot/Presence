/* Read only the resume the user explicitly requested. No credentials or cookies leave the source site. */
(()=>{'use strict';
const clean=v=>String(v??'').replace(/[\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim();
const cut=(v,n=4000)=>clean(v).slice(0,n);
const phone=v=>(String(v||'').match(/(?<!\d)(?:010|050[0-9]|01[16789])[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/)||[])[0]?.replace(/\s/g,'')||'';
const maskedName=name=>!name||/[*＊○●◯〇Ｏ×•·]|비공개|미공개|로그인/.test(name)||/^(?:성명|이름)$/.test(name)||/[xXoO]{2,}|[가-힣][xXoO]+$/.test(name);
const strings=(value,depth=0)=>{if(depth>4||value==null)return[];if(typeof value==='string')return /^https?:|^[A-Z0-9_]{4,}$/.test(value)?[]:[clean(value)];if(Array.isArray(value))return value.flatMap(v=>strings(v,depth+1));if(typeof value==='object')return Object.entries(value).filter(([k])=>!/id$|code$|^key$|image|url|^user/i.test(k)).flatMap(([,v])=>strings(v,depth+1));return[];};
function section(text,start,end){const begin=text.indexOf(start);if(begin<0)return '';let part=text.slice(begin+start.length),last=part.length;for(const marker of end){const i=part.indexOf(marker);if(i>=0)last=Math.min(last,i);}return part.slice(0,last).trim().slice(0,4000);}
function extractAlbamon(doc,url,rawOverride){let detail=rawOverride;try{detail||=JSON.parse(doc.querySelector('#__NEXT_DATA__')?.textContent||'{}').props?.pageProps?.detail;}catch{}detail||={};const full=String(doc.body?.innerText||doc.body?.textContent||''),text=full.split(/지금 보고 있는 인재와|유사한 인재를|sidebar menu/)[0],u=detail.resumeUser||{};
const visible=text.match(/([가-힣*○]{2,12})\s*(남|여)\s*(\d{1,3})\s*세/),name=cut(visible?.[1]||u.userName||'',80),age=visible?visible[3]+'세':(u.age?u.age+'세':''),gender=visible?.[2]||(u.gender?.key==='MALE'?'남':u.gender?.key==='FEMALE'?'여':'');
const contactBlock=section(text,'휴대폰',['이메일','AI 강점','학력']),safe=phone(contactBlock)||phone(u.mobileNumber)||phone(u.phoneNumber),mobile=safe.startsWith('01')?safe:'';
const eduList=detail.educations?.collection||[],careerList=detail.careers?.collection||[];
const education=cut(eduList.length?[detail.educations?.lastEducationDescription,...eduList.map(e=>[...new Set(strings(e))].join(' · '))].filter(Boolean).join('\n'):section(text,'학력',['경력','희망근무조건'])||detail.educations?.lastEducationDescription||'');
const careerText=text.slice(Math.max(0,text.indexOf('학력'))),career=cut(careerList.length?[detail.careers?.totalCareer,...careerList.map(e=>[...new Set(strings(e))].join(' · '))].filter(Boolean).join('\n'):section(careerText,'경력',['희망근무조건','자기소개','위 모든 기재사항'])||detail.careers?.totalCareer||'');
const w=detail.wishCondition||{},wish=cut([(w.areas||[]).map(a=>a.areaDescription).filter(Boolean).join(', '),(w.parts||[]).map(p=>p.partName).filter(Boolean).join(', '),w.workPeriodDescription,...(w.workTimes||[]).map(t=>[t.workDayType?.description,t.workTimeType?.description].filter(Boolean).join(' / '))].filter(Boolean).join(' · ')),note=cut([education&&'학력: '+education,career&&'경력: '+career,wish&&'희망: '+wish].filter(Boolean).join(' / '));
const masked=maskedName(name),loginRequired=(!detail.resumeUser&&!visible)||(/로그인 후.{0,10}(확인|열람)|기업회원 로그인/.test(text)&&!safe&&masked);
return {version:2,url,sourceService:'albamon',name,age,gender,phone:safe.startsWith('050')?safe:'',mobile,education,career,wish,note,relate:'',contactOpened:!!safe,nameMasked:masked||!name,loginRequired,capturedAt:Date.now()};}
// These selectors follow Alba's rendered resume, rather than headings, navigation,
// hidden data or recommended candidates elsewhere in the document.
function isVisible(node){
 if(!node)return false;
 for(let item=node;item?.nodeType===1;item=item.parentElement){
  if(item.hidden||item.getAttribute('aria-hidden')==='true')return false;
  const style=item.ownerDocument?.defaultView?.getComputedStyle?.(item);if(style&&(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'))return false;
 }
 return true;
}
function visibleText(node){
 if(!isVisible(node))return '';
 if(typeof node.innerText==='string')return clean(node.innerText);
 // A DOM without layout (for example a fixture) must still exclude hidden nodes.
 const clone=node.cloneNode(true);for(const hidden of clone.querySelectorAll('script,style,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"]'))hidden.remove();return clean(clone.textContent);
}
const textAt=(root,selector)=>visibleText(root?.querySelector(selector));
const allText=(root,selector)=>[...(root?.querySelectorAll(selector)||[])].map(visibleText).filter(Boolean);
function resumeScope(doc,source){return source?.view==='applicants'?doc.querySelector('#ResumeDetail #ResumeView1.resumeDocument.applicantsDoc'):doc.querySelector('#ResumeView1.resumeDocument')||doc;}
function smsFields(scope){
 const root=scope?.querySelector('.resume-sms');if(!root||!isVisible(root)||textAt(root,'.resume-sms__head').replace(/\s/g,'')!=='문자지원내용')return null;
 const fields={};for(const term of root.querySelectorAll('.resume-sms__list .resume-sms__title')){
  const value=term.nextElementSibling;if(value?.matches('.resume-sms__dsc'))fields[visibleText(term).replace(/\s/g,'')]=value;
 }
 return fields['지원자']&&fields['휴대폰']?fields:null;
}
function directPhone(node){
 if(!isVisible(node)||!visibleText(node))return '';
 const own=[...node.childNodes].filter(item=>item.nodeType===3).map(item=>item.textContent).join(' ');let result=phone(own);
 if(!result)for(const link of node.querySelectorAll('a[href^="tel:"]'))if(visibleText(link)){result=phone(link.getAttribute('href')?.slice(4));if(result)break;}
 return result;
}
function inspect(doc,url){
 const source=globalThis.PresenceResumeSources?.normalizeResumeURL(url);let parsed;try{parsed=new URL(url);}catch{}
 const login=/로그인/.test(doc.title||'')||[...(doc.querySelectorAll('input[type="password"]')||[])].some(isVisible);
 if(!source){
  if(login||/\/(?:auth|login)(?:\/|$)/i.test(parsed?.pathname||''))return {code:'login-required',message:'이력서 사이트에 로그인한 뒤 개별 이력서로 돌아와 주세요.'};
  if(/^\/resume\/(?:main(?:\.asp)?|list\/[^/]+)\/?$/i.test(parsed?.pathname||'')||/^\/human-resources\/(?:total|main)\/?$/.test(parsed?.pathname||''))return {code:'list',message:'인재 목록이에요. 한 사람의 이름을 눌러 개별 이력서를 열어 주세요.'};
  return {code:'unsupported-route',message:'이 주소의 이력서는 아직 확인할 수 없어요. Crew Camp에서 도우미 업데이트를 확인하고 개별 이력서 주소를 넣어 주세요.'};
 }
 if(source.sourceService!=='albacheonguk')return {code:'ready',message:'이름 · 나이 · 연락처 · 학력 · 경력을 가져와요.'};
 const scope=resumeScope(doc,source),profile=scope?.querySelector('#ResumeBaseInfo .user-profile .user-profile__base');
 if(isVisible(profile)&&profile.querySelector('.user-profile__name'))return {code:'ready',message:'이력서 본문을 확인했어요. 이 사람의 정보를 가져올 수 있어요.'};
 if(source.view==='applicants'&&smsFields(scope))return {code:'ready',message:'문자지원 내용을 확인했어요. 지원자 정보와 지원 메시지를 가져올 수 있어요.'};
 if(login)return {code:'login-required',message:'로그인이 필요해요. 이력서 사이트에서 로그인한 뒤 이 화면을 새로고침해 주세요.'};
 return {code:doc.readyState==='loading'?'loading':'waiting-profile',message:'이력서 본문을 확인하고 있어요. 내용이 보이는데 계속 기다림 상태라면 이 화면을 새로고침해 주세요.'};
}
function extractAlba(doc,url){
 const source=globalThis.PresenceResumeSources?.normalizeResumeURL(url),scope=resumeScope(doc,source);
 const sms=source?.view==='applicants'?smsFields(scope):null;
 if(sms){
  const applicant=visibleText(sms['지원자']).match(/^(.{1,80}?)\s*\(\s*(남|여)\s*\/\s*(\d{1,3})\s*세(?:\s*\/[^)]*)?\s*\)$/);
  const name=cut(applicant?.[1]||'',80),safe=directPhone(sms['휴대폰']),message=cut(visibleText(sms['지원메시지']));
  return {version:2,url,sourceService:'albacheonguk',name,age:applicant?applicant[3]+'세':'',gender:applicant?.[2]||'',phone:safe.startsWith('050')?safe:'',mobile:safe.startsWith('01')?safe:'',education:'',career:'',wish:'',note:message?'지원 메시지: '+message:'',relate:'',contactOpened:!!safe,nameMasked:maskedName(name),loginRequired:false,capturedAt:Date.now()};
 }
 const candidate=scope?.querySelector('#ResumeBaseInfo .user-profile'),base=isVisible(candidate)?candidate:null,profile=base?.querySelector('.user-profile__base');
 const name=cut(textAt(profile,'.user-profile__name'),80),genderText=textAt(profile,'.user-profile__gender'),ageText=textAt(profile,'.user-profile__age');
 const ageMatch=ageText.match(/\d{1,3}/),age=ageMatch?ageMatch[0]+'세':'',gender=/^(여|여성)$/.test(genderText)?'여':/^(남|남성)$/.test(genderText)?'남':'';
 // A visible contact DD can contain a hidden guide with unrelated phone numbers.
 // Read only its own text nodes, or a visible telephone link, never that guide.
 let safe='';
 for(const term of base?.querySelectorAll('.user-profile__details .user-profile__term--contact')||[]){
  const dd=term.nextElementSibling;if(!dd?.matches('.user-profile__data')||!visibleText(dd))continue;
  safe=directPhone(dd);
  if(safe)break;
 }
 const rows=(id,selectors)=>{const root=scope?.querySelector(id);return [textAt(root,'.resume-head__desc'),...[...(root?.querySelectorAll('.resume-content .data-view__list')||[])].map(row=>[...new Set(selectors.map(selector=>textAt(row,selector)).filter(Boolean))].join(' · '))].filter(Boolean).join('\n');};
 const education=cut(rows('#ResumeEducation',['.data-view__term','.resume-info__name','.resume-info__part']));
 const career=cut(rows('#ResumeCareer',['.data-view__term','.resume-info__name','.resume-info__part','.resume-info__time','.resume-info__sub']));
 const wish=cut([...allText(scope?.querySelector('#ResumeLocal'),'.data-keyword__item'),...allText(scope?.querySelector('#ResumeKind'),'.data-keyword__item'),...[...(scope?.querySelector('#ResumeWork')?.querySelectorAll('.data-view__list')||[])].map(row=>[textAt(row,'.data-view__term'),textAt(row,'.data-view__desc')].filter(Boolean).join(': '))].filter(Boolean).join(' · '),2000);
 const nameMasked=maskedName(name),loginRequired=!base;
 const note=cut([education&&'학력: '+education,career&&'경력: '+career,wish&&'희망: '+wish].filter(Boolean).join(' / '));
 return {version:2,url,sourceService:'albacheonguk',name,age,gender,phone:safe.startsWith('050')?safe:'',mobile:safe.startsWith('01')?safe:'',education,career,wish,note,relate:'',contactOpened:!!safe&&!loginRequired,nameMasked,loginRequired,capturedAt:Date.now()};
}
function extract(doc,url,rawOverride){
 const source=globalThis.PresenceResumeSources?.normalizeResumeURL(url);
 if(!source)return {version:2,url:'',name:'',age:'',gender:'',phone:'',mobile:'',education:'',career:'',wish:'',note:'',relate:'',contactOpened:false,nameMasked:true,loginRequired:false,capturedAt:Date.now()};
 return source.sourceService==='albacheonguk'?extractAlba(doc,source.url):extractAlbamon(doc,source.url,rawOverride);
}
globalThis.PresenceAlbamonExtract={extract:extractAlbamon};
globalThis.PresenceResumeExtract={extract,inspect};
})();
