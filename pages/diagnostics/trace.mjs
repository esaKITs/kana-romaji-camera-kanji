// This page observes the unchanged app in a same-origin frame. It stores only
// execution metadata locally, never PDF/image bytes or recognized text.
const $=id=>document.getElementById(id),frame=$('app'),key='romaji-pdf-diagnostic-v1';
const ring=(list,value,limit=48)=>{list.push(value);if(list.length>limit)list.splice(0,list.length-limit);};
let previous=null;try{previous=JSON.parse(sessionStorage.getItem(key));}catch{}
let trace={schema:'romaji-pdf-diagnostic-v1',startedAt:new Date().toISOString(),environment:{userAgent:navigator.userAgent,devicePixelRatio:devicePixelRatio},loads:[],events:[],worker:{calls:0,maximumPixels:0,lastFrames:[]},pixelReads:{calls:0,maximumPixels:0,lastLargeReads:[]},errors:[],complete:false};
let downloadUrl=null,saveTimer=null,latestStatus='';
function persist(){try{sessionStorage.setItem(key,JSON.stringify(trace));}catch{}}
function event(type,data={}){ring(trace.events,{ms:Math.round(performance.now()),type,...data});persist();$('save-trace').disabled=false;}
function summary(){return{loaded:trace.loads.at(-1),worker:trace.worker,pixelReads:trace.pixelReads,errors:trace.errors,complete:trace.complete};}
function update(){ $('trace-summary').textContent=JSON.stringify(summary(),null,2); }
function failure(error,where){const e={where,name:error?.name||'Error',message:error?.message||String(error),stack:error?.stack||null};ring(trace.errors,e,12);event('failure',e);$('trace-status').textContent=e.message;$('trace-details').open=true;update();}
function download(report){clearTimeout(saveTimer);if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=downloadUrl;a.download='romaji-pdf-diagnostic.json';a.click();saveTimer=setTimeout(()=>URL.revokeObjectURL(downloadUrl),60000);}
if(previous){$('trace-status').textContent='A previous diagnostic run is available. Choose an image or PDF below to start a new run.';$('save-previous').hidden=false;$('save-previous').onclick=()=>download(previous);}
$('save-trace').onclick=()=>download(trace);
frame.onload=()=>{
 const win=frame.contentWindow,doc=win.document;
 const load={url:win.location.href,title:doc.title,scripts:[...doc.querySelectorAll('script[src]')].map(s=>s.src)};
 ring(trace.loads,load,8);event('app-loaded',load);$('trace-status').textContent=doc.title+' · Ready. Choose the PDF below.';
 const observeStatus=()=>{const scan=doc.getElementById('scan-label')?.textContent||'',documentStatus=doc.getElementById('document-status')?.textContent||'',status=scan+' | '+documentStatus;if(status===latestStatus)return;latestStatus=status;trace.current={scan,documentStatus,dpi:doc.getElementById('pdf-dpi')?.value,canvas:{width:doc.getElementById('output')?.width,height:doc.getElementById('output')?.height}};event('status',trace.current);$('trace-status').textContent=doc.title+' · '+scan;
  if(/Unable to read:|exceeds maxInputPixels|not converted|failed|timed out|out of memory/i.test(status))failure({message:status},'app-status');
  if(/^Still · \d+ shown/.test(scan)){trace.complete=true;event('conversion-complete',trace.current);update();}
 };
 new win.MutationObserver(observeStatus).observe(doc.body,{childList:true,subtree:true,characterData:true});observeStatus();
 const read=win.CanvasRenderingContext2D.prototype.getImageData;
 win.CanvasRenderingContext2D.prototype.getImageData=function(x,y,width,height,...rest){
  trace.pixelReads.calls++;trace.pixelReads.maximumPixels=Math.max(trace.pixelReads.maximumPixels,width*height);
  if(width*height>4000000){ring(trace.pixelReads.lastLargeReads,{x,y,width,height,stack:new win.Error().stack},8);event('large-pixel-read',{x,y,width,height});}
  try{return read.call(this,x,y,width,height,...rest);}catch(error){failure(error,'canvas-read');throw error;}
 };
 const post=win.Worker.prototype.postMessage;
 win.Worker.prototype.postMessage=function(message,...rest){
  if(message?.type==='init'&&message.maxInputPixels)event('worker-init',{maxInputPixels:message.maxInputPixels,profile:message.profile});
  if(message?.type==='scan'&&message.frame){const f=message.frame,meta={id:f.frameId,width:f.width,height:f.height,regions:f.regions||null};trace.worker.calls++;trace.worker.maximumPixels=Math.max(trace.worker.maximumPixels,f.width*f.height);ring(trace.worker.lastFrames,meta);event('worker-scan',meta);}
  try{return post.call(this,message,...rest);}catch(error){failure(error,'worker-send');throw error;}
 };
 win.addEventListener('error',e=>failure(e.error||{message:e.message},'window-error'));
 win.addEventListener('unhandledrejection',e=>failure(e.reason,'unhandled-rejection'));
 doc.addEventListener('change',e=>{if(e.target?.id==='image'){trace.complete=false;event('input-selected',{bytes:e.target.files?.[0]?.size,type:e.target.files?.[0]?.type});}},true);
 doc.addEventListener('click',e=>{if(['pdf-convert','retry','sample','sample-pdf'].includes(e.target?.closest('button')?.id)){trace.complete=false;event('operation-started',{button:e.target.closest('button').id});}},true);
 update();
};
const appUrl=new URL('../',location.href);appUrl.searchParams.set('diagnostic-run',Date.now().toString());frame.src=appUrl.href;
