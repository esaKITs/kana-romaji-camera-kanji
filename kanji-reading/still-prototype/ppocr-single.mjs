// Supplemental single-character pass, explicitly separate from canonical OCR.
// Detector, tensors, vocabulary and CTC decoding are shared with the baseline.
import {initializePPOCR,tensor,resized,runModel,boxesFromMap,dedupeBoxes,classifyLocal} from './ppocr-core.mjs';
const area=b=>Math.max(1,(b[2]-b[0])*(b[3]-b[1]));
export function overlapCoverage(a,b){return Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]))/Math.min(area(a),area(b));}
export function uncoveredSingleBoxes(boxes,regions){
 const heights=regions.filter(r=>r.text).map(r=>r.box[3]-r.box[1]).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)]||32;
 return boxes.filter(b=>{
  const w=b[2]-b[0],h=b[3]-b[1];
  return w/h>=.22&&w/h<=1.8&&h>=median*.4&&h<=median*1.8&&!regions.some(r=>r.text.trim()&&overlapCoverage(b,r.box)>.35);
 });
}
export function inkComponents(rgba,width,height){
 const mask=new Uint8Array(width*height),seen=new Uint8Array(mask.length),boxes=[];
 for(let i=0;i<mask.length;i++)mask[i]=(.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2])<160?1:0;
 for(let i=0;i<mask.length;i++){
  if(!mask[i]||seen[i])continue;
  const stack=[i];seen[i]=1;let x0=width,y0=height,x1=0,y1=0,n=0;
  while(stack.length){const k=stack.pop(),x=k%width,y=Math.floor(k/width);n++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*width+xx;if(xx<0||xx>=width||yy<0||yy>=height||seen[j]||!mask[j])continue;seen[j]=1;stack.push(j);}
  }
  if(n>=8)boxes.push([x0,y0,x1,y1]);
 }
 return boxes;
}
async function detectLocalCharacters(source,regions){
 const {det}=await initializePPOCR(),W=source.width,H=source.height;
 // Ink is only a proposal; the unchanged neural detector must confirm a box.
 const ink=inkComponents(source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,W,H);
 const proposals=uncoveredSingleBoxes(ink,regions),all=[];
 const heights=regions.filter(r=>r.text).map(r=>r.box[3]-r.box[1]).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)]||32;
 for(const b of proposals){
  const pad=median*.8,x=Math.max(0,Math.floor(b[0]-pad)),y=Math.max(0,Math.floor(b[1]-pad)),tw=Math.min(W,Math.ceil(b[2]+pad))-x,th=Math.min(H,Math.ceil(b[3]+pad))-y;
  const crop=document.createElement('canvas');crop.width=tw;crop.height=th;crop.getContext('2d').drawImage(source,x,y,tw,th,0,0,tw,th);
  const ww=Math.max(32,Math.round(tw*3/32)*32),hh=Math.max(32,Math.round(th*3/32)*32);
  const pred=await runModel(det,tensor(resized(crop,ww,hh),'det'));
  for(const q of boxesFromMap(pred,tw,th)){const g=[q[0]+x,q[1]+y,q[2]+x,q[3]+y];if(overlapCoverage(g,b)>.7)all.push(g);}
 }
 return {boxes:dedupeBoxes(all),proposals};
}
async function recognize(source,box,padding){
 const {rec,vocab}=await initializePPOCR(),[x0,y0,x1,y1]=box;
 const p=Math.min(x1-x0,y1-y0)*padding,b=[Math.max(0,x0-p),Math.max(0,y0-p),Math.min(source.width,x1+p),Math.min(source.height,y1+p)];
 const cw=Math.max(1,Math.round(b[2]-b[0])),ch=Math.max(1,Math.round(b[3]-b[1]));let crop=document.createElement('canvas');crop.width=cw;crop.height=ch;crop.getContext('2d').drawImage(source,b[0],b[1],b[2]-b[0],b[3]-b[1],0,0,cw,ch);
 // Original recognition orientation and dimensions, with two crop margins checked.
 if(ch>cw){const t=document.createElement('canvas');t.width=ch;t.height=cw;t.getContext('2d').translate(0,cw);t.getContext('2d').rotate(-Math.PI/2);t.getContext('2d').drawImage(crop,0,0);crop=t}
 const targetW=Math.max(16,Math.min(640,Math.round(48*crop.width/crop.height)));
 const out=await runModel(rec,tensor(resized(crop,targetW,48),'rec'));
 const dims=out.dims,steps=dims[dims.length-2],classes=dims[dims.length-1],v=out.data;let text='',last=0;const probabilities=[];
 for(let t=0;t<steps;t++){let best=0,bv=-Infinity;for(let j=0;j<classes;j++){const q=v[t*classes+j];if(q>bv){bv=q;best=j}}if(best&&best!==last){text+=vocab[best]||'';probabilities.push(bv)}last=best}
 return {text,minimumProbability:probabilities.length?Math.min(...probabilities):0};
}
export async function recoverSingleCharacters(source,canonicalRegions){
 const started=performance.now(),local=await detectLocalCharacters(source,canonicalRegions),detectedBoxes=local.boxes,boxes=uncoveredSingleBoxes(detectedBoxes,canonicalRegions),accepted=[],decisions=[];
 for(const box of boxes){
  const first=await recognize(source,box,0),second=await recognize(source,box,.12);
  const accept=/^[ぁ-ゖァ-ヺー一-龯々]$/u.test(first.text)&&first.text===second.text&&Math.min(first.minimumProbability,second.minimumProbability)>=.85;
  decisions.push({box,first,second,accepted:accept});
  if(accept)accepted.push({box:box.map(Math.round),text:first.text,provenance:'supplemental-local-single',checks:[first,second]});
 }
 return {regions:accepted,detectedBoxes,decisions,elapsedMs:performance.now()-started,scale:3,proposals:local.proposals};
}

export async function augmentPPOCR(source,canonical){
 const supplemental=await recoverSingleCharacters(source,canonical.rawRegions);
 const classified=classifyLocal([...canonical.mergedRegions,...supplemental.regions]);
 const additions=classified.filter(r=>r.provenance==='supplemental-local-single');
 return {...canonical,supplemental:{...supplemental,classifiedRegions:additions},extendedRegions:[...canonical.classifiedRegions,...additions]};
}
