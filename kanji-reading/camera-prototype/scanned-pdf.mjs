// Native JPEG decoding for a strictly verified, single-image scanned page.
// Other PDF content continues through PDF.js without dropping page elements.
import {pdfOperation} from './operation-report.mjs';
const name=s=>'/'+s;
export function scannedPage(page,api){
 const {PDFName,PDFArray,PDFRawStream,decodePDFRawStream}=api;
 const get=(dict,key)=>dict.lookup(PDFName.of(key));
 if(page.getRotation().angle!==0||page.node.Annots()?.size())return null;
 const box=page.getCropBox(),media=page.getMediaBox();
 if(!['x','y','width','height'].every(k=>Number.isFinite(box[k]))||box.width<=0||box.height<=0)return null;
 if(['x','y','width','height'].some(k=>box[k]!==media[k]))return null;
 let contents=page.node.Contents();
 if(contents instanceof PDFArray){if(contents.size()!==1)return null;contents=contents.lookup(0);}
 if(!(contents instanceof PDFRawStream)||contents.contents.length>2048)return null;
 const decoded=decodePDFRawStream(contents).decode();if(decoded.length>2048)return null;
 const source=new TextDecoder('latin1').decode(decoded).replace(/%[^\r\n]*/g,'');
 const n='([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))',pattern=new RegExp('^\\s*q\\s+'+Array(6).fill(n).join('\\s+')+'\\s+cm\\s+/([A-Za-z0-9_]+)\\s+Do\\s+Q\\s*$');
 const match=source.match(pattern);if(!match)return null;
 const matrix=match.slice(1,7).map(Number);if(!matrix.every(Number.isFinite)||matrix[0]<=0||matrix[3]<=0||matrix[1]!==0||matrix[2]!==0)return null;
 const objects=get(page.node.Resources(),'XObject');if(!objects)return null;
 const image=get(objects,match[7]);if(!(image instanceof PDFRawStream))return null;
 const dict=image.dict,w=get(dict,'Width')?.asNumber?.(),h=get(dict,'Height')?.asNumber?.();
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w*h<=16000000)return null;
 let filter=get(dict,'Filter');if(filter instanceof PDFArray){if(filter.size()!==1)return null;filter=filter.lookup(0);}
 if(String(filter)!==name('DCTDecode')||String(get(dict,'Subtype'))!==name('Image')||get(dict,'BitsPerComponent')?.asNumber?.()!==8)return null;
 if(!['/DeviceGray','/DeviceRGB'].includes(String(get(dict,'ColorSpace'))))return null;
 for(const key of ['SMask','Mask','ImageMask','Decode','DecodeParms'])if(dict.has(PDFName.of(key)))return null;
 if(get(page.node,'UserUnit'))return null;
 return {box,matrix,width:w,height:h,jpeg:image.contents};
}
export async function openScannedPdf(bytes){
 const api=await import('../../meikiocr-test/node_modules/pdf-lib/es/index.js');
 let parsed=await api.PDFDocument.load(bytes,{updateMetadata:false});
 const numPages=parsed.getPageCount();
 return {numPages,release(){parsed=null;},async render(number,dpi){
  if(!parsed)return null;
  pdfOperation.step('page-image-inspect',{page:number});
  let scan;try{scan=scannedPage(parsed.getPage(number-1),api);}catch{return null;}if(!scan)return null;
  const scale=dpi/72,width=Math.ceil(scan.box.width*scale),height=Math.ceil(scan.box.height*scale);
  if(width*height>16000000||width>16384||height>16384)throw Error('This page is too large at '+dpi+' dpi. Choose 200 or 150 dpi.');
  const targetWidth=Math.max(1,Math.ceil(scan.matrix[0]*scale)),targetHeight=Math.max(1,Math.ceil(scan.matrix[3]*scale));
  // Do not let a mostly off-page image request an unbounded bitmap.
  if(targetWidth*targetHeight>16000000||targetWidth>16384||targetHeight>16384)return null;
  pdfOperation.step('page-jpeg-decode',{page:number,sourceWidth:scan.width,sourceHeight:scan.height,targetWidth,targetHeight,width,height});
  const bitmap=await createImageBitmap(new Blob([scan.jpeg],{type:'image/jpeg'}),{resizeWidth:targetWidth,resizeHeight:targetHeight,resizeQuality:'high',imageOrientation:'none'});
  let canvas;
  try{
   if(bitmap.width!==targetWidth||bitmap.height!==targetHeight)throw Error('The JPEG decoder did not apply the requested image size.');
   pdfOperation.step('page-jpeg-paint',{page:number,bitmapWidth:bitmap.width,bitmapHeight:bitmap.height,width,height});
   canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Unable to create the PDF page canvas.');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
   ctx.setTransform(scale,0,0,-scale,-scan.box.x*scale,(scan.box.y+scan.box.height)*scale);
   ctx.transform(...scan.matrix);ctx.scale(1,-1);ctx.drawImage(bitmap,0,-1,1,1);
   ctx.setTransform(1,0,0,1,0,0);
   return {canvas,widthPt:scan.box.width,heightPt:scan.box.height,dpi};
  }catch(error){if(canvas)canvas.width=canvas.height=0;throw error;}finally{bitmap.close();}
 }};
}
