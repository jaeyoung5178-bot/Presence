(function(){
  "use strict";

  var TOTAL=75;
  var mediaByPage={
    4:{type:"video",src:"assets/media/media1.mp4"},
    9:{type:"youtube",id:"zzPG-jwukoE"},
    16:{type:"video",src:"assets/media/media2.mp4"},
    19:{type:"youtube",id:"Nypb-XKldIE"},
    32:{type:"youtube",id:"khA5FD9mK8A"},
    39:{type:"youtube",id:"NH7n5N7DspA"},
    40:{type:"video",src:"assets/media/media3.mp4"},
    41:{type:"audio",src:"assets/media/media4.mp3"},
    55:{type:"video",src:"assets/media/media5.mp4"},
    56:{type:"video",src:"assets/media/media6.mp4"},
    59:{type:"video",src:"assets/media/media7.mp4"},
    68:{type:"video",src:"assets/media/media8.mp4"},
    69:{type:"video",src:"assets/media/media9.mp4"},
    71:{type:"audio",src:"assets/media/media10.mp3"},
    72:{type:"video",src:"assets/media/media11.mp4"},
    75:{type:"youtube",id:"lPm9dJPlc2k"}
  };

  var ready=document.getElementById("ready");
  var stage=document.getElementById("stage");
  var image=document.getElementById("slideImage");
  var hint=document.getElementById("mediaHint");
  var layer=document.getElementById("mediaLayer");
  var frame=document.getElementById("mediaFrame");
  var counter=document.getElementById("counter");
  var bar=document.getElementById("progressBar");
  var page=1;
  var started=false;
  var mediaPhase=0;
  var activeMedia=null;

  function pad(n){return String(n).padStart(2,"0");}
  function slideSrc(n){return "assets/slides/slide-"+pad(n)+".jpg";}
  function requestFull(el){
    var fn=el.requestFullscreen||el.webkitRequestFullscreen;
    if(fn){try{var p=fn.call(el);if(p&&p.catch)p.catch(function(){});}catch(e){}}
  }
  function exitFull(){
    var fn=document.exitFullscreen||document.webkitExitFullscreen;
    if(fn&&(document.fullscreenElement||document.webkitFullscreenElement)){try{var p=fn.call(document);if(p&&p.catch)p.catch(function(){});}catch(e){}}
  }
  function start(){
    if(started)return;
    started=true;ready.hidden=true;stage.hidden=false;render();
  }
  function render(){
    stopMedia(false);
    image.src=slideSrc(page);
    image.alt="OXFAM 신입교육 슬라이드 "+page+" / "+TOTAL;
    counter.textContent=pad(page)+" / "+TOTAL;
    bar.style.width=(page/TOTAL*100)+"%";
    hint.hidden=!mediaByPage[page];
    mediaPhase=0;
    history.replaceState(null,"","#"+page);
    preload(page+1);
  }
  function preload(n){if(n<=TOTAL){var i=new Image();i.src=slideSrc(n);}}
  function makeMedia(spec){
    frame.replaceChildren();
    if(spec.type==="youtube"){
      var iframe=document.createElement("iframe");
      iframe.src="https://www.youtube-nocookie.com/embed/"+spec.id+"?autoplay=1&controls=1&rel=0&playsinline=1&enablejsapi=1";
      iframe.title="OXFAM 교육 영상";
      iframe.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen=true;frame.appendChild(iframe);return iframe;
    }
    if(spec.type==="audio"){
      var shell=document.createElement("div");shell.className="audio-player";
      var orb=document.createElement("div");orb.className="audio-orb";orb.textContent="♫";
      var label=document.createElement("p");label.textContent="OXFAM 교육 오디오 재생 중";
      var audio=document.createElement("audio");audio.src=spec.src;audio.preload="auto";
      shell.append(orb,label,audio);frame.appendChild(shell);audio.play().catch(function(){});return audio;
    }
    var video=document.createElement("video");
    video.src=spec.src;video.preload="auto";video.playsInline=true;video.controls=true;
    frame.appendChild(video);video.play().catch(function(){});return video;
  }
  function playMedia(){
    var spec=mediaByPage[page];if(!spec)return false;
    activeMedia=makeMedia(spec);layer.hidden=false;hint.hidden=true;mediaPhase=1;requestFull(layer);return true;
  }
  function stopMedia(exitFullscreen){
    if(activeMedia){
      if(activeMedia.tagName==="IFRAME"){activeMedia.contentWindow&&activeMedia.contentWindow.postMessage(JSON.stringify({event:"command",func:"pauseVideo",args:[]}),"*");}
      else{try{activeMedia.pause();activeMedia.currentTime=0;}catch(e){}}
    }
    activeMedia=null;frame.replaceChildren();layer.hidden=true;
    if(exitFullscreen)exitFull();
  }
  function next(){
    if(!started){start();return;}
    if(mediaByPage[page]&&mediaPhase===0){playMedia();return;}
    if(mediaByPage[page]&&mediaPhase===1){stopMedia(true);mediaPhase=2;hint.hidden=false;return;}
    if(page<TOTAL){page++;render();}
  }
  function prev(){
    if(!started)return;
    if(mediaPhase===1){stopMedia(true);mediaPhase=0;hint.hidden=false;return;}
    if(page>1){page--;render();}
  }
  function end(){stopMedia(true);started=false;stage.hidden=true;ready.hidden=false;page=1;history.replaceState(null,"",location.pathname);}
  function onKey(e){
    if(["ArrowRight","PageDown"," ","Enter","MediaTrackNext"].indexOf(e.key)>=0){e.preventDefault();next();return;}
    if(["ArrowLeft","PageUp","Backspace","MediaTrackPrevious"].indexOf(e.key)>=0){e.preventDefault();prev();return;}
    if(e.key==="Escape"&&!document.fullscreenElement){end();}
  }
  document.addEventListener("keydown",onKey,{passive:false});
  ready.addEventListener("click",start);
  document.getElementById("nextButton").addEventListener("click",next);
  document.getElementById("prevButton").addEventListener("click",prev);
  document.getElementById("exitButton").addEventListener("click",end);
  layer.addEventListener("dblclick",function(){stopMedia(true);mediaPhase=2;hint.hidden=false;});
  image.addEventListener("error",function(){image.alt="슬라이드를 불러오지 못했습니다.";});
  var initial=parseInt(location.hash.slice(1),10);if(initial>=1&&initial<=TOTAL)page=initial;
})();
