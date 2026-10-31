const $=id=>document.getElementById(id);
let generation=0,pdf=null,loadingTask=null,renderTask=null,reader=null,observer=null,pumping=false,wantedPage=null,currentPage=0,selected=new Set(),visible=new Set(),pendingThumbs=new Set(),failedThumbs=new Set();
const thumbCanvases=new Map();
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
 ++generation;cancelRender();observer?.disconnect();observer=null;
 const oldTask=loadingTask;loadingTask=null;pdf=null;wantedPage=null;currentPage=0;
 selected.clear();visible.clear();pendingThumbs.clear();failedThumbs.clear();
 for(const c of thumbCanvases.values())release(c);thumbCanvases.clear();
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
 await close();const epoch=generation,start=performance.now();
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
 const fragment=document.createDocumentFragment();
 for(let number=1;number<=pdf.numPages;number++){
  const label=document.createElement('label');label.className='thumbnail';label.dataset.page=number;
  const image=document.createElement('div');image.className='thumb-image';image.id='thumb-'+number;image.innerHTML='<span>Waiting for preview</span>';
  const caption=document.createElement('span');caption.className='caption';const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label','Page '+number);
  input.onchange=()=>{input.checked?selected.add(number):selected.delete(number);selection();};
  caption.append(input,document.createTextNode('Page '+number));label.append(image,caption);fragment.append(label);
 }
 $('thumbnails').append(fragment);
 observer=new IntersectionObserver(entries=>{
  if(!isCurrent(epoch))return;
  for(const entry of entries){const number=Number(entry.target.dataset.page);if(entry.isIntersecting){visible.add(number);if(!thumbCanvases.has(number)&&!failedThumbs.has(number))pendingThumbs.add(number);}else{visible.delete(number);pendingThumbs.delete(number);const c=thumbCanvases.get(number);if(c){release(c);thumbCanvases.delete(number);$('thumb-'+number).innerHTML='<span>Waiting for preview</span>';}}}
  void pump();
 },{root:$('thumbnails'),rootMargin:'120px'});
 for(const label of $('thumbnails').children)observer.observe(label);
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
   try{
    const canvas=await render(number,!full,epoch);if(!canvas)continue;
    if(full){if(wantedPage!==null){release(canvas);continue;}for(const c of $('page-host').querySelectorAll('canvas'))release(c);canvas.setAttribute('aria-label','PDF page '+number);$('page-host').replaceChildren(canvas);currentPage=number;$('page-label').textContent='Page '+number+' / '+pdf.numPages;pageStatus('Page '+number+' displayed · '+canvas.width+' × '+canvas.height+' pixels · 300 dpi');selection();}
    else if(visible.has(number)){thumbCanvases.set(number,canvas);$('thumb-'+number).replaceChildren(canvas);}else release(canvas);
   }catch(error){if(!isCurrent(epoch))continue;if(error.name==='RenderingCancelledException'){if(!full&&visible.has(number))pendingThumbs.add(number);continue;}if(full)pageStatus('Unable to display page '+number+': '+error.message,true);else{failedThumbs.add(number);$('thumb-'+number).innerHTML='<span>Preview unavailable. You can still select this page.</span>';}}
   finally{if(full&&isCurrent(epoch))$('cancel').hidden=true;}
  }
 }finally{pumping=false;if(pdf&&(wantedPage!==null||pendingThumbs.size))void pump();}
}
function show(number){if(!pdf||!number)return;wantedPage=number;cancelRender();void pump();}
$('pdf-file').onchange=()=>{const file=$('pdf-file').files?.[0];if(file)void open(file);};
$('clear').onclick=async()=>{await close();status('PDF closed. Choose another PDF.');details('No PDF loaded.');};
$('clear-selection').onclick=()=>{selected.clear();for(const input of $('thumbnails').querySelectorAll('input'))input.checked=false;selection();};
$('show').onclick=()=>show([...selected].sort((a,b)=>a-b)[0]);
for(const [id,offset]of [['previous',-1],['next',1]])$(id).onclick=()=>{const pages=[...selected].sort((a,b)=>a-b);show(pages[pages.indexOf(currentPage)+offset]);};
$('cancel').onclick=()=>{wantedPage=null;cancelRender();pageStatus('Page display cancelled. Select a page to retry.');};
$('sample').onclick=async()=>{try{const response=await fetch('./sample.pdf');if(!response.ok)throw Error('Sample PDF unavailable.');await open(new File([await response.blob()],'sample.pdf',{type:'application/pdf'}));}catch(e){status(e.message,true);}};
