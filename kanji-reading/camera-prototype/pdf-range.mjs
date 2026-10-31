// Local Blob ranges: do not materialize a whole multi-page PDF in JS memory.
export function localPdfRange(pdf,file,onError=()=>{}){
 let transport,aborted=false;
 transport=new pdf.PDFDataRangeTransport(file.size,new Uint8Array(),false);
 transport.requestDataRange=(begin,end)=>{
  if(aborted)return;
  void(async()=>{try{const bytes=new Uint8Array(await file.slice(begin,Math.min(end,file.size)).arrayBuffer());if(!aborted)transport.onDataRange(begin,bytes);}catch(error){if(!aborted){aborted=true;onError(error);}}})();
 };
 transport.abort=()=>{aborted=true;};
 return transport;
}
