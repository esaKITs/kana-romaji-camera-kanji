import {scanRegionalCrops} from './regional-scan.mjs';
import {recognitionViewport,restoreRecognitionCoordinates} from './recovery.mjs';

// Enforce the worker limit at the common call site, including detector scans
// without measured regions. Preserve source pixels and restore absolute boxes.
export async function scanMeikiFrame(ocr,canvas,id,regions,detectRegions=false){
 const measured=regions?.length?regions:null;
 if(!measured&&canvas.width*canvas.height>4000000){
  return scanRegionalCrops(canvas,[[0,0,canvas.width,canvas.height]],(region,index)=>scanMeikiFrame(ocr,canvas,id+'-bounded-'+index,[region],true));
 }
 if(measured&&(measured.length>1||measured.some(b=>(b[2]-b[0])*(b[3]-b[1])>4000000))){
  return scanRegionalCrops(canvas,measured,(region,index,detect)=>scanMeikiFrame(ocr,canvas,id+'-region-'+index,[region],detect));
 }
 const view=measured?recognitionViewport(measured,canvas.width,canvas.height):{x:0,y:0,width:canvas.width,height:canvas.height};
 const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(view.x,view.y,view.width,view.height).data;
 let snapshot;
 try{snapshot=await ocr.scan({frameId:id,width:view.width,height:view.height,capturedAtMs:performance.now(),rgba:rgba.buffer,...(measured&&!detectRegions?{regions:view.regions}:{})},{transfer:'move'});}
 catch(error){throw new Error('Meiki scan '+id+' ('+view.width+'x'+view.height+'): '+error.message,{cause:error});}
 return measured?restoreRecognitionCoordinates(snapshot,view):snapshot;
}
