const $=id=>document.getElementById(id);
let generation=0,pdf=null,loadingTask=null,renderTask=null,reader=null,observer=null,pumping=false,wantedPage=null,currentPage=0,selected=new Set(),visible=new Set(),pendingThumbs=new Set(),failedThumbs=new Set();
const mobileLayout=matchMedia('(max-width: 650px), (pointer: coarse) and (max-width: 1024px)');
const thumbnails=new Map(),thumbnailBudget=8*1024*1024;
let thumbnailBytes=0,groupStart=0,galleryRevision=0;
const release=canvas=>{if(canvas)canvas.width=canvas.height=0;};
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=error;}
function pageStatus(text,error=false){$('page-status').textContent=text;$('page-status').dataset.error=error;}
function details(text){$('details').textContent=text;}
const isCurrent=epoch=>epoch===generation;
async function deadline(promise,label,ms=60000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out. Close the PDF and retry.')),ms);})]);}finally{clearTimeout(timer);}}
function selection(){
 const pages=[...selected].sort((a,b)=>a-b),index=pages.indexOf(currentPage);
 $('selected-count').textContent=pages.length+' page'+(pages.length===1?'':'s')+' selected';
 $('show').disabled=!pages.length||!pdf;$('previous').disabled=index<=0;$('next').disabled=index<0||index>=pages.length-1;
}
function cancelRender(){renderTask?.cancel();}
async function close(){
 ++generation;++galleryRevision;cancelRender();observer?.disconnect();observer=null;groupStart=0;
 const oldTask=loadingTask;loadingTask=null;pdf=null;wantedPage=null;currentPage=0;
 selected.clear();visible.clear();pendingThumbs.clear();failedThumbs.clear();
 for(const item of thumbnails.values())URL.revokeObjectURL(item.url);thumbnails.clear();thumbnailBytes=0;
 for(const c of $('page-host').querySelectorAll('canvas'))release(c);
 $('page-host').replaceChildren();$('thumbnails').replaceChildren();$('document').hidden=true;$('clear').disabled=true;$('cancel').hidden=true;
 $('page-label').textContent='Select a page';pageStatus('');selection();
 try{await oldTask?.destroy();}catch{}
}
async function pdfReader(){
 if(!reader)reader=import('./vendor/pdf.mjs').then(api=>{api.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;return api;}).catch(e=>{reader=null;throw e;});
 return reader;
}
async function open(file){
 const openingEpoch=generation+1;await close();if(!isCurrent(openingEpoch))return;const epoch=openingEpoch,start=performance.now();
 status('Reading PDF file…');$('clear').disabled=false;details('File read started: '+file.size.toLocaleString()+' bytes.');
 try{
  // Finish reading the File before clearing the input or importing the PDF library.
  const buffer=await deadline(file.arrayBuffer(),'File read');if(!isCurrent(epoch))return;
  $('pdf-file').value='';status('Opening PDF…');details('File read completed. Opening PDF.');
  const api=await pdfReader();if(!isCurrent(epoch))return;
  loadingTask=api.getDocument({data:new Uint8Array(buffer),cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/wasm/',import.meta.url).href,iccUrl:new URL('./vendor/iccs/',import.meta.url).href,isEvalSupported:false});
  const opened=await deadline(loadingTask.promise,'PDF open');if(!isCurrent(epoch))return;pdf=opened;
  $('filename').textContent=file.name+' · '+pdf.numPages+' pages';$('document').hidden=false;$('clear').disabled=false;
  details('File read and PDF open completed in '+((performance.now()-start)/1000).toFixed(1)+' s.\n'+pdf.numPages+' pages · page preview: 300 dpi · sequential rendering.');
  buildThumbnails(epoch);status('PDF opened. Select pages from the thumbnails.');
 }catch(error){if(isCurrent(epoch)){await close();status('Unable to open PDF: '+error.message,true);details('Failed during file read or PDF open: '+error.name+' · '+error.message);}}
}
function buildThumbnails(epoch){
 const revision=++galleryRevision,mobile=mobileLayout.matches;
 observer?.disconnect();observer=null;visible.clear();pendingThumbs.clear();$('thumbnails').replaceChildren();
 $('thumb-pagination').hidden=!mobile;
 const first=mobile?groupStart+1:1,last=mobile?Math.min(pdf.numPages,groupStart+4):pdf.numPages;
 $('thumb-range').textContent='Pages '+first+'–'+last+' / '+pdf.numPages;
 $('thumb-previous').disabled=groupStart===0;$('thumb-next').disabled=last>=pdf.numPages;
 const fragment=document.createDocumentFragment();
 for(let number=first;number<=last;number++){
  const label=document.createElement('label');label.className='thumbnail';label.dataset.page=number;
  const image=document.createElement('div');image.className='thumb-image';image.id='thumb-'+number;image.innerHTML='<span>Waiting for preview</span>';
  const caption=document.createElement('span');caption.className='caption';const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(number);input.setAttribute('aria-label','Page '+number);
  input.onchange=()=>{input.checked?selected.add(number):selected.delete(number);selection();};
  caption.append(input,document.createTextNode('Page '+number));label.append(image,caption);fragment.append(label);
 }
 $('thumbnails').append(fragment);
 if(mobile){
  for(let number=first;number<=last;number++){visible.add(number);if(thumbnails.has(number))showThumbnail(number);else if(!failedThumbs.has(number))pendingThumbs.add(number);}
  trimThumbnails();selection();void pump();return;
 }
 observer=new IntersectionObserver(entries=>{
  if(!isCurrent(epoch)||revision!==galleryRevision)return;
  for(const entry of entries){const number=Number(entry.target.dataset.page);if(entry.isIntersecting){visible.add(number);if(thumbnails.has(number))showThumbnail(number);else if(!failedThumbs.has(number))pendingThumbs.add(number);}else{visible.delete(number);pendingThumbs.delete(number);const host=$('thumb-'+number);if(host)host.innerHTML='<span>Waiting for preview</span>';}}
  trimThumbnails();void pump();
 },{root:$('thumbnails'),rootMargin:'120px'});
 for(const label of $('thumbnails').children)observer.observe(label);
 selection();
}
function showThumbnail(number){
 const item=thumbnails.get(number),host=$('thumb-'+number);if(!item||!host||!visible.has(number))return;
 if(host.firstElementChild?.tagName==='IMG')return;
 const image=new Image();image.alt='Preview of page '+number;image.decoding='async';image.width=item.width;image.height=item.height;image.src=item.url;host.replaceChildren(image);
}
function trimThumbnails(){
 for(const [number,item]of thumbnails){if(thumbnailBytes<=thumbnailBudget)break;if(visible.has(number))continue;URL.revokeObjectURL(item.url);thumbnailBytes-=item.bytes;thumbnails.delete(number);}
}
async function render(number,thumbnail,epoch){
 const owner=pdf;let page,canvas,task;
 try{
  page=await deadline(owner.getPage(number),'Page fetch');if(!isCurrent(epoch))return null;
  const base=page.getViewport({scale:1});const viewport=page.getViewport({scale:thumbnail?140/base.width:300/72});
  const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
  if(width*height>16000000||width>16384||height>16384)throw Error('This page exceeds the 300 dpi preview limit.');
  canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  task=page.render({canvas,viewport,background:'#ffffff'});renderTask=task;
  let timer;
  try{await Promise.race([task.promise,new Promise((_,reject)=>{timer=setTimeout(()=>{task.cancel();reject(Error('Page rendering timed out. Please retry or choose another page.'));},45000);})]);}finally{clearTimeout(timer);}
  if(!isCurrent(epoch)){release(canvas);return null;}
  return canvas;
 }catch(error){release(canvas);throw error;}
 finally{if(renderTask===task)renderTask=null;try{page?.cleanup();}catch{}}
}
async function pump(){
 if(pumping||!pdf)return;pumping=true;
 try{
  while(pdf&&(wantedPage!==null||pendingThumbs.size)){
   const epoch=generation,full=wantedPage!==null,number=full?wantedPage:pendingThumbs.values().next().value;
   if(full){wantedPage=null;pageStatus('Rendering page '+number+' at 300 dpi…');$('cancel').hidden=false;}else pendingThumbs.delete(number);
   if(!full&&(!visible.has(number)||thumbnails.has(number))){showThumbnail(number);continue;}
   try{
    const canvas=await render(number,!full,epoch);if(!canvas)continue;
    if(full){if(wantedPage!==null){release(canvas);continue;}for(const c of $('page-host').querySelectorAll('canvas'))release(c);canvas.setAttribute('aria-label','PDF page '+number);$('page-host').replaceChildren(canvas);currentPage=number;$('page-label').textContent='Page '+number+' / '+pdf.numPages;pageStatus('Page '+number+' displayed · '+canvas.width+' × '+canvas.height+' pixels · 300 dpi');selection();}
    else{
     const width=canvas.width,height=canvas.height;let blob;
     try{blob=await deadline(new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Unable to create thumbnail.')),'image/png')),'Thumbnail encoding');}finally{release(canvas);}
     if(!isCurrent(epoch))continue;
     if(!thumbnails.has(number)){thumbnails.set(number,{url:URL.createObjectURL(blob),bytes:blob.size,width,height});thumbnailBytes+=blob.size;}
     pendingThumbs.delete(number);showThumbnail(number);trimThumbnails();
    }
   }catch(error){if(!isCurrent(epoch))continue;if(error.name==='RenderingCancelledException'){if(!full&&visible.has(number))pendingThumbs.add(number);continue;}if(full)pageStatus('Unable to display page '+number+': '+error.message,true);else{failedThumbs.add(number);const host=$('thumb-'+number);if(host)host.innerHTML='<span>Preview unavailable. You can still select this page.</span>';}}
   finally{if(full&&isCurrent(epoch))$('cancel').hidden=true;}
  }
 }finally{pumping=false;if(pdf&&(wantedPage!==null||pendingThumbs.size))void pump();}
}
function show(number){if(!pdf||!number)return;wantedPage=number;cancelRender();void pump();}
for(const [id,offset]of [['thumb-previous',-4],['thumb-next',4]])$(id).onclick=()=>{
 if(!pdf)return;groupStart=Math.max(0,Math.min(Math.floor((pdf.numPages-1)/4)*4,groupStart+offset));buildThumbnails(generation);
};
mobileLayout.addEventListener('change',()=>{if(pdf)buildThumbnails(generation);});
$('pdf-file').onchange=()=>{const file=$('pdf-file').files?.[0];if(file)void open(file);};
$('clear').onclick=async()=>{await close();status('PDF closed. Choose another PDF.');details('No PDF loaded.');};
$('clear-selection').onclick=()=>{selected.clear();for(const input of $('thumbnails').querySelectorAll('input'))input.checked=false;selection();};
$('show').onclick=()=>show([...selected].sort((a,b)=>a-b)[0]);
for(const [id,offset]of [['previous',-1],['next',1]])$(id).onclick=()=>{const pages=[...selected].sort((a,b)=>a-b);show(pages[pages.indexOf(currentPage)+offset]);};
$('cancel').onclick=()=>{wantedPage=null;cancelRender();pageStatus('Page display cancelled. Select a page to retry.');};
$('sample').onclick=async()=>{try{const response=await fetch('./sample.pdf');if(!response.ok)throw Error('Sample PDF unavailable.');await open(new File([await response.blob()],'sample.pdf',{type:'application/pdf'}));}catch(e){status(e.message,true);}};
