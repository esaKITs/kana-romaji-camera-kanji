// Supplementary geometry verification, outside the immutable canonical PP core.
// The reference text alone is never substituted. The same PP recognizer must
// independently agree with it on two measured crops before accepting a repair.
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>b[0]&&b[3]>b[1];
const overlap=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
const normalized=t=>t.normalize('NFC').replace(/\s/g,'');
// A reference may disagree on one internal glyph while supplying sound geometry.
// Keep two unchanged characters on both sides as anchors; this is not a number
// substitution rule. A third confident PP crop is required below.
function oneInternalGlyphDiffers(a,b){
 const x=[...normalized(a)],y=[...normalized(b)];if(x.length!==y.length)return false;
 const differences=x.flatMap((c,i)=>c!==y[i]?[i]:[]);
 return differences.length===1&&differences[0]>=2&&differences[0]<x.length-2;
}
export function clippedRegionCandidates(regions,reference){
 const measured=(reference.lines||[]).filter(l=>valid(l.box)&&l.text?.trim()&&l.glyphs?.length);
 const candidates=[];
 for(let index=0;index<regions.length;index++){
  const region=regions[index],b=region.box;if(region.type!=='本文候補'||!valid(b))continue;
  const h=b[3]-b[1],w=b[2]-b[0];
  const matches=measured.filter(l=>{const q=l.box,qh=q[3]-q[1],qw=q[2]-q[0],x=Math.max(0,Math.min(b[2],q[2])-Math.max(b[0],q[0]));return qh>=h*1.25&&qh<=h*3&&x/w>=.8&&x/qw>=.8&&q[1]<=b[1]&&q[3]>=b[3];});
  if(matches.length!==1)continue;
  const line=matches[0],q=line.box;
  if(normalized(region.text)===normalized(line.text))continue; // Preserve already-agreeing PP results, including their coordinates.
  // Do not borrow pixels from ruby, adjacent body text or another detection.
  if(regions.some((r,i)=>i!==index&&valid(r.box)&&overlap(q,r.box)>0))continue;
  candidates.push({index,original:{text:region.text,box:[...b]},reference:{text:line.text,box:[...q]},box:[...q]});
 }
 // Competing primary regions cannot claim one reference region by iteration order.
 return candidates.filter(c=>candidates.filter(q=>q.box.every((v,i)=>v===c.box[i])).length===1);
}
export async function verifyClippedRegions(source,canonical,reference,recognize){
 const regions=canonical.extendedRegions||canonical.classifiedRegions,candidates=clippedRegionCandidates(regions,reference),decisions=[],accepted=new Map();
 for(const candidate of candidates){
  const first=await recognize(source,candidate.box,0),second=await recognize(source,candidate.box,.12),text=candidate.reference.text;
  const agrees=result=>Boolean(text.trim())&&normalized(result.text)===normalized(text);
  const confident=result=>Number.isFinite(result.minimumProbability)&&result.minimumProbability>=.85;
  const checks=[first,second],extra=[];
  // iPhone evidence: both texts agree with Meiki, but the .12 crop alone
  // scores .534675. Keep .85 and require two confident PP crops. Retry once
  // with an intermediate margin only when there is no textual disagreement
  // and exactly one original crop is confident. Never retry a contrary read.
  if(checks.every(agrees)&&checks.filter(confident).length===1){
   const result=await recognize(source,candidate.box,.06);checks.push(result);extra.push({padding:.06,...result});
  }
  let consensus=false;
  if(!checks.every(agrees)&&[first,second].every(confident)&&normalized(first.text)===normalized(second.text)&&oneInternalGlyphDiffers(first.text,text)){
   const result=await recognize(source,candidate.box,.06);checks.push(result);extra.push({padding:.06,...result});
   consensus=confident(result)&&normalized(result.text)===normalized(first.text);
  }
  const accept=consensus||checks.every(agrees)&&checks.filter(confident).length>=2;
  decisions.push({...candidate,first,second,...(extra.length?{extra}:{}),accepted:accept,reason:accept?(consensus?'three-pp-crops-one-reference-glyph-disagrees':extra.length?'reference-and-two-confident-pp-crops-agree-after-retry':'reference-and-two-pp-crops-agree'):'recognizers-disagree-or-score-low'});
  if(accept)accepted.set(candidate.index,{...regions[candidate.index],text:first.text,box:[...candidate.box],provenance:'measured-crop-pp-verified',canonicalRegion:candidate.original});
 }
 return {...canonical,extendedRegions:regions.map((r,i)=>accepted.get(i)||r),geometryVerification:{candidates:candidates.length,accepted:accepted.size,decisions,referenceSnapshot:reference}};
}

// A different but independently reread annotation may override the dictionary.
// Both crops use measured ruby geometry and the unchanged PP recognizer.
export async function verifyPPOCRRuby(source,candidate,recognize){
 const b=candidate.rubyBox,box=[b.x0,b.y0,b.x1,b.y1];
 if(!valid(box))return {reading:null,method:'invalid-ruby-geometry'};
 const first=await recognize(source,box,0),second=await recognize(source,box,.12);
 const kana=s=>String(s||'').normalize('NFC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
 const checks=[first,second],extra=[];
 const agrees=r=>kana(r.text)===kana(candidate.reading),confident=r=>Number.isFinite(r.minimumProbability)&&r.minimumProbability>=.85;
 if(checks.every(agrees)&&checks.filter(confident).length===1){const retry=await recognize(source,box,.06);checks.push(retry);extra.push({padding:.06,...retry});}
 const accepted=checks.every(agrees)&&checks.filter(confident).length>=2;
 return {reading:accepted?candidate.reading:null,method:'two-confident-pp-ruby-crops',first,second,...(extra.length?{extra}:{}),accepted};
}
