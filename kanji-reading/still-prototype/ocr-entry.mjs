import {createMeikiOcr} from '../../meikiocr-test/vendor/meikiocr-web/index.js';
import {analyzeSnapshot,renderResult} from './pipeline.mjs';
import {assetUrl} from '../camera-prototype/asset-url.mjs';
let ocr=null,readingWorker=null,requestId=0;const waiting=new Map();
function rpc(data){return new Promise((resolve,reject)=>{const id=++requestId;const timer=setTimeout(()=>{waiting.delete(id);reject(Error('Reading timeout'));},60000);waiting.set(id,{resolve,reject,timer});readingWorker.postMessage({id,...data});});}
export async function initialize(engine='sudachi-small'){
 const t=performance.now();readingWorker?.terminate();readingWorker=new Worker(assetUrl('lab/worker-v2.js'));
 readingWorker.onmessage=({data})=>{const p=waiting.get(data.id);if(!p)return;clearTimeout(p.timer);waiting.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data);};
 const reading=await rpc({command:'init',engine});
 if(!ocr){const base=new URL(assetUrl('ocr-assets/')),manifest=await(await fetch(new URL('manifest.json',base))).json();
  ocr=await createMeikiOcr({manifest,assetBaseUrl:base.href,profile:'meikipop-v2',execution:'wasm',wasmThreads:1,vertical:'off',recognitionBatchSize:1,maxInputPixels:4000000,scanTimeoutMs:60000,
   workerFactory:()=>new Worker(new URL('../../meikiocr-test/vendor/meikiocr-web/worker.js',import.meta.url),{type:'module'})});
 }
 return {engine,combinedInitMs:performance.now()-t,readingInitMs:reading.initMs,readingWasmBytes:reading.wasmMemoryBytes};
}
async function scan(canvas,id){
 const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
 return ocr.scan({frameId:id,width:canvas.width,height:canvas.height,capturedAtMs:performance.now(),rgba:rgba.buffer.slice(0)},{transfer:'move'});
}
export async function analyzeText(text){return (await rpc({command:'analyze',text,numeric:true})).tokens;}
export async function runStill(source,{mode='あア漢',style='double',output=null,paperState=null}={}){
 if(!ocr||!readingWorker)throw Error('Initialize first');
 const t=performance.now(),snapshot=await scan(source,'still-'+requestId),ocrMs=performance.now()-t,rubyChecks=[];let rubyOcrMs=0;
 const result=await analyzeSnapshot(snapshot,async text=>(await rpc({command:'analyze',text,numeric:true})).tokens,{mode,style,verifyRuby:async c=>{
  const b=c.rubyBox,pad=4,scale=4,crop=document.createElement('canvas');
  const x=Math.max(0,b.x0-pad),y=Math.max(0,b.y0-pad),w=Math.min(source.width-x,b.x1-b.x0+pad*2),h=Math.min(source.height-y,b.y1-b.y0+pad*2),margin=80;
  crop.width=Math.ceil(w*scale)+margin*2;crop.height=Math.ceil(h*scale)+margin*2;
  const context=crop.getContext('2d');context.fillStyle='white';context.fillRect(0,0,crop.width,crop.height);context.drawImage(source,x,y,w,h,margin,margin,w*scale,h*scale);
  const checkStart=performance.now(),recheck=await scan(crop,'ruby-'+requestId),reading=recheck.lines.map(l=>l.glyphs.map(g=>g.text).join('')).join('').replace(/\s/g,'');rubyOcrMs+=performance.now()-checkStart;rubyChecks.push({source:c.source,first:c.reading,second:reading});return reading;
 }});
 const renderStart=performance.now(),rendering=output?renderResult(output,source,result,{paperState}):null;
 const run={elapsedMs:performance.now()-t,rawText:snapshot.lines.map(l=>l.text).join('\n'),snapshot,result,rubyChecks,rendering,timings:{ocrMs,rubyOcrMs,analysisMs:renderStart-t-ocrMs-rubyOcrMs,renderMs:performance.now()-renderStart},jsHeapBytes:performance.memory?.usedJSHeapSize??null};
 // Bounded, browser-local diagnostics. This is neither an upload nor persisted data.
 window.stillLab.lastRun=run;return run;
}
export async function dispose(){readingWorker?.terminate();readingWorker=null;for(const p of waiting.values()){clearTimeout(p.timer);p.reject(Error('Disposed'));}waiting.clear();if(ocr)await ocr.dispose();ocr=null;}
window.stillLab={initialize,runStill,dispose,analyzeSnapshot,renderResult,analyze:async text=>(await rpc({command:"analyze",text,numeric:true})).tokens};
