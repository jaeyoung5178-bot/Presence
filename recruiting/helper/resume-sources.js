/* Kept in sync with recruiting/resume-sources.js. Only explicitly supported resume pages. */
(()=>{'use strict';
function normalizeResumeURL(raw){
 try{
  if(typeof raw!=='string'||raw.length>4000||/[\u0000-\u001f\u007f]/.test(raw))return null;
  const u=new URL(raw.trim());
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  for(const key of u.searchParams.keys())if(/^(?:url|redirect|redirect_uri|return|returnurl|return_url|gourl|callback|next|target)$/i.test(key))return null;
  if(['albamon.com','www.albamon.com'].includes(u.hostname)){
   const match=u.pathname.match(/^\/human-resources\/detail\/(\d{1,100})\/?$/);if(!match)return null;
   const url='https://www.albamon.com/human-resources/detail/'+match[1];
   return {sourceService:'albamon',channel:'알바몬',label:'알바몬',id:match[1],url,key:'/human-resources/detail/'+match[1]};
  }
  if(['alba.co.kr','www.alba.co.kr'].includes(u.hostname)&&/^\/resume\/detail\/?$/i.test(u.pathname)){
   const ids=[...u.searchParams].filter(([key])=>key.toLowerCase()==='adid');
   if(ids.length!==1||!/^[A-Za-z0-9_-]{1,100}$/.test(ids[0][1]))return null;
   const id=ids[0][1],url='https://www.alba.co.kr/resume/Detail?adid='+encodeURIComponent(id);
   return {sourceService:'albacheonguk',channel:'알바천국',label:'알바천국',id,url,key:'albacheonguk:'+id};
  }
 }catch{}
 return null;
}
globalThis.PresenceResumeSources={normalizeResumeURL};
})();
