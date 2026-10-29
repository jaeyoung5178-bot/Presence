// Only source-owned HTTPS resume detail routes may enter the import bridge.
// Alba supports both listing detail links and the actual opened resume popup.
export function normalizeResumeURL(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 4000 || /[\u0000-\u001f\u007f]/.test(raw)) return null;
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    for (const key of url.searchParams.keys()) if (/^(?:url|redirect|redirect_uri|return|returnurl|return_url|gourl|callback|next|target)$/i.test(key)) return null;
    if (['albamon.com','www.albamon.com'].includes(url.hostname)) {
      const match = url.pathname.match(/^\/human-resources\/detail\/(\d{1,100})\/?$/);
      if (!match) return null;
      const id = match[1], path = `/human-resources/detail/${id}`;
      return { sourceService:'albamon',channel:'알바몬',label:'알바몬',id,url:`https://www.albamon.com${path}`,key:path };
    }
    if (['alba.co.kr','www.alba.co.kr'].includes(url.hostname) && /^\/resume\/(?:Detail|popup\/ResumeDetail)\/?$/i.test(url.pathname)) {
      const identifiers = [...url.searchParams].filter(([key]) => key.toLowerCase() === 'adid');
      if (identifiers.length !== 1 || !/^[A-Za-z0-9_-]{1,100}$/.test(identifiers[0][1])) return null;
      const id = identifiers[0][1],view=/^\/resume\/popup\//i.test(url.pathname)?'popup':'detail';
      const path=view==='popup'?'/resume/popup/ResumeDetail':'/resume/Detail';
      return { sourceService:'albacheonguk',channel:'알바천국',label:'알바천국',id,view,url:`https://www.alba.co.kr${path}?adid=${encodeURIComponent(id)}`,key:`albacheonguk:${id}` };
    }
  } catch {}
  return null;
}
