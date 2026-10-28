// Geometry only: never substitute a guessed character or reading.
const union=boxes=>[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
const valid=b=>b?.length===4&&b.every(Number.isFinite)&&b[2]>b[0]&&b[3]>b[1];
const height=b=>b[3]-b[1];
function sameRegion(a,b){
 const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 const area=b=>(b[2]-b[0])*height(b);
 return intersection/Math.max(area(a),area(b))>=.85;
}
export function normalizeRegions(snapshot){
 if(snapshot.geometry==='detected-regions')return {...snapshot,regionDiagnostics:{duplicates:0,joinedFragments:0,conflictingRegions:0}};
 const seen=[],diagnostics={duplicates:0,joinedFragments:0,conflictingRegions:0},lines=[];
 for(const original of snapshot.lines){
  if(original.orientation==='vertical'){lines.push(original);continue;}
  const glyphs=[];
  for(const g of original.glyphs){
   if(valid(g.box)&&seen.some(q=>q.text===g.text&&sameRegion(q.box,g.box))){diagnostics.duplicates++;continue;}
   if(valid(g.box)&&seen.some(q=>q.text!==g.text&&sameRegion(q.box,g.box)))diagnostics.conflictingRegions++;
   glyphs.push(g);if(valid(g.box))seen.push(g);
  }
  if(glyphs.length)lines.push({...original,glyphs,text:glyphs.map(g=>g.text).join('')});
 }
 // Short isolated choices remain eligible. Join only mutually unambiguous
 // horizontal fragments of matching size and baseline, never overlapping OCR.
 const eligible=l=>l.orientation!=='vertical'&&l.glyphs.length&&l.glyphs.every(g=>valid(g.box));
 const boxes=lines.map(l=>eligible(l)?union(l.glyphs.map(g=>g.box)):null);
 const edges=[];
 const kanaOnly=l=>/^[ぁ-ゖァ-ヺー]+$/u.test(l.text);
 for(let i=0;i<lines.length;i++)for(let j=0;j<lines.length;j++){
  if(i===j||!boxes[i]||!boxes[j])continue;
  // OCR can split a kana word into a multi-glyph run plus a final glyph
  // (e.g. こう + べ + へ). Only join kana fragments when at least one
  // side is a singleton, and leave larger independently recognized words
  // separate. The baseline/height/gap and mutual-uniqueness checks below
  // still apply.
  if(!kanaOnly(lines[i])||!kanaOnly(lines[j]))continue;
  if(lines[i].glyphs.length!==1&&lines[j].glyphs.length!==1)continue;
  const a=boxes[i],b=boxes[j],h=Math.min(height(a),height(b)),gap=b[0]-a[2];
  if(gap<0||gap>h*.45||Math.max(height(a),height(b))/h>1.25||Math.abs((a[1]+a[3]-b[1]-b[3])/2)>h*.15)continue;
  edges.push([i,j]);
 }
 const unique=edges.filter(([i,j])=>edges.filter(e=>e[0]===i).length===1&&edges.filter(e=>e[1]===j).length===1),consumed=new Set(),result=[];
 for(let i=0;i<lines.length;i++){
  if(consumed.has(i)||unique.some(e=>e[1]===i))continue;
  let current=i,glyphs=[...lines[i].glyphs];consumed.add(i);
  for(;;){const edge=unique.find(e=>e[0]===current);if(!edge||consumed.has(edge[1]))break;current=edge[1];consumed.add(current);glyphs.push(...lines[current].glyphs);diagnostics.joinedFragments++;}
  result.push({...lines[i],glyphs,text:glyphs.map(g=>g.text).join('')});
 }
 return {...snapshot,lines:result,regionDiagnostics:diagnostics};
}
