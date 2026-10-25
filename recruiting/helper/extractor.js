/* Read only the resume the user explicitly requested. No credentials or cookies leave Albamon. */
(()=>{'use strict';
const clean=v=>String(v??'').replace(/[\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim();
const cut=(v,n=4000)=>clean(v).slice(0,n);
const phone=v=>(String(v||'').match(/(?:010|050[0-9]|01[16789])[-\s]?\d{3,4}[-\s]?\d{4}/)||[])[0]?.replace(/\s/g,'')||'';
const strings=(value,depth=0)=>{if(depth>4||value==null)return[];if(typeof value==='string')return /^https?:|^[A-Z0-9_]{4,}$/.test(value)?[]:[clean(value)];if(Array.isArray(value))return value.flatMap(v=>strings(v,depth+1));if(typeof value==='object')return Object.entries(value).filter(([k])=>!/id$|code$|^key$|image|url|^user/i.test(k)).flatMap(([,v])=>strings(v,depth+1));return[];};
function section(text,start,end){const begin=text.indexOf(start);if(begin<0)return '';let part=text.slice(begin+start.length),last=part.length;for(const marker of end){const i=part.indexOf(marker);if(i>=0)last=Math.min(last,i);}return part.slice(0,last).trim().slice(0,4000);}
function extract(doc,url,rawOverride){let detail=rawOverride;try{detail||=JSON.parse(doc.querySelector('#__NEXT_DATA__')?.textContent||'{}').props?.pageProps?.detail;}catch{}detail||={};const full=String(doc.body?.innerText||doc.body?.textContent||''),text=full.split(/지금 보고 있는 인재와|유사한 인재를|sidebar menu/)[0],u=detail.resumeUser||{};
const visible=text.match(/([가-힣*○]{2,12})\s*(남|여)\s*(\d{1,3})\s*세/),name=cut(visible?.[1]||u.userName||'',80),age=visible?visible[3]+'세':(u.age?u.age+'세':''),gender=visible?.[2]||(u.gender?.key==='MALE'?'남':u.gender?.key==='FEMALE'?'여':'');
const contactBlock=section(text,'휴대폰',['이메일','AI 강점','학력']),safe=phone(contactBlock)||phone(u.mobileNumber)||phone(u.phoneNumber),mobile=safe.startsWith('01')?safe:'';
const eduList=detail.educations?.collection||[],careerList=detail.careers?.collection||[];
const education=cut(eduList.length?[detail.educations?.lastEducationDescription,...eduList.map(e=>[...new Set(strings(e))].join(' · '))].filter(Boolean).join('\n'):section(text,'학력',['경력','희망근무조건'])||detail.educations?.lastEducationDescription||'');
const careerText=text.slice(Math.max(0,text.indexOf('학력'))),career=cut(careerList.length?[detail.careers?.totalCareer,...careerList.map(e=>[...new Set(strings(e))].join(' · '))].filter(Boolean).join('\n'):section(careerText,'경력',['희망근무조건','자기소개','위 모든 기재사항'])||detail.careers?.totalCareer||'');
const w=detail.wishCondition||{},wish=cut([(w.areas||[]).map(a=>a.areaDescription).filter(Boolean).join(', '),(w.parts||[]).map(p=>p.partName).filter(Boolean).join(', '),w.workPeriodDescription,...(w.workTimes||[]).map(t=>[t.workDayType?.description,t.workTimeType?.description].filter(Boolean).join(' / '))].filter(Boolean).join(' · ')),note=cut([education&&'학력: '+education,career&&'경력: '+career,wish&&'희망: '+wish].filter(Boolean).join(' / '));
const masked=/[*○]/.test(name),loginRequired=(!detail.resumeUser&&!visible)||(/로그인 후.{0,10}(확인|열람)|기업회원 로그인/.test(text)&&!safe&&masked);
return {version:2,url,name,age,gender,phone:safe.startsWith('050')?safe:'',mobile,education,career,wish,note,relate:'',contactOpened:!!safe,nameMasked:masked,loginRequired,capturedAt:Date.now()};}
globalThis.PresenceAlbamonExtract={extract};
})();
