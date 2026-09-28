(() => {
  'use strict';
  const field = document.querySelector('#thoughtUniverse');
  const layer = document.querySelector('#thoughtFragments');
  const canvas = document.querySelector('#thoughtCanvas');
  if (!field || !layer || !canvas) return;
  const ctx = canvas.getContext('2d');
  const book = window.PresenceBook || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Independent frequencies and phases let thoughts wander without a shared loop.
  const words = book.words || [];
  const mobilePositions = book.mobileWordPositions || words.map(word => [word[1], word[2]]);
  const items = words.map(([text,x,y,size,style],i) => {
    const el = document.createElement('span');
    el.className = 'thought-fragment ' + style;
    el.textContent = text;
    layer.append(el);
    return {el,x,y,size,i,phase:i*2.39996,depth:i<3?1:i<9?.75:.42};
  });
  let width=0,height=0,elapsed=0,lastTime=0,raf=0,lastDraw=0;
  let mobile=false;
  function render(t) {
    for (const item of items) {
      const {i,phase,depth,el}=item;
      if (mobile && i>=mobilePositions.length) continue;
      const [bx,by]=mobile?mobilePositions[i]:[item.x,item.y];
      const driftX=Math.sin(t*(.105+i*.0043)+phase)*.044 + Math.sin(t*.043+phase*1.73)*.027;
      const driftY=Math.cos(t*(.089+i*.0027)+phase)*.052 + Math.sin(t*.057+phase*.71)*.037;
      const x=(bx+driftX)*width, y=(by+driftY)*height;
      const scale=1+Math.sin(t*.11+phase)*.055;
      const rotation=Math.sin(t*.081+phase)* (i<3?4:11);
      el.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      el.style.opacity=String((depth*.67+.12) + Math.sin(t*.12+phase)*.1);
    }
    if (!ctx) return;
    ctx.clearRect(0,0,width,height);
    // Quiet dust and broken streamlines imply a field, without drawing regular orbits.
    for(let i=0;i<65;i++) {
      const phase=i*2.39996;
      const x=((i*.618034%1)*width+Math.sin(t*.045+phase)*22+width)%width;
      const y=((i*.414214%1)*height+Math.cos(t*.057+phase)*18+height)%height;
      ctx.fillStyle=`rgba(171,196,210,${.1+(Math.sin(t*.13+phase)+1)*.12})`;
      ctx.beginPath();ctx.arc(x,y,i%5===0?1.2:.65,0,Math.PI*2);ctx.fill();
    }
    ctx.lineWidth=.7;
    for(let j=0;j<3;j++) {
      ctx.strokeStyle=j===1?'rgba(185,164,222,.09)':'rgba(149,188,208,.09)';
      ctx.beginPath();
      for(let k=0;k<=75;k++) {
        const q=k/75;
        const x=width*(.08+q*.87);
        const y=height*(.48+Math.sin(q*5.2+j*2.1+t*.018)*.22+Math.cos(q*8.3+j+t*.028)*.1);
        k?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.stroke();
    }
  }
  function tick(now) {
    if (lastTime) elapsed+=Math.min(now-lastTime,80)/1000;
    lastTime=now;
    if(now-lastDraw>30){render(elapsed);lastDraw=now;}
    raf=requestAnimationFrame(tick);
  }
  function sync() {
    const run=!field.closest('.slide').hidden && !document.hidden && !document.body.classList.contains('paused') && !document.body.classList.contains('notes-open') && !reduced.matches;
    if(run && !raf){lastTime=0;raf=requestAnimationFrame(tick);}
    if(!run && raf){cancelAnimationFrame(raf);raf=0;lastTime=0;}
  }
  function resize() {
    if(!field.clientWidth)return;
    width=field.clientWidth;height=field.clientHeight;mobile=width<651;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx?.setTransform(dpr,0,0,dpr,0,0);
    for(const {el,size,i,depth} of items){
      el.hidden=mobile && i>=mobilePositions.length;
      el.style.fontSize=(size*(mobile?.65:Math.min(width/1300,1)))+'px';
      el.style.filter=depth<.5?'blur(.25px)':'none';
    }
    render(elapsed);sync();
  }
  new ResizeObserver(resize).observe(field);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class','data-scene']});
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  resize();sync();
})();
