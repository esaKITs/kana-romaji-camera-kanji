import{initialize,runStill,dispose,analyzeText}from'../still-prototype/ocr-entry.mjs';
import{analyzeSnapshot,renderResult}from'../still-prototype/pipeline.mjs';
import{CameraSession}from'./session.mjs';
import{fingerprint,LiveMotionGuard}from'./motion.mjs';
import{AdaptivePapers}from'../still-prototype/paper.mjs';
import{paintLabels,sourceLevels}from'./paint.mjs';
import{bindStillZoom}from'./zoom.mjs';
import{bindFocusSelection}from'./focus-scan.mjs';
import{assetUrl}from'./asset-url.mjs';
const ppocrMode=new URLSearchParams(location.search).get('ocr')==='ppocr';
const $=id=>document.getElementById(id),session=new CameraSession(),modes=['あア漢','ア漢','漢'];
const paperState=new AdaptivePapers();
const stillZoom=bindStillZoom($('zoom-layer'),()=>session.source);
const focus=bindFocusSelection($('zoom-layer'),$('output'),rect=>{void focusScan(rect);});
const motion=new LiveMotionGuard(),motionCanvas=document.createElement('canvas');motionCanvas.width=96;motionCanvas.height=64;const motionContext=motionCanvas.getContext('2d',{willReadFrequently:true});let motionTimer=null,paintedFrame=false;
let mode='あア漢',style='double',guides=false,stream=null,ready=null,pending=false,timer=null,cache=null,lastFrame=null,torch=false,opening=0,reveal=0,lastPaint=null;
try{const settings=JSON.parse(localStorage.getItem('kanahan-camera-settings-v1'));if(modes.includes(settings?.mode))mode=settings.mode;if(settings?.style==='macron')style='macron';if(sourceLevels.includes(settings?.reveal))reveal=settings.reveal;}catch{}
function settings(){ $('source-level').textContent='◐ '+reveal+'%';$('source-level').setAttribute('aria-label','Original image visibility: '+reveal+'%. Change visibility');try{localStorage.setItem('kanahan-camera-settings-v1',JSON.stringify({mode,style,reveal}));}catch{}$('kana-mode').textContent=mode;$('kana-mode').setAttribute('aria-label','Reading mode: '+mode);$('long-vowels').textContent=style==='double'?'aa':'ā';$('long-vowels').setAttribute('aria-pressed',String(style==='macron'));$('long-vowels').setAttribute('aria-label','Long vowels: '+(style==='double'?'aa. Switch to ā':'ā. Switch to aa'));}
settings();
$('ocr-engine').textContent=ppocrMode?'OCR: PP-v6':'OCR: Meiki';
$('ocr-engine').setAttribute('aria-label',ppocrMode?'OCR engine: PP-OCRv6 manga. Switch to MeikiOCR':'OCR engine: MeikiOCR. Switch to PP-OCRv6 manga');
$('ocr-engine').onclick=()=>{const url=new URL(location.href);if(ppocrMode)url.searchParams.delete('ocr');else url.searchParams.set('ocr','ppocr');location.assign(url.href);};
function message(text,loading=false){$('status').textContent=text;$('scan-label').textContent=text;$('progress').textContent=text;$('progress').hidden=!loading;}
function screen(){const active=session.kind!=='home',still=session.kind==='still';document.body.classList.toggle('camera-active',active);document.body.classList.toggle('camera-still',still);$('stage').hidden=!active;$('stop').hidden=!active;$('capture-controls').hidden=!active||still;$('live-return').hidden=!still;$('retry').hidden=!still;$('scan').disabled=session.kind!=='live';if(!active)$('progress').hidden=true;stillZoom.setActive(still);if(!still){focus.enable(false);$('focus-scan').setAttribute('aria-pressed','false');}$('focus-scan').hidden=!still||ppocrMode;}
function stopStream(){stopMotion();clearTimeout(timer);timer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;torch=false;$('torch').hidden=true;$('torch').setAttribute('aria-pressed','false');}
function clearLayer(){lastPaint=null;paintedFrame=false;for(const id of ['output','guides']){const c=$(id);c.getContext('2d').clearRect(0,0,c.width,c.height);}}
function home(){paperState.reset();opening++;session.enter('home');pending=false;stopStream();cache=null;lastFrame=null;clearLayer();screen();message('Horizontal printed Japanese · development preview');}
async function engines(){if(!ready){message('Loading OCR and reading data…',true);ready=initialize('kuromoji').catch(error=>{ready=null;throw error;});}await ready;}
function drawGuides(result){const c=$('guides');c.width=$('output').width;c.height=$('output').height;const x=c.getContext('2d');if(!guides||!result)return;x.lineWidth=2;for(const l of result.labels){x.strokeStyle=lastPaint?.layout.drawn.some(d=>d.lineId===l.lineId&&d.source===l.source&&d.box.x0===l.box.x0)?'#37d78d':'#ffbf47';const b=l.box;x.strokeRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);}}
function showResult(layout,source,kind){lastPaint={layout,source,kind};paintLabels($('output'),source,layout,{still:kind==='still',reveal});}
function capture(){const video=$('video');if(!video.videoWidth)throw Error('The camera has no frame yet.');const s=Math.min(1,1200/Math.max(video.videoWidth,video.videoHeight)),c=document.createElement('canvas');c.width=Math.round(video.videoWidth*s);c.height=Math.round(video.videoHeight*s);c.getContext('2d').drawImage(video,0,0,c.width,c.height);return c;}
function videoSignature(source=$('video')){motionContext.drawImage(source,0,0,96,64);return fingerprint(motionContext.getImageData(0,0,96,64).data);}
function stopMotion(){clearTimeout(motionTimer);motionTimer=null;motion.reset();}
function watchMotion(){
 clearTimeout(motionTimer);if(session.kind!=='live'||document.hidden)return;
 if($('video').videoWidth){try{const moved=motion.observe(videoSignature(),performance.now());if(moved&&paintedFrame){paperState.reset();clearLayer();lastFrame=null;message('Live · hold steady');}}catch{clearLayer();lastFrame=null;}}
 motionTimer=setTimeout(watchMotion,150);
}
async function processScene(){
 pending=true;if(session.busy||session.kind==='home')return;pending=false;
 const generation=session.generation,kind=session.kind,requestedMode=mode,requestedStyle=style;
 await session.exclusive(async()=>{try{
  let source=kind==='still'?session.source:capture();if(!source)return;
  if(kind==='still'){renderSource(source);message('Preparing Still…',true);}
  await engines();if(!session.owns(generation))return;
  let capturedSignature=null,captureEpoch=null;
  if(kind==='live'){source=capture();capturedSignature=videoSignature(source);motion.observe(capturedSignature,performance.now());if(!motion.stable(performance.now())){message('Live · hold steady');return;}captureEpoch=motion.epoch;}
  message(kind==='live'?'Live · reading…':'Still · reading…',kind==='still');
  const temporary=document.createElement('canvas');let result;
  if(kind==='still'&&cache?.source===source){const previous=cache.value;const analyzed=await analyzeSnapshot(previous.snapshot,analyzeText,{mode:requestedMode,style:requestedStyle,source,verifyRuby:c=>{const pair=previous.result.pairs.find(p=>p.lineId===c.lineId&&p.start===c.start&&p.end===c.end);return pair?{reading:pair.reading,method:'cached-'+(pair.verification||'verified-ruby')}:null;}});result={...previous,result:analyzed,rendering:renderResult(temporary,source,analyzed,{paperState})};}
  else result=await runStill(source,{mode:requestedMode,style:requestedStyle,output:temporary,paperState});
  if(!session.owns(generation))return;
  if(kind==='live'&&!motion.accepts(capturedSignature,videoSignature(),captureEpoch,performance.now())){clearLayer();lastFrame=null;message('Live · hold steady');return;}
  if(kind==='still'){cache={source,value:result};showResult(result.rendering,source,kind);}else{showResult(result.rendering,source,kind);paintedFrame=true;motion.painted(capturedSignature);}
  if(window.stillLab)window.stillLab.lastRun=result;
  lastFrame=result.result;drawGuides(lastFrame);message(kind==='live'?(result.rendering.drawn.length?'Live · '+result.rendering.drawn.length+' labels':'Live · looking for text'):'Still · '+result.rendering.drawn.length+' shown'+(result.rendering.omitted?.length?' · '+result.rendering.omitted.length+' not fitted':''));
 }catch(error){if(session.owns(generation)){message('Unable to read: '+error.message,false);clearLayer();if(kind==='still'&&session.source)renderSource(session.source);}}});
 if(pending&&session.kind!=='home')queueMicrotask(processScene);
}
async function focusScan(rect){
 if(ppocrMode){message('Focus is unavailable with PP-OCR whole-image mode');return;}
 if(session.kind!=='still'||session.busy||!cache?.value?.snapshot){message('Wait for Still recognition to finish.');return;}
 const generation=session.generation,source=session.source,previous=cache.value;
 const pad=Math.max(8,Math.round(Math.min(rect[2]-rect[0],rect[3]-rect[1])*.12));
 const box=[Math.max(0,rect[0]-pad),Math.max(0,rect[1]-pad),Math.min(source.width,rect[2]+pad),Math.min(source.height,rect[3]+pad)];
 await session.exclusive(async()=>{try{
  message('Focus · rereading selection…',true);
  const regional=await window.stillLab.scanFocused(source,box);if(!session.owns(generation))return;
  const centerIn=(b,r)=>{const x=(b[0]+b[2])/2,y=(b[1]+b[3])/2;return x>=r[0]&&x<=r[2]&&y>=r[1]&&y<=r[3];};
  const old=previous.snapshot;
  const confidence=l=>{const gs=(l.glyphs||[]).filter(g=>/[ぁ-んァ-ヶ一-龯]/u.test(g.text||''));return gs.length?gs.reduce((s,g)=>s+Math.max(0,Math.min(1,Number(g.confidence)||0)),0)/gs.length:0;};
  const overlaps=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]))>0;
  const accepted=(regional.lines||[]).filter(l=>centerIn(l.box,rect)&&confidence(l)>=.65&&!old.lines.some(p=>overlaps(p.box,l.box)&&p.text!==l.text&&confidence(p)>=confidence(l)-.04));
  if(!accepted.length){message('Focus · no reliable improvement; original labels kept');return;}
  const retained=old.lines.filter(l=>!accepted.some(a=>overlaps(l.box,a.box)));
  const snapshot={...old,lines:[...retained,...accepted]};
  const analyzed=await analyzeSnapshot(snapshot,analyzeText,{mode,style,source});if(!session.owns(generation))return;
  const temporary=document.createElement('canvas'),rendering=renderResult(temporary,source,analyzed,{paperState});
  if(rendering.drawn.length<previous.rendering.drawn.length){message('Focus · no verified improvement; original labels kept');return;}
  const value={...previous,snapshot,result:analyzed,rendering};cache={source,value};showResult(rendering,source,'still');lastFrame=analyzed;drawGuides(analyzed);
  message('Focus · '+accepted.length+' region(s) reread · '+rendering.drawn.length+' shown'+(rendering.omitted?.length?' · '+rendering.omitted.length+' not fitted':''));
 }catch(error){if(session.owns(generation))message('Focus scan failed: '+error.message);}});
}
$('focus-scan').onclick=()=>{const enabled=!focus.enabled;focus.enable(enabled);$('focus-scan').setAttribute('aria-pressed',String(enabled));$('focus-scan').textContent=enabled?'✓ Focus':'◎ Focus';message(enabled?'Focus · drag a rectangle over text':'Still · focus off');};
function renderSource(source){const c=$('output');c.width=source.width;c.height=source.height;c.getContext('2d').drawImage(source,0,0);$('guides').getContext('2d').clearRect(0,0,$('guides').width,$('guides').height);}
function tick(){clearTimeout(timer);if(session.kind!=='live')return;if(!document.hidden&&!session.busy)void processScene();timer=setTimeout(tick,1800);}
async function start(){if(stream||session.kind==='live')return;const request=++opening;$('start').disabled=true;try{message('Opening camera…');const opened=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});if(request!==opening){opened.getTracks().forEach(t=>t.stop());return;}stream=opened;$('video').srcObject=stream;await $('video').play();if(request!==opening){stopStream();return;}cache=null;session.enter('live');clearLayer();screen();const track=stream.getVideoTracks()[0],cap=track?.getCapabilities?.();$('torch').hidden=!cap?.torch;$('torch').disabled=!cap?.torch;paperState.reset();stopMotion();watchMotion();tick();}catch(error){if(request===opening){stopStream();message('Unable to start camera: '+error.message);}}finally{$('start').disabled=false;}}
function still(source){stillZoom.reset();paperState.reset();stopMotion();session.enter('still',source);cache=null;clearTimeout(timer);if(torch){stream?.getVideoTracks()[0]?.applyConstraints({advanced:[{torch:false}]}).catch(()=>{});torch=false;$('torch').setAttribute('aria-pressed','false');}screen();renderSource(source);void processScene();}
$('start').onclick=start;$('stop').onclick=home;$('scan').onclick=()=>{try{still(capture());}catch(error){message(error.message);}};
$('live-return').onclick=()=>{if(stream){session.enter('live');cache=null;clearLayer();screen();paperState.reset();stopMotion();watchMotion();tick();}else home();};
$('retry').onclick=()=>{if(session.kind==='still'){cache=null;session.enter('still',session.source);void processScene();}};
for(const id of ['choose','choose-home'])$(id).onclick=()=>$('image').click();
$('image').onchange=async()=>{const file=$('image').files[0];$('image').value='';if(!file)return;const request=++opening;try{const bitmap=await createImageBitmap(file);if(request!==opening){bitmap.close();return;}const s=Math.min(1,2000/Math.max(bitmap.width,bitmap.height)),c=document.createElement('canvas');c.width=Math.round(bitmap.width*s);c.height=Math.round(bitmap.height*s);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();stopStream();still(c);}catch(error){message(error.message);}};
$('sample').onclick=async()=>{const request=++opening;$('sample').disabled=true;try{const img=new Image();img.src=assetUrl('fixtures/numeric.png');await img.decode();if(request!==opening)return;const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);stopStream();still(c);}catch(error){message(error.message);}finally{$('sample').disabled=false;}};
function changed(){settings();if(session.kind!=='home'){session.enter(session.kind,session.source);clearLayer();void processScene();}}
$('kana-mode').onclick=()=>{mode=modes[(modes.indexOf(mode)+1)%modes.length];changed();};$('long-vowels').onclick=()=>{style=style==='double'?'macron':'double';changed();};
$('debug').onclick=()=>{guides=!guides;$('debug').setAttribute('aria-pressed',String(guides));drawGuides(lastFrame);};
$('source-level').onclick=()=>{reveal=sourceLevels[(sourceLevels.indexOf(reveal)+1)%sourceLevels.length];settings();if(lastPaint)showResult(lastPaint.layout,lastPaint.source,lastPaint.kind);};
function viewportChanged(){stillZoom.resize();if(session.kind==='live'){session.enter('live');clearLayer();stopMotion();watchMotion();tick();}}
window.addEventListener('resize',()=>stillZoom.resize());window.addEventListener('orientationchange',viewportChanged);$('video').addEventListener('resize',viewportChanged);
$('torch').onclick=async()=>{try{const track=stream?.getVideoTracks()[0];if(!track)return;await track.applyConstraints({advanced:[{torch:!torch}]});torch=!torch;$('torch').setAttribute('aria-pressed',String(torch));}catch{message('Flash is unavailable on this camera.');}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMotion();clearTimeout(timer);if(session.kind==='live'){session.enter('live');clearLayer();}}else if(session.kind==='live'){watchMotion();tick();}});
window.addEventListener('pagehide',()=>{home();void dispose();ready=null;});screen();
