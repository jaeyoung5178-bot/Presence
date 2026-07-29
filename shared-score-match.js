(function(){
  const clean=value=>String(value||"").normalize("NFKC").toLowerCase()
    .replace(/abc\s*마트/g,"abc마트").replace(/메가\s*mgc\s*커피/g,"메가mgc커피")
    .replace(/다이서/g,"다이소").replace(/^e[.\s]*(?=[가-힣])/,"")
    .replace(/\([^)]*\)/g," ").replace(/\s*\/.*$/,"").replace(/[^a-z0-9가-힣]/g,"");
  const key=value=>{
    const raw=String(value||"").replace(/굴\s*[4포]\s*천\s*[엳역]/g,"굴포천역");
    const station=raw.match(/([가-힣A-Za-z0-9]{2,}역)/)?.[1];
    if(station&&!/^(다이소|스타벅스|ABC|홈플러스|롯데|이마트|버거킹|맥도날드|빽다방|컴포즈|메가|올리브영|하나은행|신한은행)/i.test(raw))return clean(station);
    return clean(raw).replace(/(?:지점|본점)$/,"점");
  };
  const score=value=>{let total=0;for(const match of String(value||"").matchAll(/[가-힣]{2,}\s*(\d+(?:\.\d+)?)/g))total+=Number(match[1]);return total};
  const load=async url=>{
    const response=await fetch(url);if(!response.ok)throw new Error("score data unavailable");
    const data=await response.json(),daily=new Map();
    (data.records||[]).forEach(item=>{
      const siteKey=key(item.site),dayKey=`${siteKey}|${item.date}`,value=score(item.result),previous=daily.get(dayKey);
      if(!previous||value>previous.score||(value===previous.score&&item.result.length>previous.result.length))daily.set(dayKey,{...item,key:siteKey,score:value});
    });
    const grouped=new Map();
    daily.forEach(item=>{if(!grouped.has(item.key))grouped.set(item.key,[]);grouped.get(item.key).push(item)});
    return {
      find(name){
        const siteKey=key(name),days=grouped.get(siteKey);
        if(!days?.length)return null;
        days.sort((a,b)=>b.date.localeCompare(a.date));
        return {days:days.length,average:days.reduce((sum,item)=>sum+item.score,0)/days.length,recent:days[0],key:siteKey};
      },
      key
    };
  };
  window.PresenceScoreMatcher={load,key};
})();
