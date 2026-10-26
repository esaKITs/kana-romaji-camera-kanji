import {scanStillTiles} from './still-tiles.mjs';
import {scanXYCut} from './xycut-sahi-tiles.mjs';
import {createMeikiOcr} from '../../meikiocr-test/vendor/meikiocr-web/index.js';
import {analyzeSnapshot,renderResult} from './pipeline.mjs';
import {assetUrl} from '../camera-prototype/asset-url.mjs';
import {recoveryRegions,mergeRecovery,recognitionViewport,restoreRecognitionCoordinates} from './recovery.mjs';
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
async function scan(canvas,id,regions){
 const view=regions?recognitionViewport(regions,canvas.width,canvas.height):{x:0,y:0,width:canvas.width,height:canvas.height};
 const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(view.x,view.y,view.width,view.height).data;
 const snapshot=await ocr.scan({frameId:id,width:view.width,height:view.height,capturedAtMs:performance.now(),rgba:rgba.buffer,...(regions?{regions:view.regions}:{})},{transfer:'move'});
 return regions?restoreRecognitionCoordinates(snapshot,view):snapshot;
}
export async function analyzeText(text){return (await rpc({command:'analyze',text,numeric:true})).tokens;}
export async function runStill(source,{mode='あア漢',style='double',output=null,paperState=null,adaptive=false,modelAware=true,xycut=true,cropWidth=960,cropHeight=544,overlap=.2}={}){
 if(!ocr||!readingWorker)throw Error('Initialize first');
 const t=performance.now(),primarySnapshot=await (xycut?scanXYCut(source,(tile,id)=>scan(tile,id),'still-'+requestId,{sliceWidth:cropWidth,sliceHeight:cropHeight,pad:24}):scanStillTiles(source,(tile,id)=>scan(tile,id),'still-'+requestId,{adaptive,modelAware,cropWidth,cropHeight,overlap})),ocrMs=performance.now()-t,rubyChecks=[];let rubyOcrMs=0,recoveryMs=0,snapshot=primarySnapshot,recovery={regions:[],decisions:[]};
 const regions=recoveryRegions(primarySnapshot);
 if(regions.length){const started=performance.now(),regionalSnapshot=await scan(source,'repair-'+requestId,regions.map(r=>r.box)),merged=mergeRecovery(primarySnapshot,regionalSnapshot,regions);snapshot=merged.snapshot;recovery={regions,decisions:merged.decisions,regionalSnapshot};recoveryMs=performance.now()-started;}
 const result=await analyzeSnapshot(snapshot,async text=>(await rpc({command:'analyze',text,numeric:true})).tokens,{mode,style,verifyRuby:async c=>{
  const kana=s=>s.normalize('NFC').replace(/[ァ-ヶ]/g,k=>String.fromCharCode(k.charCodeAt(0)-96));
  if(c.contextReading&&kana(c.contextReading)===kana(c.reading)){rubyChecks.push({source:c.source,first:c.reading,second:c.contextReading,method:'context-dictionary-agreement'});return{reading:c.reading,method:'context-dictionary-agreement'};}
  const b=c.rubyBox,pad=Math.max(2,(b.y1-b.y0)*.1),box=[Math.max(0,Math.floor(b.x0-pad)),Math.max(0,Math.floor(b.y0-pad)),Math.min(source.width,Math.ceil(b.x1+pad)),Math.min(source.height,Math.ceil(b.y1+pad))];
  const checkStart=performance.now(),recheck=await scan(source,'ruby-'+requestId,[box]),reading=recheck.lines.map(l=>l.glyphs.map(g=>g.text).join('')).join('').replace(/\s/g,'');rubyOcrMs+=performance.now()-checkStart;rubyChecks.push({source:c.source,first:c.reading,second:reading,method:'regional-reread'});return{reading,method:'regional-reread'};
 }});
 const renderStart=performance.now(),rendering=output?renderResult(output,source,result,{paperState}):null;
 const run={elapsedMs:performance.now()-t,rawText:snapshot.lines.map(l=>l.text).join('\n'),primarySnapshot,snapshot,recovery,result,rubyChecks,rendering,timings:{ocrMs,recoveryMs,rubyOcrMs,analysisMs:renderStart-t-ocrMs-recoveryMs-rubyOcrMs,renderMs:performance.now()-renderStart},jsHeapBytes:performance.memory?.usedJSHeapSize??null};
 // Bounded, browser-local diagnostics. This is neither an upload nor persisted data.
 window.stillLab.lastRun=run;return run;
}

function intersectsBox(a,b){
 const x=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]));
 const y=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 return x*y>0;
}
function diagnosticBox(value){
 if(Array.isArray(value)&&value.length===4&&value.every(Number.isFinite))return value;
 if(value&&typeof value==='object'&&['x0','y0','x1','y1'].every(k=>Number.isFinite(value[k])))return [value.x0,value.y0,value.x1,value.y1];
 return null;
}
/** Inspect where a character disappears without changing OCR output or uploading images.
 * Pass a source-image rectangle around the missing character, e.g. [x0,y0,x1,y1].
 */
export function diagnoseRegion(box,run=window.stillLab?.lastRun){
 const target=diagnosticBox(box);
 if(!target||target[2]<=target[0]||target[3]<=target[1])throw Error('Expected [x0,y0,x1,y1] around the missing character');
 if(!run)throw Error('Run still recognition before diagnosing a region');
 const matching=items=>(items||[]).filter(item=>{const b=diagnosticBox(item.box);return b&&intersectsBox(target,b);});
 const primary=run.primarySnapshot||{},final=run.snapshot||{};
 const proposals=matching(primary.diagnostics?.detectorProposals);
 const detectionRegions=matching(primary.diagnostics?.detectionRegions);
 const initialLines=matching(primary.lines);
 const finalLines=matching(final.lines);
 const recovered=matching(run.recovery?.regionalSnapshot?.lines);
 const drawn=matching(run.rendering?.drawn);
 const omitted=matching(run.rendering?.omitted);
 const summary={
  target,scanLayout:primary.diagnostics?.scanLayout??null,
  detectorProposals:proposals,detectionRegions,initialLines,finalLines,
  recoveredLines:recovered,drawnLabels:drawn,omittedLabels:omitted,
  recoveryDecisions:matching(run.recovery?.decisions),
  counts:{proposals:proposals.length,regions:detectionRegions.length,initial:initialLines.length,final:finalLines.length,drawn:drawn.length,omitted:omitted.length},
  caveat:'No detector proposal does not prove the original glyph was absent: tiled scans may not expose all detector diagnostics. Empty drawnLabels also occurs when runStill was called without an output canvas.'
 };
 console.table(summary.counts);
 console.log('MeikiOCR region diagnosis',summary);
 return summary;
}

export async function dispose(){readingWorker?.terminate();readingWorker=null;for(const p of waiting.values()){clearTimeout(p.timer);p.reject(Error('Disposed'));}waiting.clear();if(ocr)await ocr.dispose();ocr=null;}
window.stillLab={initialize,runStill,dispose,diagnoseRegion,scanRegions:(canvas,regions)=>scan(canvas,"regions-"+requestId,regions),analyzeSnapshot,renderResult,analyze:async text=>(await rpc({command:"analyze",text,numeric:true})).tokens};
