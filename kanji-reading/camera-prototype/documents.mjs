import {DocumentState} from './document-state.mjs';
export function exportName(name,page,extension){const base=(name||'kana').replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-');return base+(page?'-page-'+page:'')+'-romaji.'+extension;}
export function bindDocumentControls({document:doc,getCurrent,readPage,renderExport,onBusy=()=>{},invalidate=()=>{}}){
 const $=id=>doc.getElementById(id),state=new DocumentState(),sources=new WeakMap();let busy=false,download=null,heldSource=null;
 const status=text=>{$('document-status').textContent=text;};
 const io=()=>import('./pdf-io.mjs');
 function sync(){
  const c=getCurrent();$('document-tools').hidden=!state.pdf&&!c.still&&!$('document-status').textContent&&!download;$('pdf-navigation').hidden=!state.pdf;$('export-controls').hidden=!c.still;
  $('pdf-position').textContent=state.pdf?(state.current?'Page '+state.current+' / '+state.count:state.name+' · '+state.count+' pages'):'';
  const pages=state.pages(),at=pages.indexOf(state.current);$('pdf-prev').disabled=busy||!pages.length||at<=0;$('pdf-next').disabled=busy||!pages.length||at===pages.length-1;
  $('pdf-pages').disabled=busy;$('pdf-close').disabled=busy;$('save-png').disabled=busy||!c.ready;
  $('save-pdf').disabled=busy||!(state.pdf?state.ready():c.ready);
  $('pdf-convert').disabled=busy||!pages.length;$('pdf-cancel').hidden=!busy;
  for(const id of ['pdf-all','pdf-none','pdf-dpi'])$(id).disabled=busy;
  $('pdf-selected-count').textContent=pages.length+' selected · '+pages.filter(n=>state.records.get(n)?.dpi===state.dpi).length+' converted';
  for(const label of $('pdf-page-list').children||[]){const input=label.querySelector('input');if(input){input.disabled=busy;input.checked=state.selected.has(Number(input.value));label.classList.toggle('converted',state.records.get(Number(input.value))?.dpi===state.dpi);}}
 }
 function cancel(){const wasBusy=busy;state.cancel();if(wasBusy)invalidate();busy=false;onBusy(false);if(wasBusy)status('Cancelled. Completed pages are kept.');sync();}
 function begin(){const epoch=state.cancel();busy=true;onBusy(true);sync();return epoch;}
 function finish(epoch){if(state.owns(epoch)){busy=false;onBusy(false);sync();}}
 const owns=epoch=>{if(!state.owns(epoch))throw new DOMException('Cancelled.','AbortError');};
 function failed(error){if(error.name!=='AbortError')status(error.message||String(error));}
 function remember(source,run){const a=sources.get(source);if(a&&a.pdf===state.pdf){state.current=a.number;state.remember(a.number,run,a.dpi);}sync();}
 async function show(number,epoch){
  owns(epoch);const {renderPdfPage}=await io(),p=await renderPdfPage(state.pdf,number,state.dpi);owns(epoch);
  const old=heldSource;heldSource=p.canvas;sources.set(p.canvas,{pdf:state.pdf,number,dpi:state.dpi,epoch});state.current=number;
  const previous=state.records.get(number);const run=await readPage(p.canvas,previous?.dpi===state.dpi?previous.run:null,()=>state.owns(epoch));owns(epoch);
  if(!run)throw Error('The page was not converted. Please retry.');remember(p.canvas,run);
  if(old&&old!==heldSource)old.width=old.height=0;return run;
 }
 async function go(number){const epoch=begin();try{status('Reading page '+number+'…');await show(number,epoch);status('Page '+number+' converted.');}catch(e){failed(e);}finally{finish(epoch);}}
 function populate(){
  $('pdf-name').textContent=state.name+' · '+state.count+' pages';$('pdf-page-list').replaceChildren();
  for(let n=1;n<=state.count;n++){
   const label=doc.createElement('label'),input=doc.createElement('input');input.type='checkbox';input.value=String(n);input.checked=state.selected.has(n);input.setAttribute('aria-label','Page '+n);input.onchange=()=>{state.select(n,input.checked);sync();};label.append(input,doc.createTextNode(String(n)));$('pdf-page-list').append(label);
  }
  $('pdf-dpi').value=String(state.dpi);sync();
 }
 async function open(file){
  let epoch=begin();let pdf=null;
  try{status('Opening PDF…');const {openPdf}=await io();pdf=await openPdf(file);owns(epoch);
   const old=state.replace(pdf,file.name);epoch=state.epoch;pdf=null;invalidate();if(heldSource){heldSource.width=heldSource.height=0;heldSource=null;}await old?.destroy();populate();status('Select pages, then Convert selected pages.');$('pdf-dialog').showModal();
  }catch(e){await pdf?.destroy();failed(e);}finally{finish(epoch);}
 }
 async function convert(){
  const pages=state.pages();if(!pages.length)return;const epoch=begin();$('pdf-dialog').close();
  try{for(let i=0;i<pages.length;i++){owns(epoch);status('Converting page '+pages[i]+' · '+(i+1)+' / '+pages.length);await show(pages[i],epoch);}status(pages.length+' page(s) converted. PNG saves the displayed page; PDF saves the selection.');}
  catch(e){failed(e);}finally{finish(epoch);}
 }
 async function save(kind){
  const current=getCurrent();if(kind==='png'&&!current.ready)return;const pages=state.pdf?state.pages():[0];if(kind==='pdf'&&state.pdf&&!state.ready())return;
  const epoch=begin();
  try{
   const {pngBlob,createImagePdf,saveBlob}=await io();let blob,name;
   if(kind==='png'){const canvas=await renderExport(current.source,current.run);try{blob=await pngBlob(canvas);}finally{canvas.width=canvas.height=0;}name=exportName(state.pdf?state.name:null,state.pdf?state.current:0,'png');}
   else{
    const pdf=state.pdf,dpi=state.dpi;
    const factories=pages.map(number=>async()=>{
     owns(epoch);if(!pdf){const canvas=await renderExport(current.source,current.run);return {canvas,widthPt:canvas.width*.75,heightPt:canvas.height*.75,release:()=>{canvas.width=canvas.height=0;}};}
     const {renderPdfPage}=await io(),p=await renderPdfPage(pdf,number,dpi);owns(epoch);
     try{const canvas=await renderExport(p.canvas,state.records.get(number).run);return {canvas,widthPt:p.widthPt,heightPt:p.heightPt,release:()=>{canvas.width=canvas.height=0;p.canvas.width=p.canvas.height=0;}};}catch(e){p.canvas.width=p.canvas.height=0;throw e;}
    });
    blob=await createImagePdf(factories,{cancelled:()=>!state.owns(epoch),onPage:(n,total)=>status('Preparing PDF · '+n+' / '+total)});name=exportName(state.pdf?state.name:null,0,'pdf');
   }
   owns(epoch);download?.revoke();download=saveBlob(blob,name,doc);$('download-ready').href=download.url;$('download-ready').download=name;$('download-ready').hidden=false;$('download-ready').textContent='Download '+name;status('Saved. If the download did not start, use the download link.');
  }catch(e){failed(e);}finally{finish(epoch);}
 }
 function clear(){cancel();const old=state.clear();void old?.destroy();if(heldSource){heldSource.width=heldSource.height=0;heldSource=null;}$('pdf-dialog').close?.();invalidate();status('');sync();}
 $('pdf-pages').onclick=()=>{populate();$('pdf-dialog').showModal();};$('pdf-dialog-close').onclick=()=>$('pdf-dialog').close();
 $('pdf-all').onclick=()=>{state.selected=new Set(Array.from({length:state.count},(_,i)=>i+1));sync();};$('pdf-none').onclick=()=>{state.selected.clear();sync();};
 $('pdf-dpi').onchange=()=>{state.dpi=Number($('pdf-dpi').value);sync();};$('pdf-convert').onclick=()=>void convert();$('pdf-cancel').onclick=cancel;$('pdf-close').onclick=clear;
 $('pdf-prev').onclick=()=>void go(state.pages()[state.pages().indexOf(state.current)-1]);$('pdf-next').onclick=()=>void go(state.pages()[state.pages().indexOf(state.current)+1]??state.pages()[0]);
 $('save-png').onclick=()=>void save('png');$('save-pdf').onclick=()=>void save('pdf');sync();
 return {open,remember,sync,cancel,clear,state};
}
