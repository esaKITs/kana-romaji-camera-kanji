import {pdfOperation} from './operation-report.mjs';
import {assetUrl} from './asset-url.mjs';
let reader;
async function pdfReader(){
 if(!reader)reader=import('../../meikiocr-test/node_modules/pdfjs-dist/legacy/build/pdf.mjs').then(pdf=>{
  pdf.GlobalWorkerOptions.workerSrc=new URL('../../meikiocr-test/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url).href;
  return pdf;
 });
 return reader;
}
export async function openPdf(file){
 pdfOperation.step('file-read',{bytes:file.size});let bytes=new Uint8Array(await file.arrayBuffer()),scanned=null,task=null,loading=null,destroyed=false;
 pdfOperation.step('pdf-parse',{bytes:bytes.byteLength});
 try{const {openScannedPdf}=await import('./scanned-pdf.mjs');scanned=await openScannedPdf(bytes);bytes=null;}catch{}
 function fallback(){
  if(loading)return loading;
  return loading=(async()=>{
  const pdf=await pdfReader();if(destroyed)throw new DOMException('Cancelled.','AbortError');scanned?.release();scanned=null;
  const input=bytes||new Uint8Array(await file.arrayBuffer());bytes=null;if(destroyed)throw new DOMException('Cancelled.','AbortError');
  task=pdf.getDocument({data:input,cMapUrl:assetUrl('pdf-assets/cmaps/'),cMapPacked:true,standardFontDataUrl:assetUrl('pdf-assets/standard_fonts/'),wasmUrl:assetUrl('pdf-assets/wasm/'),iccUrl:assetUrl('pdf-assets/iccs/'),isEvalSupported:false});bytes=null;
  try{return await task.promise;}catch(error){await task.destroy();if(error.name==='PasswordException')throw Error('Password-protected PDFs are not supported yet.');throw error;}
  })();
 }
 const numPages=scanned?.numPages||(await fallback()).numPages;pdfOperation.step('pdf-opened',{pages:numPages});
 return {numPages,renderScannedPage:(number,dpi)=>scanned?.render(number,dpi)||null,getPage:async number=>(await fallback()).getPage(number),destroy:async()=>{destroyed=true;scanned?.release();scanned=null;bytes=null;await task?.destroy();}};
}
export async function renderPdfPage(pdf,number,dpi=300,{preview=false}={}){
 if(!Number.isFinite(dpi)||dpi<=0)throw Error('Invalid PDF resolution.');
 const native=await pdf.renderScannedPage?.(number,dpi);if(native)return {...native,dpi:preview?null:dpi};
 pdfOperation.step('page-fetch',{page:number});const page=await pdf.getPage(number),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:dpi/72});
 const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
 if(width*height>16000000||width>16384||height>16384){page.cleanup();throw Error('This page is too large at '+dpi+' dpi. Choose 200 or 150 dpi.');}
 pdfOperation.step('page-canvas',{page:number,width,height});const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 try{pdfOperation.step('page-paint',{page:number,width,height});await page.render({canvas,viewport,background:'#ffffff'}).promise;}catch(error){canvas.width=canvas.height=0;throw error;}finally{page.cleanup();}
 return {canvas,widthPt:base.width,heightPt:base.height,dpi:preview?null:dpi};
}
export function pngBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Unable to create PNG.')),'image/png'));}
export async function createImagePdf(pages,{onPage=()=>{},cancelled=()=>false}={}){
 if(!pages.length)throw Error('Select at least one page.');
 const {PDFDocument}=await import('../../meikiocr-test/node_modules/pdf-lib/es/index.js'),pdf=await PDFDocument.create();
 pdf.setCreator('Kana漢 → Romaji Camera');pdf.setProducer('pdf-lib');
 for(let i=0;i<pages.length;i++){
  if(cancelled())throw new DOMException('Export cancelled.','AbortError');
  const item=await pages[i]();
  try{
   const image=await pdf.embedPng(await (await pngBlob(item.canvas)).arrayBuffer());
   const page=pdf.addPage([item.widthPt,item.heightPt]);page.drawImage(image,{x:0,y:0,width:item.widthPt,height:item.heightPt});await pdf.flush();
  }finally{item.release?.();}
  onPage(i+1,pages.length);
 }
 if(cancelled())throw new DOMException('Export cancelled.','AbortError');
 return new Blob([await pdf.save()],{type:'application/pdf'});
}
export function saveBlob(blob,name,doc=document){
 const url=URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download=name;a.hidden=true;doc.body.append(a);a.click();a.remove();return {url,revoke:()=>URL.revokeObjectURL(url)};
}
