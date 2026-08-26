
'use strict';
const MAX_SIDE=1200,GIF_SIDE=480;
let originalImage=null,sketchImageData=null,currentStyle='pencil',animFrameId=null,animPaused=false,contours=[],segLens=[],contourStartDist=[],totalDist=0,animState=null,gifEncoding=false;
const $=id=>document.getElementById(id);
const dropZone=$('drop-zone'),fileInput=$('file-input'),uploadError=$('upload-error'),workspace=$('workspace'),uploadSection=$('upload-section'),changeImageBtn=$('change-image-btn'),imageInfo=$('image-info');
const tabStatic=$('tab-static'),tabAnim=$('tab-anim'),panelStatic=$('panel-static'),panelAnim=$('panel-anim');
const sketchCanvas=$('sketch-canvas'),sketchCtx=sketchCanvas.getContext('2d',{willReadFrequently:true}),staticProcessing=$('static-processing');
const blurSlider=$('blur-slider'),blurValue=$('blur-value'),contrastSlider=$('contrast-slider'),contrastValue=$('contrast-value'),charcoalSlider=$('charcoal-slider'),charcoalValue=$('charcoal-value'),charcoalControls=$('charcoal-controls'),stylePencil=$('style-pencil'),styleCharcoal=$('style-charcoal'),downloadPngBtn=$('download-png-btn');
const animCanvas=$('anim-canvas'),animCtx=animCanvas.getContext('2d'),animProcessing=$('anim-processing'),speedSlider=$('speed-slider'),speedValue=$('speed-value'),strokeSlider=$('stroke-slider'),strokeValue=$('stroke-value'),playBtn=$('play-btn'),pauseBtn=$('pause-btn'),replayBtn=$('replay-btn'),animProgressBar=$('anim-progress-bar');
const exportBtn=$('export-btn'),gifProgress=$('gif-progress'),gifProgressBar=$('gif-progress-bar'),gifProgressLabel=$('gif-progress-label');

/* ── background particles ── */
(function(){const c=$('bg-canvas'),ctx=c.getContext('2d');let W,H,P=[];
const rz=()=>{W=c.width=innerWidth;H=c.height=innerHeight;};
const mk=()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.4+.3,vx:(Math.random()-.5)*.18,vy:(Math.random()-.5)*.18,a:Math.random()*.4+.1});
const init=()=>{P=Array.from({length:90},mk);};
const draw=()=>{ctx.clearRect(0,0,W,H);P.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(167,139,250,${p.a})`;ctx.fill();p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;});requestAnimationFrame(draw);};
rz();init();draw();addEventListener('resize',()=>{rz();init();});})();

/* ── upload ── */
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('drag-over');if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]);});
dropZone.addEventListener('click',()=>fileInput.click());
dropZone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click();}});
fileInput.addEventListener('change',()=>{if(fileInput.files[0])loadFile(fileInput.files[0]);});
changeImageBtn.addEventListener('click',()=>{workspace.hidden=true;uploadSection.hidden=false;});
function showError(m){uploadError.textContent=m;uploadError.hidden=false;}
function clearError(){uploadError.hidden=true;}
function loadFile(file){
  clearError();
  if(!file.type.startsWith('image/')){showError('Please upload a valid image file.');return;}
  const r=new FileReader();
  r.onload=e=>{const img=new Image();img.onload=()=>{originalImage=img;uploadSection.hidden=true;workspace.hidden=false;imageInfo.innerHTML=`<strong>${file.name}</strong><br>${img.naturalWidth}\xd7${img.naturalHeight} px \xb7 ${(file.size/1024).toFixed(0)} KB`;generateSketch();};img.onerror=()=>showError('Could not load image.');img.src=e.target.result;};
  r.readAsDataURL(file);
}

/* ── tabs ── */
tabStatic.addEventListener('click',()=>switchTab('static'));
tabAnim.addEventListener('click',()=>switchTab('anim'));
function switchTab(tab){
  const s=tab==='static';
  [tabStatic,panelStatic].forEach(el=>el.classList.toggle('active',s));
  [tabAnim,panelAnim].forEach(el=>el.classList.toggle('active',!s));
  tabStatic.setAttribute('aria-selected',s);tabAnim.setAttribute('aria-selected',!s);
  panelStatic.hidden=!s;panelAnim.hidden=s;
  if(!s&&contours.length===0&&sketchImageData)prepareAnimation();
}

/* ══════ FEATURE 1 — STATIC SKETCH ══════ */
function scaledDim(img){let w=img.naturalWidth,h=img.naturalHeight;if(Math.max(w,h)>MAX_SIDE){const s=MAX_SIDE/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}return{w,h};}

async function generateSketch(){
  if(!originalImage)return;
  staticProcessing.hidden=false;downloadPngBtn.disabled=true;
  await nf();
  const{w,h}=scaledDim(originalImage);
  const oc=document.createElement('canvas');oc.width=w;oc.height=h;
  const ox=oc.getContext('2d',{willReadFrequently:true});ox.drawImage(originalImage,0,0,w,h);
  const src=ox.getImageData(0,0,w,h);
  sketchImageData=await new Promise(r=>setTimeout(()=>r(computeSketch(src,w,h,+blurSlider.value,+contrastSlider.value/100,+charcoalSlider.value/100,currentStyle)),20));
  sketchCanvas.width=w;sketchCanvas.height=h;sketchCtx.putImageData(sketchImageData,0,0);
  staticProcessing.hidden=true;downloadPngBtn.disabled=false;
  contours=[];
}

function computeSketch(src,w,h,br,cm,cd,style){
  const n=w*h,d=src.data,gray=new Uint8ClampedArray(n),inv=new Uint8ClampedArray(n);
  for(let i=0;i<n;i++){const p=i*4;gray[i]=.299*d[p]+.587*d[p+1]+.114*d[p+2];}
  for(let i=0;i<n;i++)inv[i]=255-gray[i];
  const bl=gblur(inv,w,h,br),out=new ImageData(w,h),od=out.data;
  for(let i=0;i<n;i++){const p=i*4,g=gray[i],b=bl[i];let v=b>=255?255:Math.min(255,(g/(1-b/255))|0);
    if(style==='charcoal'){v=255-v;v=(v*(1-cd*.4))|0;v=Math.max(0,Math.min(255,v+(Math.random()-.5)*18));}
    v=Math.max(0,Math.min(255,((v-128)*cm+128)|0));od[p]=od[p+1]=od[p+2]=v;od[p+3]=255;}
  return out;
}
function gblur(src,w,h,r){
  if(r<1)return src;
  const sig=r/2,k=new Float32Array(r*2+1),s2=2*sig*sig;
  for(let i=0;i<=r;i++)k[r+i]=k[r-i]=Math.exp(-(i*i)/s2);
  const tmp=new Float32Array(w*h),out=new Uint8ClampedArray(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,ws=0;for(let ki=-r;ki<=r;ki++){const xi=Math.max(0,Math.min(w-1,x+ki)),kw=k[ki+r];s+=src[y*w+xi]*kw;ws+=kw;}tmp[y*w+x]=s/ws;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,ws=0;for(let ki=-r;ki<=r;ki++){const yi=Math.max(0,Math.min(h-1,y+ki)),kw=k[ki+r];s+=tmp[yi*w+x]*kw;ws+=kw;}out[y*w+x]=s/ws;}
  return out;
}

let debT=null;
function debounceSk(){clearTimeout(debT);debT=setTimeout(generateSketch,180);}
blurSlider.addEventListener('input',()=>{blurValue.textContent=blurSlider.value;debounceSk();});
contrastSlider.addEventListener('input',()=>{contrastValue.textContent=contrastSlider.value;debounceSk();});
charcoalSlider.addEventListener('input',()=>{charcoalValue.textContent=charcoalSlider.value;debounceSk();});
stylePencil.addEventListener('click',()=>setStyle('pencil'));
styleCharcoal.addEventListener('click',()=>setStyle('charcoal'));
function setStyle(s){currentStyle=s;stylePencil.classList.toggle('active',s==='pencil');stylePencil.setAttribute('aria-pressed',s==='pencil');styleCharcoal.classList.toggle('active',s==='charcoal');styleCharcoal.setAttribute('aria-pressed',s==='charcoal');charcoalControls.hidden=s!=='charcoal';if(originalImage)generateSketch();}
downloadPngBtn.addEventListener('click',()=>{
  if(!sketchImageData)return;
  const{naturalWidth:nw,naturalHeight:nh}=originalImage;
  const fc=document.createElement('canvas');fc.width=nw;fc.height=nh;
  const fx=fc.getContext('2d',{willReadFrequently:true});fx.drawImage(originalImage,0,0,nw,nh);
  const fs=fx.getImageData(0,0,nw,nh);fx.putImageData(computeSketch(fs,nw,nh,+blurSlider.value,+contrastSlider.value/100,+charcoalSlider.value/100,currentStyle),0,0);
  fc.toBlob(b=>{const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='pic2sketch.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),5e3);},'image/png');
});

/* ══════ FEATURE 2 — CONTINUOUS HUMAN-LIKE ANIMATION ══════ */
/* Algorithm:
   1. Threshold sketch pixels → stroke map
   2. Edge-thin (keep boundary pixels only)
   3. Trace chains with direction-momentum (smooth paths)
   4. Orient every chain so it starts at its TOP-LEFT-most point
   5. Sort chains in scanline order (top→bottom rows, left→right within row)
   6. Compute cumulative Euclidean path length for constant-speed drawing
   7. Animate: advance "pen" at constant px/s → always continuous
*/
const DX8=[1,1,0,-1,-1,-1,0,1],DY8=[0,1,1,1,0,-1,-1,-1];

async function prepareAnimation(){
  if(!sketchImageData)return;
  animProcessing.hidden=false;cancelAnim();await nf();
  try{
    const result=await new Promise(r=>setTimeout(()=>r(extractContours(sketchImageData)),30));
    contours=result.chains;segLens=result.segLens;contourStartDist=result.startDists;totalDist=result.totalDist;
    animCanvas.width=sketchImageData.width;animCanvas.height=sketchImageData.height;
    animCtx.fillStyle='#fff';animCtx.fillRect(0,0,animCanvas.width,animCanvas.height);
  }catch(err){
    console.error('extractContours failed:',err);
    contours=[];totalDist=0;
  }
  animProcessing.hidden=true;
  if(contours.length>0)startAnimation();
  else{playBtn.hidden=false;pauseBtn.hidden=true;}
}

function extractContours(imgData){
  const{width:w,height:h,data:d}=imgData;
  /* 1. threshold */
  const sm=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)sm[i]=d[i*4]<215?1:0;
  /* 2. edge-thin: keep only boundary pixels */
  const tm=new Uint8Array(w*h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    if(!sm[y*w+x])continue;
    if(!sm[(y-1)*w+x]||!sm[(y+1)*w+x]||!sm[y*w+x-1]||!sm[y*w+x+1])tm[y*w+x]=1;
  }
  /* 3. trace chains with direction momentum */
  const vis=new Uint8Array(w*h),chains=[],all=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(tm[y*w+x])all.push({x,y});}
  /* find endpoints (<=1 unvisited neighbour) first for cleaner starts */
  const eps=all.filter(({x,y})=>{let c=0;for(let k=0;k<8;k++){const nx=x+DX8[k],ny=y+DY8[k];if(nx>=0&&nx<w&&ny>=0&&ny<h&&tm[ny*w+nx])c++;}return c<=1;});
  function trace(sx,sy){
    const ch=[];let cx=sx,cy=sy,px=-1,py=-1;
    while(true){const ci=cy*w+cx;if(vis[ci])break;vis[ci]=1;ch.push({x:cx,y:cy});
      const dx=px<0?0:cx-px,dy=py<0?0:cy-py;let bs=-Infinity,bx=-1,by=-1;
      for(let k=0;k<8;k++){const nx=cx+DX8[k],ny=cy+DY8[k];if(nx<0||nx>=w||ny<0||ny>=h||!tm[ny*w+nx]||vis[ny*w+nx])continue;
        const sc=(dx===0&&dy===0)?0:DX8[k]*dx+DY8[k]*dy;if(sc>bs){bs=sc;bx=nx;by=ny;}}
      if(bx<0)break;px=cx;py=cy;cx=bx;cy=by;}
    return ch;
  }
  for(const{x,y}of eps)if(!vis[y*w+x]){const c=trace(x,y);if(c.length>=4)chains.push(c);}
  for(const{x,y}of all)if(!vis[y*w+x]){const c=trace(x,y);if(c.length>=4)chains.push(c);}

  /* 4. orient each chain: start = topmost point (then leftmost if tie) */
  for(const c of chains){
    const s=c[0],e=c[c.length-1];
    if(e.y<s.y||(e.y===s.y&&e.x<s.x))c.reverse();
  }

  /* 5. scanline sort: divide image into ~30 horizontal bins,
        within each bin sort left→right by start X.
        This produces top-to-bottom, left-to-right continuous ordering. */
  const BIN=Math.max(8,Math.ceil(h/30));
  chains.sort((a,b)=>{
    const ar=(a[0].y/BIN)|0,br=(b[0].y/BIN)|0;
    return ar!==br?ar-br:a[0].x-b[0].x;
  });

  /* 6. compute per-chain segment cumulative lengths for constant-speed drawing */
  let cumDist=0;
  const segLens=[],startDists=[];
  for(const c of chains){
    startDists.push(cumDist);
    const lens=[0];
    for(let i=1;i<c.length;i++){const dx=c[i].x-c[i-1].x,dy=c[i].y-c[i-1].y;lens.push(lens[i-1]+Math.sqrt(dx*dx+dy*dy));}
    cumDist+=lens[lens.length-1];
    segLens.push(lens);
  }
  return{chains,segLens,startDists,totalDist:cumDist};
}

/* ── playback controls ── */
const strokeLabels=['','Sparse','Medium','Dense'];
const speedCustom=document.getElementById('speed-custom');
function getDurationMs(){const v=speedCustom?parseFloat(speedCustom.value):NaN;return Math.max(500,(isNaN(v)?parseFloat(speedSlider.value):v)*1000);}
speedSlider.addEventListener('input',()=>{
  const v=parseFloat(speedSlider.value);
  speedValue.textContent=v.toFixed(1)+'s';
  speedCustom.value=v.toFixed(1);
});
speedCustom.addEventListener('input',()=>{
  const v=Math.max(0.5,Math.min(600,parseFloat(speedCustom.value)||3));
  speedValue.textContent=v.toFixed(1)+'s';
  // sync slider if in range
  if(v<=60)speedSlider.value=v;
});
strokeSlider.addEventListener('input',()=>{strokeValue.textContent=strokeLabels[strokeSlider.value]||'Medium';});
playBtn.addEventListener('click',()=>{if(contours.length===0)prepareAnimation();else resumeAnim();});
pauseBtn.addEventListener('click',pauseAnim);
replayBtn.addEventListener('click',()=>prepareAnimation());

function cancelAnim(){if(animFrameId){cancelAnimationFrame(animFrameId);animFrameId=null;}animPaused=false;}
function pauseAnim(){animPaused=true;if(animState)animState.pausedAt=performance.now();playBtn.hidden=false;pauseBtn.hidden=true;}
function resumeAnim(){
  animPaused=false;
  if(animState&&animState.startTime!==null&&animState.pausedAt!==null){animState.startTime+=performance.now()-animState.pausedAt;animState.pausedAt=null;}
  playBtn.hidden=true;pauseBtn.hidden=false;
  if(!animFrameId)animFrameId=requestAnimationFrame(animLoop);
}
function setupPencil(ctx){ctx.strokeStyle='#1a1a1a';ctx.lineWidth=1.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=.88;}

function startAnimation(){
  cancelAnim();playBtn.hidden=true;pauseBtn.hidden=false;
  if(totalDist===0)return;
  const durationMs=getDurationMs();
  animCtx.fillStyle='#fff';animCtx.fillRect(0,0,animCanvas.width,animCanvas.height);
  setupPencil(animCtx);
  animState={durationMs,contourIdx:0,pointIdx:0,drawnDist:0,startTime:null,pausedAt:null};
  animFrameId=requestAnimationFrame(animLoop);
}

function animLoop(ts){
  if(animPaused){animFrameId=requestAnimationFrame(animLoop);return;}
  const st=animState;
  if(!st.startTime)st.startTime=ts;
  const progress=Math.min((ts-st.startTime)/st.durationMs,1);
  const targetDist=progress*totalDist;

  /* advance pen along contours at constant Euclidean speed */
  while(st.drawnDist<targetDist&&st.contourIdx<contours.length){
    const chain=contours[st.contourIdx];
    const lens=segLens[st.contourIdx];
    const cOffset=contourStartDist[st.contourIdx];
    // if pen hasn't reached this contour yet, wait
    if(cOffset>targetDist)break;
    const targetInChain=targetDist-cOffset;
    let ei=st.pointIdx;
    while(ei<chain.length-1&&lens[ei+1]<=targetInChain)ei++;
    if(ei>st.pointIdx){
      animCtx.beginPath();animCtx.moveTo(chain[st.pointIdx].x,chain[st.pointIdx].y);
      for(let i=st.pointIdx+1;i<=ei;i++)animCtx.lineTo(chain[i].x,chain[i].y);
      animCtx.stroke();
      st.drawnDist=cOffset+lens[ei];
      st.pointIdx=ei;
    }
    if(st.pointIdx>=chain.length-1){st.contourIdx++;st.pointIdx=0;}else break;
  }

  animProgressBar.style.width=(progress*100).toFixed(1)+'%';
  if(progress<1){animFrameId=requestAnimationFrame(animLoop);}
  else{
    /* flush any stragglers */
    while(st.contourIdx<contours.length){const c=contours[st.contourIdx];animCtx.beginPath();animCtx.moveTo(c[0].x,c[0].y);for(let i=1;i<c.length;i++)animCtx.lineTo(c[i].x,c[i].y);animCtx.stroke();st.contourIdx++;}
    animFrameId=null;playBtn.hidden=false;pauseBtn.hidden=true;animProgressBar.style.width='100%';
  }
}

/* ── Record + Export (WebM video via MediaRecorder, then GIF via video-seek) ── */
exportBtn.addEventListener('click', recordAndExport);
let recordedBlob=null, isRecording=false;

function gifWorkerPath(){
  const s=Array.from(document.scripts).find(s=>s.src.includes('gif.js'));
  if(s)return s.src.replace('gif.js','gif.worker.js');
  return location.href.replace(/\/[^/]*$/,'/')+'/libs/gif.worker.js';
}
function dlBlob(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),8e3);}

async function recordAndExport(){
  if(isRecording||gifEncoding)return;
  if(!sketchImageData)return;
  // If no contours yet, prepare animation first
  if(contours.length===0){
    await prepareAnimation(); // this also starts the animation
    // hook into the running animation
    attachRecorder();
    return;
  }
  // Replay from scratch with recording
  cancelAnim();
  animCtx.fillStyle='#fff';animCtx.fillRect(0,0,animCanvas.width,animCanvas.height);
  setupPencil(animCtx);
  animState={durationMs:getDurationMs(),contourIdx:0,pointIdx:0,drawnDist:0,startTime:null,pausedAt:null};
  playBtn.hidden=true;pauseBtn.hidden=false;animProgressBar.style.width='0%';
  attachRecorder();
  animFrameId=requestAnimationFrame(animLoop);
}

function attachRecorder(){
  if(!animCanvas.captureStream){alert('Your browser does not support canvas recording.');return;}
  const mimeType=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'video/webm';
  const stream=animCanvas.captureStream(60);
  const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:10000000});
  const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
  isRecording=true;
  exportBtn.disabled=true;
  gifProgress.hidden=false;gifProgressBar.style.width='0%';
  gifProgressLabel.textContent='Recording animation…';
  recorder.start(50);
  // Stop recorder when animation finishes — poll animFrameId
  const watchId=setInterval(()=>{
    if(animFrameId===null&&isRecording){
      clearInterval(watchId);
      recorder.stop();
    }
  },200);
  recorder.onstop=async()=>{
    isRecording=false;
    recordedBlob=new Blob(chunks,{type:mimeType});
    gifProgressLabel.textContent='Video downloaded! Converting to GIF…';
    dlBlob(recordedBlob,'pic2sketch_anim.webm');
    await new Promise(r=>setTimeout(r,500));
    // Now convert video → GIF
    await videoToGif(recordedBlob);
    exportBtn.disabled=false;
  };
}

async function videoToGif(videoBlob){
  gifEncoding=true;
  gifProgressBar.style.width='0%';
  gifProgressLabel.textContent='Preparing GIF from video…';

  const video=document.createElement('video');
  video.muted=true;video.playsInline=true;
  video.src=URL.createObjectURL(videoBlob);
  await new Promise(r=>{video.onloadedmetadata=r;video.onerror=r;});

  const duration=video.duration||getDurationMs()/1000;
  const GIF_FPS=25;
  const maxFrames=Math.min(300,Math.ceil(duration*GIF_FPS));
  const delay=Math.round(1000/GIF_FPS);

  const sw=animCanvas.width,sh=animCanvas.height;
  const outScale=Math.min(1,640/Math.max(sw,sh));
  const gw=Math.round(sw*outScale),gh=Math.round(sh*outScale);

  const fc=document.createElement('canvas');fc.width=gw;fc.height=gh;
  const fx=fc.getContext('2d');
  fx.imageSmoothingEnabled=true;fx.imageSmoothingQuality='high';

  const gif=new GIF({workers:4,quality:2,width:gw,height:gh,workerScript:gifWorkerPath()});

  for(let f=0;f<maxFrames;f++){
    const t=(f/(maxFrames-1))*duration;
    video.currentTime=t;
    await new Promise(r=>{video.onseeked=r;video.onerror=r;});
    fx.drawImage(video,0,0,gw,gh);
    gif.addFrame(fc,{copy:true,delay});
    const pct=Math.round((f+1)/maxFrames*50);
    gifProgressBar.style.width=pct+'%';
    gifProgressLabel.textContent=`Capturing frames… ${pct}%`;
    if(f%5===0)await nf(); // keep UI responsive
  }

  URL.revokeObjectURL(video.src);
  gif.on('progress',p=>{
    gifProgressBar.style.width=(50+Math.round(p*50))+'%';
    gifProgressLabel.textContent=`Encoding GIF… ${50+Math.round(p*50)}%`;
  });
  gif.on('finished',blob=>{
    gifEncoding=false;
    gifProgressBar.style.width='100%';
    gifProgressLabel.textContent='All done! Both files downloaded ✓';
    dlBlob(blob,'pic2sketch_anim.gif');
    setTimeout(()=>{gifProgress.hidden=true;},2500);
  });
  gif.render();
}

function nf(){return new Promise(r=>requestAnimationFrame(r));}
