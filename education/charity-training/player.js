const $=id=>document.getElementById(id), total=slides.length;
let cur=Math.min(total-1,Math.max(0,(parseInt(location.hash.slice(1))||1)-1)),active=null,audio=null;
const done=new Set(),players=new Map(),pending=new Map();
for (const s of slides){const o=document.createElement('option');o.value=s.n-1;o.textContent=`${String(s.n).padStart(2,'0')} · ${s.title}`;$('select').append(o)}
function stopAudio(){if(audio){audio.pause();audio=null}}
function closeVideo(focus=true){
 if(active!==null){const p=players.get(active);if(p?.type==='file')p.el.pause();else if(p?.ready)p.el.pauseVideo();done.add(active)}
 active=null;$('overlay').hidden=true;$('loading').hidden=true;$('problem').hidden=true;
 document.querySelectorAll('.media-slot').forEach(el=>el.classList.remove('active'));
 if(focus&&!$('play').hidden)$('play').focus();
}
function show(i,autoplay=false){
 if(!Number.isInteger(i)||i<0||i>=total)return;closeVideo(false);stopAudio();cur=i;const s=slides[i];
 $('slideImage').src=`slides/slide-${String(s.n).padStart(2,'0')}.png`;$('slideImage').alt=s.title;
 $('select').value=i;$('counter').textContent=`${String(i+1).padStart(2,'0')} / ${total}`;
 $('prev').disabled=i===0;$('next').disabled=i===total-1&&!s.video;
 $('section').textContent=s.section;$('play').hidden=!s.video;$('status').textContent='';
 if(s.video){const v=s.video;Object.assign($('play').style,{left:v.x/12.8+'%',top:v.y/7.2+'%',width:v.w/12.8+'%',height:v.h/7.2+'%'});$('play').setAttribute('aria-label',s.title+' 재생');prepare(i)}
 $('readBody').replaceChildren();for(const it of s.items){if(it.kind==='text'&&it.y<670){const p=document.createElement('p');p.textContent=it.text;$('readBody').append(p)}}
 $('music').hidden=!s.audio;$('music').textContent='배경음악';
 $('links').replaceChildren();for(const l of s.links||[]){const a=document.createElement('a');a.href=l.url;a.target='_blank';a.rel='noopener';a.textContent=l.label;$('links').append(a)}
 history.replaceState(null,'','#'+s.n);if(typeof drawAgenda==='function'){drawAgenda();updateNavigation();}if(autoplay&&s.video)playVideo();
 // Prepare the upcoming film before the next user gesture.
 for(let j=i+1;j<Math.min(i+4,total);j++)if(slides[j].video){prepare(j);break}
}
function next(){if(!settingsReady){$('status').textContent='교육 설정을 불러오는 중입니다. 잠시 후 다시 눌러주세요.';return}if(active!==null){closeVideo();return}if(slides[cur].video&&!done.has(cur)){playVideo();return}show(targetPage(1),true)}
let ytApi;
function getYT(){if(window.YT?.Player)return Promise.resolve(window.YT);if(ytApi)return ytApi;
 ytApi=new Promise((res,rej)=>{window.onYouTubeIframeAPIReady=()=>res(window.YT);const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.onerror=()=>rej(Error('YouTube 연결 실패'));document.head.append(tag);setTimeout(()=>{if(!window.YT?.Player)rej(Error('YouTube 연결 시간 초과'))},20000)});return ytApi}
function setError(i,msg){if(active!==i)return;$('loading').hidden=true;$('problem').hidden=false;$('errorText').textContent=msg;$('openOriginal').href=slides[i].video.type==='file'?slides[i].video.src:'https://www.youtube.com/watch?v='+slides[i].video.src}
function prepare(i){
 if(players.has(i))return Promise.resolve(players.get(i));if(pending.has(i))return pending.get(i);
 const v=slides[i].video;if(!v)return Promise.resolve(null);
 const slot=document.createElement('div');slot.className='media-slot';slot.id='slot-'+i;$('mediaHost').append(slot);
 if(v.type==='file'){
  const el=document.createElement('video');el.src=v.src;el.poster=v.poster;el.controls=true;el.playsInline=true;el.preload='metadata';el.setAttribute('playsinline','');el.setAttribute('webkit-playsinline','');el.setAttribute('aria-label',slides[i].title);slot.append(el);
  el.onplaying=()=>{if(active===i)$('loading').hidden=true};el.onended=()=>{if(active===i)closeVideo()};el.onerror=()=>setError(i,'영상을 불러오지 못했습니다. 다시 재생해 주세요.');
  const p={type:'file',el,slot,ready:true};players.set(i,p);return Promise.resolve(p);
 }
 const task=getYT().then(Y=>new Promise((res,rej)=>{
  const mount=document.createElement('div');mount.id='yt-'+i;slot.append(mount);
  const p={type:'youtube',slot,ready:false};players.set(i,p);
  p.el=new Y.Player(mount.id,{videoId:v.src,host:'https://www.youtube-nocookie.com',playerVars:{playsinline:1,autoplay:0,rel:0,origin:location.origin},events:{
   onReady:()=>{p.ready=true;res(p);if(active===i)start(p,i)},
   onStateChange:e=>{if(active!==i)return;if(e.data===1)$('loading').hidden=true;if(e.data===0)closeVideo()},
   onError:()=>setError(i,'YouTube 영상을 불러오지 못했습니다. 연결을 확인한 후 다시 재생해 주세요.')
  }});
 })).catch(e=>{pending.delete(i);slot.remove();setError(i,e.message);return null});pending.set(i,task);return task;
}
function start(p,i){
 if(!p||active!==i)return;p.slot.classList.add('active');
 if(p.type==='file'){p.el.currentTime=0;p.el.play().catch(()=>{if(active===i){$('loading').hidden=true;setError(i,'자동 재생을 시작하지 못했습니다. 아래 재생 버튼을 눌러주세요.')}})}
 else if(p.ready){p.el.seekTo(0,true);p.el.playVideo();$('loading').hidden=true}
}
function playVideo(){
 const i=cur;if(!slides[i].video)return;stopAudio();active=i;$('overlay').hidden=false;$('loading').hidden=false;$('problem').hidden=true;
 document.querySelectorAll('.media-slot').forEach(el=>el.classList.remove('active'));
 const p=players.get(i);if(p){p.slot.classList.add('active');start(p,i)}else prepare(i).then(p=>start(p,i));
 $('closeVideo').focus();
}
$('next').onclick=next;$('prev').onclick=()=>show(targetPage(-1));$('select').onchange=()=>show(+$('select').value,true);$('play').onclick=playVideo;$('closeVideo').onclick=()=>closeVideo();$('retry').onclick=playVideo;
$('full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.().catch(()=>{$('status').textContent='창 크기에 맞춰 표시합니다.'})};
$('source').onclick=()=>{$('originalImage').src=`originals/slide-${String(slides[cur].source).padStart(2,'0')}.jpg`;$('sourceDialog').showModal()};$('closeSource').onclick=()=>$('sourceDialog').close();
$('read').onclick=()=>$('readDialog').showModal();$('closeRead').onclick=()=>$('readDialog').close();
$('music').onclick=()=>{if(audio){stopAudio();$('music').textContent='배경음악'}else{audio=new Audio(slides[cur].audio);audio.onended=()=>{audio=null;$('music').textContent='배경음악'};audio.play().then(()=>$('music').textContent='음악 정지').catch(()=>$('status').textContent='음악을 재생하지 못했습니다.')}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(active!==null){e.preventDefault();closeVideo()}return}if(e.target.matches('select,input,textarea')||document.querySelector('dialog[open]'))return;
 if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();next()}else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();if(active!==null)closeVideo();else show(targetPage(-1))}else if(e.key==='Home')show(visibleIndices()[0]);else if(e.key==='End')show(visibleIndices().at(-1))});
getYT().then(()=>{for(let i=0;i<total;i++)if(slides[i].video?.type==='youtube')prepare(i)}).catch(()=>{});
