// Extracted verbatim from pages/ppocr-experiment/index.html, blob
// 21a0546f93031e81b20b74fd2eee8c39af868e7d. See tests/fixtures baseline.
// Only model lifecycle and UI side effects have been separated from inference.
let ort, sessions, initializing;
const base='https://huggingface.co/Kellenok/PP-OCRv6_manga/resolve/main/';
export async function initializePPOCR(){
 if(sessions)return sessions;
 if(initializing)return initializing;
 initializing=(async()=>{
  if(!globalThis.ort)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';script.onload=resolve;script.onerror=()=>reject(Error('ONNX Runtimeの読み込みに失敗'));document.head.append(script);});
  ort=globalThis.ort;
  ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  ort.env.wasm.numThreads=1;
  const options={executionProviders:['wasm'],graphOptimizationLevel:'all'};
  const [det,rec,dict]=await Promise.all([ort.InferenceSession.create(base+'det/manga_det_v0.2.onnx',options),ort.InferenceSession.create(base+'rec/manga_rec_v0.2.onnx',options),fetch(base+'ppocrv6_dict.txt').then(r=>{if(!r.ok)throw Error('辞書取得エラー');return r.text()})]);
  const vocab=['blank',...dict.trimEnd().split(/\r?\n/),' '];
  return sessions={det,rec,vocab};
 })().catch(error=>{initializing=null;throw error;});return initializing;
}
function tensor(canvas,mode){const {width:w,height:h}=canvas;const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,arr=new Float32Array(3*w*h);const mean=[.485,.456,.406],std=[.229,.224,.225];for(let i=0;i<w*h;i++){for(let c=0;c<3;c++){const bgr=data[4*i+(2-c)]/255;arr[c*w*h+i]=mode==='det'?(bgr-mean[c])/std[c]:(bgr-.5)/.5}}return new ort.Tensor('float32',arr,[1,3,h,w])}
function resized(source,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(source,0,0,w,h);return c}
async function runModel(session,input){const names=session.inputNames;const result=await session.run({[names[0]]:input});return result[session.outputNames[0]]}
function boxesFromMap(pred,w,h){const shape=pred.dims,ph=shape[shape.length-2],pw=shape[shape.length-1],a=pred.data;const mask=new Uint8Array(pw*ph),seen=new Uint8Array(pw*ph);for(let i=0;i<mask.length;i++)mask[i]=a[i]>.15?1:0;const boxes=[];for(let i=0;i<mask.length;i++){if(!mask[i]||seen[i])continue;let stack=[i],n=0,minx=pw,miny=ph,maxx=0,maxy=0,score=0;seen[i]=1;while(stack.length){let k=stack.pop(),x=k%pw,y=(k/pw)|0;n++;score+=a[k];minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);for(const j of [k-1,k+1,k-pw,k+pw]){if(j<0||j>=mask.length||seen[j]||!mask[j])continue;const xx=j%pw;if(Math.abs(xx-x)>1)continue;seen[j]=1;stack.push(j)}}if(n<9||score/n<.25)continue;const pad=Math.max(2,Math.round(Math.min(maxx-minx,maxy-miny)*.2));let x0=Math.max(0,(minx-pad)/pw*w),y0=Math.max(0,(miny-pad)/ph*h),x1=Math.min(w,(maxx+pad+1)/pw*w),y1=Math.min(h,(maxy+pad+1)/ph*h);if(Math.min(x1-x0,y1-y0)<4)continue;boxes.push([x0,y0,x1,y1])}return boxes.sort((a,b)=>a[1]-b[1]||a[0]-b[0]).slice(0,150)}
function intersectionOverUnion(a,b){const x=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),y=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));const inter=x*y,aa=(a[2]-a[0])*(a[3]-a[1]),bb=(b[2]-b[0])*(b[3]-b[1]);return inter/(aa+bb-inter||1)}
function dedupeBoxes(boxes){const out=[];for(const b of boxes.sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]))){if(!out.some(q=>intersectionOverUnion(b,q)>.55))out.push(b)}return out.sort((a,b)=>a[1]-b[1]||a[0]-b[0])}
function mergeRecognizedRegions(regions){
 const ordered=[...regions].sort((a,b)=>(b.text.length)-(a.text.length));const kept=[];
 for(const r of ordered){
  const [x0,y0,x1,y1]=r.box,w=x1-x0,h=y1-y0;
  const duplicate=kept.some(k=>{
   const [a,b,c,d]=k.box,inter=Math.max(0,Math.min(x1,c)-Math.max(x0,a))*Math.max(0,Math.min(y1,d)-Math.max(y0,b));
   const coverage=inter/Math.max(1,Math.min(w*h,(c-a)*(d-b)));
   const sameLine=Math.abs((y0+y1-b-d)/2)<Math.max(h,d-b)*.38;
   return coverage>.72&&sameLine&&(k.text.includes(r.text)||r.text.includes(k.text)||coverage>.91);
  });
  if(!duplicate)kept.push(r);
 }
 return kept.sort((a,b)=>a.box[1]-b.box[1]||a.box[0]-b.box[0]);
}
function classifyRegions(regions){
 const med=values=>{const a=values.slice().sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0};
 const heights=regions.filter(r=>r.text).map(r=>r.box[3]-r.box[1]);
 const medianHeight=med(heights);
 return regions.map(r=>{
  const [x0,y0,x1,y1]=r.box,h=y1-y0,w=x1-x0;
  if(!r.text)return {...r,type:'保留',reason:'空文字列'};
  const nearby=regions.filter(q=>q!==r&&q.text&&q.box[1]>=y0-5&&q.box[1]<=y1+Math.max(90,h*3)&&q.box[1]>y0&&
   Math.max(0,Math.min(x1,q.box[2])-Math.max(x0,q.box[0]))>Math.min(w,q.box[2]-q.box[0])*.18&&
   (q.box[3]-q.box[1])>h*1.28);
  const tiny=h<medianHeight*.73;
  if(tiny&&nearby.length)return {...r,type:'ルビ候補',reason:'小さく、下方に大きい文字がある'};
  if(tiny)return {...r,type:'保留',reason:'小さい文字だが対応する本文が不明'};
  return {...r,type:'本文候補',reason:'通常サイズ'};
 });
}
function classifyLocal(regions){
 return regions.map(r=>{
  const [x0,y0,x1,y1]=r.box,h=y1-y0,w=x1-x0;
  if(!r.text)return {...r,type:'保留',reason:'空文字列'};
  const near=regions.filter(q=>{
   if(q===r||!q.text)return false;
   const [a,b,c,d]=q.box,qh=d-b;
   const overlap=Math.max(0,Math.min(x1,c)-Math.max(x0,a));
   const gap=b-y1;
   return overlap/Math.max(1,Math.min(w,c-a))>.24&&gap>=-h*.5&&gap<Math.max(24,h*1.3)&&qh>=h*.9;
  }).sort((a,b)=>Math.abs(a.box[1]-y1)-Math.abs(b.box[1]-y1));
  const parent=near.find(q=>{
   const qh=q.box[3]-q.box[1];
   return qh>h*1.12&&(/[一-龯々]/u.test(q.text)||/[0-9０-９]/u.test(q.text));
  });
  if(parent)return {...r,type:'ルビ候補',reason:'直下の漢字・数字本文との相対サイズ',parentText:parent.text};
  if(near.length&&h<(near[0].box[3]-near[0].box[1])*.8)return {...r,type:'保留',reason:'小文字だが対応本文が未確定'};
  return {...r,type:'本文候補',reason:'近傍比較で本文'};
 });
}
export {tensor, resized, runModel, boxesFromMap, intersectionOverUnion, dedupeBoxes, mergeRecognizedRegions, classifyRegions, classifyLocal};
export async function recognizePPOCR(src,{resolution='tiles',status=()=>{}}={}){
 const {det,rec,vocab}=await initializePPOCR();
 const H=src.height,W=src.width,ratio=960/Math.max(W,H),rh=Math.max(32,Math.round(H*ratio/32)*32),rw=Math.max(32,Math.round(W*ratio/32)*32);status('文字領域を検出中…');const useTiles=resolution==='tiles';const pred=useTiles?null:await runModel(det,tensor(resized(src,rw,rh),'det'));let boxes=pred?boxesFromMap(pred,W,H):[];
if(resolution==='tiles'){
 const tileSize=960,overlap=150,all=[];
 for(let y=0;y<H;y+=tileSize-overlap){for(let x=0;x<W;x+=tileSize-overlap){
  const tw=Math.min(tileSize,W-x),th=Math.min(tileSize,H-y);
  if(tw<80||th<80)continue;
  const crop=document.createElement('canvas');crop.width=tw;crop.height=th;crop.getContext('2d').drawImage(src,x,y,tw,th,0,0,tw,th);
  const scale=Math.min(1,960/Math.max(tw,th)),ww=Math.max(32,Math.round(tw*scale/32)*32),hh=Math.max(32,Math.round(th*scale/32)*32);
  status('分割検出 '+(all.length+1)+'候補・'+x+','+y);
  const tilePred=await runModel(det,tensor(resized(crop,ww,hh),'det'));
  for(const b of boxesFromMap(tilePred,tw,th)){const g=[b[0]+x,b[1]+y,b[2]+x,b[3]+y];if(g[0]>=x+4&&g[1]>=y+4&&g[2]<=x+tw-4&&g[3]<=y+th-4)all.push(g)}
 }}
 boxes=dedupeBoxes(all);
}
const results=[];for(let i=0;i<boxes.length;i++){status('認識中 '+(i+1)+'/'+boxes.length);const [x0,y0,x1,y1]=boxes[i],cw=Math.max(1,Math.round(x1-x0)),ch=Math.max(1,Math.round(y1-y0));let crop=document.createElement('canvas');crop.width=cw;crop.height=ch;crop.getContext('2d').drawImage(src,x0,y0,x1-x0,y1-y0,0,0,cw,ch);if(ch>cw){const t=document.createElement('canvas');t.width=ch;t.height=cw;t.getContext('2d').translate(0,cw);t.getContext('2d').rotate(-Math.PI/2);t.getContext('2d').drawImage(crop,0,0);crop=t}const targetW=Math.max(16,Math.min(640,Math.round(48*crop.width/crop.height)));const out=await runModel(rec,tensor(resized(crop,targetW,48),'rec'));const dims=out.dims,steps=dims[dims.length-2],classes=dims[dims.length-1],v=out.data;let text='',last=0;for(let t=0;t<steps;t++){let best=0,bv=-Infinity;for(let j=0;j<classes;j++){const q=v[t*classes+j];if(q>bv){bv=q;best=j}}if(best&&best!==last)text+=vocab[best]||'';last=best}results.push({box:boxes[i].map(Math.round),text});}
 return {width:src.width,height:src.height,resolution,rawRegions:results,
  mergedRegions:mergeRecognizedRegions(results),
  classifiedRegions:classifyLocal(mergeRecognizedRegions(results))};
}
