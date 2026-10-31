// Sparse, bounded recognition repair. Geometry and confidence only; no word list.
const japanese=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const area=b=>Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1]);
const intersection=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
export function readingConfidence(line){
 const glyphs=line.glyphs.filter(g=>japanese.test(g.text));
 return glyphs.length?glyphs.reduce((n,g)=>n+(g.confidence??0),0)/glyphs.length:0;
}
export function recoveryRegions(snapshot,{limit=6}={}){
 const strong=snapshot.lines.filter(l=>readingConfidence(l)>=.82),chosen=[];
 const proposals=(snapshot.diagnostics?.detectorProposals||[]).filter(p=>p.confidence>=.15&&p.box.every(Number.isFinite)&&area(p.box)>0).sort((a,b)=>b.confidence-a.confidence);
 for(const p of proposals){
  const b=p.box,h=b[3]-b[1];
  if(strong.some(l=>intersection(b,l.box)/area(b)>.7)||chosen.some(q=>intersection(b,q.originalBox)/Math.min(area(b),area(q.originalBox))>.5))continue;
  const nearby=strong.filter(l=>l.box[2]>b[0]-h*2&&l.box[0]<b[2]+h*2);
  const heights=(nearby.length?nearby:strong).flatMap(l=>l.glyphs.filter(g=>japanese.test(g.text)).map(g=>g.box[3]-g.box[1])).filter(n=>n>0);
  const reference=heights.length?median(heights):h;
  const padY=Math.max(h*.1,(reference-h)/2),padX=h*.05;
  const box=[Math.max(0,Math.floor(b[0]-padX)),Math.max(0,Math.floor(b[1]-padY)),Math.min(snapshot.width,Math.ceil(b[2]+padX)),Math.min(snapshot.height,Math.ceil(b[3]+padY))];
  // Added context must not include a known neighboring row, especially ruby/body.
  for(const l of strong){const q=l.box;if(q[2]<=box[0]||q[0]>=box[2])continue;if(q[3]<=b[1])box[1]=Math.max(box[1],Math.ceil(q[3]));if(q[1]>=b[3])box[3]=Math.min(box[3],Math.floor(q[1]));}
  if(area(box)<=0)continue;
  chosen.push({box,originalBox:[...b],detectorConfidence:p.confidence,referenceHeight:reference});
  if(chosen.length>=Math.min(16,limit))break;
 }
 return chosen;
}
export function mergeRecovery(primary,recovered,regions){
 let lines=[...primary.lines];const decisions=[];
 for(const line of recovered.lines){
  const confidence=readingConfidence(line),region=regions.find(r=>intersection(line.box,r.box)/Math.max(1,area(line.box))>.8);
  if(!region||confidence<.8||line.glyphs.some(g=>japanese.test(g.text)&&(g.confidence??0)<.65)){decisions.push({text:line.text,box:line.box,confidence,accepted:false,reason:'uncertain-regional-reading'});continue;}
  const overlaps=lines.filter(l=>intersection(l.box,region.originalBox)/Math.max(1,Math.min(area(l.box),area(region.originalBox)))>.6);
  // A regional reread may span several neighboring glyphs. Never replace a
  // confident line unless it is substantially the same text region: comparing
  // confidence alone can erase a correctly recognized adjacent word.
  const substantiallySameRegion=(a,b)=>intersection(a,b)/Math.max(1,Math.max(area(a),area(b)))>=.7;
  if(overlaps.some(l=>readingConfidence(l)>=.82&&!substantiallySameRegion(l.box,line.box))){
   decisions.push({text:line.text,box:line.box,confidence,accepted:false,reason:'would-erase-confident-neighbor'});continue;
  }
  if(overlaps.some(l=>readingConfidence(l)>=confidence-.04)){decisions.push({text:line.text,box:line.box,confidence,accepted:false,reason:'existing-reading-at-least-as-confident'});continue;}
  lines=lines.filter(l=>!overlaps.includes(l));lines.push({...line,id:'repair-'+decisions.length,recognitionSource:'regional-recheck'});
  decisions.push({text:line.text,box:line.box,confidence,accepted:true,replaced:overlaps.map(l=>l.text)});
 }
 return {snapshot:{...primary,lines},decisions};
}
// Transfer only the union of the reread regions, then restore image coordinates.
// This avoids copying a complete camera frame for a few short words.
export function recognitionViewport(regions,width,height){
 if(!Array.isArray(regions)||regions.length<1||regions.length>16||regions.some(b=>!Array.isArray(b)||b.length!==4||!b.every(Number.isInteger)||b[0]<0||b[1]<0||b[2]>width||b[3]>height||area(b)<=0))throw Error('Invalid recognition regions');
 const x=Math.min(...regions.map(b=>b[0])),y=Math.min(...regions.map(b=>b[1])),right=Math.max(...regions.map(b=>b[2])),bottom=Math.max(...regions.map(b=>b[3]));
 return{x,y,width:right-x,height:bottom-y,sourceWidth:width,sourceHeight:height,regions:regions.map(b=>[b[0]-x,b[1]-y,b[2]-x,b[3]-y])};
}
export function restoreRecognitionCoordinates(snapshot,viewport){
 const box=b=>[b[0]+viewport.x,b[1]+viewport.y,b[2]+viewport.x,b[3]+viewport.y];
 const diagnostics={...snapshot.diagnostics,recognitionViewport:{x:viewport.x,y:viewport.y,width:viewport.width,height:viewport.height}};
 for(const key of ['detectorProposals','detectionRegions'])if(snapshot.diagnostics?.[key])diagnostics[key]=snapshot.diagnostics[key].map(r=>({...r,box:box(r.box)}));
 return{...snapshot,width:viewport.sourceWidth,height:viewport.sourceHeight,lines:snapshot.lines.map(l=>({...l,box:box(l.box),glyphs:(l.glyphs||[]).map(g=>({...g,box:box(g.box)}))})),diagnostics};
}
