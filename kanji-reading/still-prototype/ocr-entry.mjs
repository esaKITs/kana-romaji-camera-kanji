import {snapshotFromPPOCR,initializePPOCR,scanPPOCR} from './ppocr-adapter.mjs';
import {verifyClippedRegions} from './ppocr-verify.mjs';
import {scanStillTiles} from './still-tiles.mjs';
import {scanXYCut} from './xycut-sahi-tiles.mjs';
import {createMeikiOcr} from '../../meikiocr-test/vendor/meikiocr-web/index.js';
import {analyzeSnapshot,renderResult} from './pipeline.mjs';
import {assetUrl} from '../camera-prototype/asset-url.mjs';
import {recoveryRegions,mergeRecovery,recognitionViewport,restoreRecognitionCoordinates} from './recovery.mjs';
const usePPOCR=new URLSearchParams(location.search).get('ocr')==='ppocr';
let ocr=null,readingWorker=null,requestId=0;const waiting=new Map();
function rpc(data){return new Promise((resolve,reject)=>{const id=++requestId;const timer=setTimeout(()=>{waiting.delete(id);reject(Error('Reading timeout'));},60000);waiting.set(id,{resolve,reject,timer});readingWorker.postMessage({id,...data});});}
export async function initialize(engine='sudachi-small'){
 const t=performance.now();readingWorker?.terminate();readingWorker=new Worker(assetUrl('lab/worker-v2.js?v=0.2.19'));
 readingWorker.onmessage=({data})=>{const p=waiting.get(data.id);if(!p)return;clearTimeout(p.timer);waiting.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data);};
 const reading=await rpc({command:'init',engine});
 if(usePPOCR)await initializePPOCR();else await initializeMeiki();
 return {engine,combinedInitMs:performance.now()-t,readingInitMs:reading.initMs,readingWasmBytes:reading.wasmMemoryBytes};
}
async function initializeMeiki(){
 if(ocr)return;
 const base=new URL(assetUrl('ocr-assets/')),manifest=await(await fetch(new URL('manifest.json',base))).json();
  ocr=await createMeikiOcr({manifest,assetBaseUrl:base.href,profile:'meikipop-v2',execution:'wasm',wasmThreads:1,vertical:'off',recognitionBatchSize:1,maxInputPixels:4000000,scanTimeoutMs:60000,
   workerFactory:()=>new Worker(new URL('../../meikiocr-test/vendor/meikiocr-web/worker.js',import.meta.url),{type:'module'})});

}
async function scan(canvas,id,regions){
 const view=regions?recognitionViewport(regions,canvas.width,canvas.height):{x:0,y:0,width:canvas.width,height:canvas.height};
 const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(view.x,view.y,view.width,view.height).data;
 const snapshot=await ocr.scan({frameId:id,width:view.width,height:view.height,capturedAtMs:performance.now(),rgba:rgba.buffer,...(regions?{regions:view.regions}:{})},{transfer:'move'});
 return regions?restoreRecognitionCoordinates(snapshot,view):snapshot;
}
function preprocessFocus(canvas,mode){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data,w=canvas.width,h=canvas.height,n=w*h,g=new Uint8Array(n);
 for(let i=0;i<n;i++)g[i]=Math.round(.299*d[4*i]+.587*d[4*i+1]+.114*d[4*i+2]);
 if(mode==='contrast'||mode==='combined'){
  const size=64,cols=Math.ceil(w/size),rows=Math.ceil(h/size),maps=[];
  for(let cy=0;cy<rows;cy++)for(let cx=0;cx<cols;cx++){
   const hist=new Uint32Array(256);let count=0;
   for(let y=cy*size;y<Math.min(h,(cy+1)*size);y++)for(let x=cx*size;x<Math.min(w,(cx+1)*size);x++){hist[g[y*w+x]]++;count++;}
   const cap=Math.max(2,Math.ceil(count/256*2.5));let excess=0;
   for(let k=0;k<256;k++)if(hist[k]>cap){excess+=hist[k]-cap;hist[k]=cap;}
   let sum=0;const map=new Uint8Array(256);
   for(let k=0;k<256;k++){sum+=hist[k]+Math.floor(excess/256)+(k<excess%256?1:0);map[k]=Math.min(255,Math.round(255*sum/count));}
   maps.push(map);
  }
  const original=g.slice();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const fx=Math.max(0,x/size-.5),fy=Math.max(0,y/size-.5),x0=Math.min(cols-1,Math.floor(fx)),y0=Math.min(rows-1,Math.floor(fy)),x1=Math.min(cols-1,x0+1),y1=Math.min(rows-1,y0+1),dx=fx-x0,dy=fy-y0,v=original[y*w+x];
   const upper=maps[y0*cols+x0][v]*(1-dx)+maps[y0*cols+x1][v]*dx,lower=maps[y1*cols+x0][v]*(1-dx)+maps[y1*cols+x1][v]*dx;
   g[y*w+x]=Math.round(.7*(upper*(1-dy)+lower*dy)+.3*v);
  }
 }
 if(mode==='sharp'||mode==='combined'){
  const original=g.slice();
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const i=y*w+x,blur=(4*original[i]+original[i-1]+original[i+1]+original[i-w]+original[i+w])/8;
   g[i]=Math.max(0,Math.min(255,Math.round(original[i]+.65*(original[i]-blur))));
  }
 }
 for(let i=0;i<n;i++)d[4*i]=d[4*i+1]=d[4*i+2]=g[i];
 ctx.putImageData(img,0,0);
}
function focusConfidence(l){
 const gs=(l.glyphs||[]).filter(g=>/[ぁ-んァ-ヶ一-龯]/u.test(g.text||''));
 return gs.length?gs.reduce((s,g)=>s+Math.max(0,Math.min(1,Number(g.confidence)||0)),0)/gs.length:0;
}
export async function scanFocused(source,box){
 if(!ocr)throw Error('Initialize first');
 const [x0,y0,x1,y1]=box,w=x1-x0,h=y1-y0;
 if(w<1||h<1)throw Error('Empty focus region');
 const scale=Math.max(1,Math.min(3,Math.sqrt(3000000/(w*h))));
 const base=document.createElement('canvas');base.width=Math.max(1,Math.round(w*scale));base.height=Math.max(1,Math.round(h*scale));
 base.getContext('2d').drawImage(source,x0,y0,w,h,0,0,base.width,base.height);
 const variants=['original','contrast','sharp','combined'],candidates=[],counts=[];
 for(const variant of variants){
  const tile=document.createElement('canvas');tile.width=base.width;tile.height=base.height;tile.getContext('2d').drawImage(base,0,0);
  if(variant!=='original')preprocessFocus(tile,variant);
  try{
   const result=await scan(tile,'focus-'+variant+'-'+(++requestId));
   counts.push({variant,count:(result.lines||[]).length});
   const transform=b=>[x0+b[0]/(tile.width/w),y0+b[1]/(tile.height/h),x0+b[2]/(tile.width/w),y0+b[3]/(tile.height/h)];
   for(const l of result.lines||[])candidates.push({...l,focusVariant:variant,box:transform(l.box),glyphs:(l.glyphs||[]).map(g=>({...g,box:transform(g.box)}))});
  }catch(e){if(variant==='original')throw e;counts.push({variant,error:e.message});}
 }
 const area=b=>Math.max(1,(b[2]-b[0])*(b[3]-b[1]));
 const overlap=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]))/Math.min(area(a),area(b));
 for(const l of candidates){
  const peers=candidates.filter(p=>overlap(l.box,p.box)>.5);
  const agreement=new Set(peers.filter(p=>p.text===l.text).map(p=>p.focusVariant)).size;
  l.focusScore=.85*focusConfidence(l)+.15*agreement/variants.length;
 }
 const chosen=[];
 for(const l of candidates.sort((a,b)=>b.focusScore-a.focusScore)){
  if(!chosen.some(p=>overlap(p.box,l.box)>.5))chosen.push(l);
 }
 return {width:source.width,height:source.height,lines:chosen,variants:counts};
}
export async function analyzeText(text){return (await rpc({command:'analyze',text,numeric:true})).tokens;}
export async function runStill(source,{mode='あア漢',style='double',output=null,paperState=null,xycut=true}={}){
 if((!ocr&&!usePPOCR)||!readingWorker)throw Error('Initialize first');
 const t=performance.now(),primarySnapshot=await (usePPOCR?scanPPOCR(source):(xycut&&source.height>source.width?scanXYCut(source,(tile,id)=>scan(tile,id),'still-'+requestId):scanStillTiles(source,(tile,id)=>scan(tile,id),'still-'+requestId))),ocrMs=performance.now()-t,rubyChecks=[];let rubyOcrMs=0,recoveryMs=0,verificationMs=0,snapshot=primarySnapshot,recovery={regions:[],decisions:[]};
 if(usePPOCR){
  const started=performance.now();
  try{
   await initializeMeiki();
   const reference=await (xycut&&source.height>source.width?scanXYCut(source,(tile,id)=>scan(tile,id),'verify-'+requestId):scanStillTiles(source,(tile,id)=>scan(tile,id),'verify-'+requestId));
   const {recognizeRegion}=await import(/* @vite-ignore */ assetUrl('ppocr-single.mjs?v=0.2.18')); // A cached v0.2.17 module has no exported region helper.
   snapshot=snapshotFromPPOCR(await verifyClippedRegions(source,primarySnapshot,reference,recognizeRegion));
  }catch(error){snapshot={...primarySnapshot,geometryVerification:{accepted:0,error:error.message}};}
  verificationMs=performance.now()-started;
 }
 const regions=usePPOCR?[]:recoveryRegions(primarySnapshot);
 if(regions.length){const started=performance.now(),regionalSnapshot=await scan(source,'repair-'+requestId,regions.map(r=>r.box)),merged=mergeRecovery(primarySnapshot,regionalSnapshot,regions);snapshot=merged.snapshot;recovery={regions,decisions:merged.decisions,regionalSnapshot};recoveryMs=performance.now()-started;}
 const result=await analyzeSnapshot(snapshot,async text=>(await rpc({command:'analyze',text,numeric:true})).tokens,{mode,style,source,verifyRuby:async c=>{
  const kana=s=>s.normalize('NFC').replace(/[ァ-ヶ]/g,k=>String.fromCharCode(k.charCodeAt(0)-96));
  if(c.contextReading&&kana(c.contextReading)===kana(c.reading)){rubyChecks.push({source:c.source,first:c.reading,second:c.contextReading,method:'context-dictionary-agreement'});return{reading:c.reading,method:'context-dictionary-agreement'};}
  const b=c.rubyBox,pad=Math.max(2,(b.y1-b.y0)*.1),box=[Math.max(0,Math.floor(b.x0-pad)),Math.max(0,Math.floor(b.y0-pad)),Math.min(source.width,Math.ceil(b.x1+pad)),Math.min(source.height,Math.ceil(b.y1+pad))];
  if(usePPOCR)return null;
  const checkStart=performance.now(),recheck=await scan(source,'ruby-'+requestId,[box]),reading=recheck.lines.map(l=>l.glyphs.map(g=>g.text).join('')).join('').replace(/\s/g,'');rubyOcrMs+=performance.now()-checkStart;rubyChecks.push({source:c.source,first:c.reading,second:reading,method:'regional-reread'});return{reading,method:'regional-reread'};
 }});
 const renderStart=performance.now(),rendering=output?renderResult(output,source,result,{paperState}):null;
 const run={elapsedMs:performance.now()-t,rawText:(snapshot.rawRegions?[...snapshot.rawRegions,...(snapshot.supplemental?.regions||[])]:snapshot.lines).map(l=>l.text).join('\n'),effectiveText:snapshot.lines.map(l=>l.text).join('\n'),primarySnapshot,snapshot,recovery,result,rubyChecks,rendering,timings:{ocrMs,verificationMs,recoveryMs,rubyOcrMs,analysisMs:renderStart-t-ocrMs-verificationMs-recoveryMs-rubyOcrMs,renderMs:performance.now()-renderStart},jsHeapBytes:performance.memory?.usedJSHeapSize??null};
 // Bounded, browser-local diagnostics. This is neither an upload nor persisted data.
 window.stillLab.lastRun=run;return run;
}
export async function dispose(){readingWorker?.terminate();readingWorker=null;for(const p of waiting.values()){clearTimeout(p.timer);p.reject(Error('Disposed'));}waiting.clear();if(ocr)await ocr.dispose();ocr=null;}
window.stillLab={diagnoseReading:text=>rpc({command:'analyze',text,numeric:true,diagnostics:true}),initialize,runStill,scanFocused,dispose,scanRegions:(canvas,regions)=>scan(canvas,"regions-"+requestId,regions),analyzeSnapshot,renderResult,analyze:async text=>(await rpc({command:"analyze",text,numeric:true})).tokens};
