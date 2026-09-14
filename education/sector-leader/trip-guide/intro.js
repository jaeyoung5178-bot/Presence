(()=>{'use strict';
const $=id=>document.getElementById(id),intro=$('tripIntro'),deck=$('deck'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let paused=reduced.matches;
function sync(){intro.classList.toggle('is-paused',paused||document.hidden||intro.hidden);$('pauseIntro').textContent=paused?'재생':'일시정지';$('pauseIntro').setAttribute('aria-pressed',String(paused));$('pauseIntro').setAttribute('aria-label','인트로 애니메이션 '+(paused?'재생':'일시정지'));}
function showIntro(){deck.hidden=true;intro.hidden=false;document.body.classList.add('intro-active');document.body.classList.remove('presenting');history.replaceState(null,'','#intro');sync();$('startTrip').focus({preventScroll:true});}
function start(){intro.hidden=true;deck.hidden=false;document.body.classList.remove('intro-active');document.body.classList.add('presenting');window.dispatchEvent(new Event('trip-start'));window.scrollTo({top:0,behavior:'instant'});sync();$('next').focus({preventScroll:true});}
$('startTrip').onclick=start;$('replayIntro').onclick=showIntro;
window.addEventListener('hashchange',()=>{if(location.hash==='#intro')showIntro();else sync();});
$('pauseIntro').onclick=()=>{paused=!paused;sync();};
$('introFullscreen').hidden=!document.fullscreenEnabled;
$('introFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
document.addEventListener('fullscreenchange',()=>{$('introFullscreen').textContent=document.fullscreenElement?'전체화면 종료':'전체화면';});
document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',e=>{paused=e.matches;sync();});
document.addEventListener('keydown',e=>{if(intro.hidden||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==='ArrowRight'||(e.key==='Enter'&&e.target===document.body)||(e.key===' '&&e.target===document.body)){e.preventDefault();start();}});
if(window.TRIP_START_WITH_INTRO)showIntro();else{intro.hidden=true;deck.hidden=false;document.body.classList.remove('intro-active');sync();}
})();
