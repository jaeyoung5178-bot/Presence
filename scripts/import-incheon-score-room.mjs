import {readdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const source=process.argv[2];
const output=process.argv[3];
if(!source||!output)throw new Error("usage: node import-incheon-score-room.mjs <chat-directory> <output-json>");

const files=(await readdir(source)).filter(name=>name.endsWith(".txt")).sort((a,b)=>{
  const number=name=>Number(name.match(/-(\d+)\.txt$/)?.[1]||0);
  return number(a)-number(b);
});
const records=[];
const clean=value=>value.replace(/^(?:\d+\s*[.)]?\s*)+/,"").replace(/^[^A-Za-z가-힣]+/u,"").replace(/\s+/g," ").trim();
const looksLikeSite=line=>{
  const store=/(?:다이소|스타벅스|ABC\s*마트|홈플러스|롯데마트|이마트|롯데리아|버거킹|빽다방|컴포즈커피|메가MGC커피|올리브영|공차|노브랜드|세븐일레븐|CU|에덴마트|하나은행|신한은행|마이랜드|UNICEF)[가-힣A-Za-z0-9\s]*(?:점|지점|시장|공원|$)/i;
  const station=/[가-힣A-Za-z0-9]{2,}역(?:\s*(?:[1-9]\d*\s*번?\s*출구|[1-9]\d*\s*출)|\s|\/|$)/;
  return store.test(line)||station.test(line);
};
const looksLikeResult=value=>/[가-힣]{2,}\s*(?:\d+(?:\.\d+)?|ic|벨|공|혼)/i.test(value);
const looksLikeConversation=line=>/(3만|2만|5만|후원|아버|어머|감사|합니다|했|하는|인데|이에요|입니다|ㅋㅋ|ㅎㅎ|카드|계좌|출금율|지점장|커피내기|역시|최고|화이팅|가보자|축하|옵니다|알았|리더님)/.test(line);

for(const file of files){
  const text=(await readFile(path.join(source,file),"utf8")).replace(/^\uFEFF/,"").replace(/\r/g,"");
  const date=text.match(/(?:^|\n)(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/)?.slice(1,4);
  if(!date)continue;
  const dateIso=`${date[0]}-${date[1].padStart(2,"0")}-${date[2].padStart(2,"0")}`;
  const lines=text.split("\n").map(line=>line.replace(/^20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:오전|오후)\s*\d{1,2}:\d{2},\s*[^:]+:\s*/,"").trim());
  for(let index=0;index<lines.length;index++){
    let line=lines[index];
    if(!line||/^(?:Weekly|Daily|Field|Avg|HC|Target|Start|카드|계좌|보\s*:|《|[ㅡ—]+)/i.test(line))continue;
    line=clean(line.replace(/^\d+\.\s*/,""));
    if(!looksLikeSite(line)||looksLikeConversation(line))continue;
    let site=line,result="";
    if(line.includes(" - ")){[site,result]=line.split(/\s+-\s+/,2);}
    else if(line.includes("-")){[site,result]=line.split(/\s*-\s*/,2);}
    if(!result){
      const next=clean(lines[index+1]||"");
      if(looksLikeResult(next)&&!looksLikeSite(next)){result=next;index++;}
    }
    if(!result||!looksLikeResult(result))continue;
    site=clean(site).replace(/^(?:Street|CITY|City)\s*/i,"").trim();
    if(site.length<3||site.length>58||looksLikeConversation(site))continue;
    records.push({date:dateIso,site,result:result.replace(/\s+/g," ").trim(),source:file});
  }
}

const unique=[...new Map(records.map(item=>[`${item.date}|${item.site}|${item.result}`,item])).values()]
  .sort((a,b)=>b.date.localeCompare(a.date)||a.site.localeCompare(b.site));
await writeFile(output,JSON.stringify({generatedAt:new Date().toISOString(),source:"인천 스코어방 카카오톡 내보내기",count:unique.length,records:unique},null,2)+"\n");
console.log(`wrote ${unique.length} records to ${output}`);
