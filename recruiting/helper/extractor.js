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
function extractAlba(doc,url){
 const candidate=doc.querySelector('#ResumeBaseInfo .user-profile'),base=isVisible(candidate)?candidate:null,profile=base?.querySelector('.user-profile__base');
 const name=cut(textAt(profile,'.user-profile__name'),80),genderText=textAt(profile,'.user-profile__gender'),ageText=textAt(profile,'.user-profile__age');
 const ageMatch=ageText.match(/\d{1,3}/),age=ageMatch?ageMatch[0]+'세':'',gender=/^(여|여성)$/.test(genderText)?'여':/^(남|남성)$/.test(genderText)?'남':'';
 // A visible contact DD can contain a hidden guide with unrelated phone numbers.
 // Read only its own text nodes, or a visible telephone link, never that guide.
 let safe='';
 for(const term of base?.querySelectorAll('.user-profile__details .user-profile__term--contact')||[]){
  const dd=term.nextElementSibling;if(!dd?.matches('.user-profile__data')||!visibleText(dd))continue;
  const own=[...dd.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join(' ');
  safe=phone(own);
  if(!safe)for(const link of dd.querySelectorAll('a[href^="tel:"]')){if(visibleText(link)){safe=phone(link.getAttribute('href')?.slice(4));if(safe)break;}}
  if(safe)break;
 }
 const rows=(id,selectors)=>{const root=doc.querySelector(id);return [textAt(root,'.resume-head__desc'),...[...(root?.querySelectorAll('.resume-content .data-view__list')||[])].map(row=>[...new Set(selectors.map(selector=>textAt(row,selector)).filter(Boolean))].join(' · '))].filter(Boolean).join('\n');};
 const education=cut(rows('#ResumeEducation',['.data-view__term','.resume-info__name','.resume-info__part']));
 const career=cut(rows('#ResumeCareer',['.data-view__term','.resume-info__name','.resume-info__part','.resume-info__time','.resume-info__sub']));
 const wish=cut([...allText(doc.querySelector('#ResumeLocal'),'.data-keyword__item'),...allText(doc.querySelector('#ResumeKind'),'.data-keyword__item'),...[...(doc.querySelector('#ResumeWork')?.querySelectorAll('.data-view__list')||[])].map(row=>[textAt(row,'.data-view__term'),textAt(row,'.data-view__desc')].filter(Boolean).join(': '))].filter(Boolean).join(' · '),2000);
 const nameMasked=maskedName(name),loginRequired=!base;
 const note=cut([education&&'학력: '+education,career&&'경력: '+career,wish&&'희망: '+wish].filter(Boolean).join(' / '));
 return {version:2,url,sourceService:'albacheonguk',name,age,gender,phone:safe.startsWith('050')?safe:'',mobile:safe.startsWith('01')?safe:'',education,career,wish,note,relate:'',contactOpened:!!safe&&!loginRequired,nameMasked,loginRequired,capturedAt:Date.now()};
}
function extract(doc,url,rawOverride){const source=globalThis.PresenceResumeSources?.normalizeResumeURL(url);if(source?.sourceService==='albacheonguk')return extractAlba(doc,source.url);return extractAlbamon(doc,source?.url||url,rawOverride);}
globalThis.PresenceAlbamonExtract={extract};
globalThis.PresenceResumeExtract={extract};
})();
