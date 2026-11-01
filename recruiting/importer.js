import {normalizeResumeURL} from './resume-sources.js?v=20261101-alba-applicants1';
let connected=false,active=null,sources=['albamon'],features=[],extensionVersion='구버전',generation=0;
const listeners=new Set(),results=new Set();
export function cancelPendingImport(){generation++;active=null;}
const request=(type,extra={})=>{const requestId=extra.requestId||crypto.randomUUID();return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{listeners.delete(receive);reject(Error('웨일 연결 도우미가 응답하지 않아요. 웨일에서 이 페이지를 열고 도우미를 연결해 주세요.'));},type==='CREW_PING'?1200:10000);const receive=message=>{if(message.type!==type+'_REPLY'||message.requestId!==requestId)return;clearTimeout(timeout);listeners.delete(receive);if(!message.result?.ok)reject(Error(message.result?.error||'브라우저 도우미 연결을 확인해 주세요.'));else resolve({...message.result,requestId});};listeners.add(receive);window.postMessage({source:'presence-crew-page',type,requestId,...extra},location.origin);});};
window.addEventListener('message',event=>{if(event.source!==window||event.origin!==location.origin||event.data?.source!=='presence-crew-extension')return;const m=event.data;if(m.type==='CREW_READY'){connected=true;document.dispatchEvent(new Event('crew-extension-ready'));}for(const listener of listeners)listener(m);if(m.type==='CREW_RESULT'&&m.requestId===active){for(const listener of results)listener(m.payload);}});
export const importer={
  async available(){try{const result=await request('CREW_PING');sources=Array.isArray(result.sources)?result.sources.filter(source=>['albamon','albacheonguk'].includes(source)):['albamon'];features=Array.isArray(result.features)?result.features.filter(feature=>['albacheonguk-popup','albacheonguk-applicants'].includes(feature)):[];extensionVersion=/^\d+\.\d+\.\d+$/.test(result.extensionVersion||'')?result.extensionVersion:'구버전';connected=true;return true;}catch{connected=false;features=[];return false;}},
  get connected(){return connected;},get version(){return extensionVersion;},supports(source){return sources.includes(source);},supportsFeature(feature){return features.includes(feature);},cancel:cancelPendingImport,
  onResult(listener){results.add(listener);return()=>results.delete(listener);},
  async import(url){
    const requestGeneration=generation;active=null;const source=normalizeResumeURL(url);
    if(!source)throw Error('알바몬·알바천국의 이력서 또는 지원자 상세 주소 전체를 넣어 주세요.');
    const feature=source.view==='applicants'?'albacheonguk-applicants':source.view==='popup'?'albacheonguk-popup':'';
    if(source.sourceService==='albacheonguk'&&(!sources.includes('albacheonguk')||(feature&&!features.includes(feature)))){
      await this.available();
      if(!sources.includes('albacheonguk'))throw Error('알바천국을 연결하려면 웨일 도우미 4.1.0으로 업데이트해 주세요.');
      if(feature&&!features.includes(feature))throw Error((source.view==='applicants'?'지원자 상세·문자 지원 화면':'열람한 이력서 화면')+'은 도우미 4.1.0 업데이트가 필요해요. 도우미와 캠프·원본 페이지를 새로고침해 주세요.');
    }
    if(requestGeneration!==generation)throw Error('계정이 바뀌어 이전 가져오기를 취소했어요.');
    active=crypto.randomUUID();return request('CREW_IMPORT',{url:source.url,requestId:active});
  },
  async focus(){if(active)await request('CREW_FOCUS_ALBAMON',{requestId:active});},
};
