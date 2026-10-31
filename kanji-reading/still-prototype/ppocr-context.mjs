// Display-only recovery from measured reference glyph envelopes. Reference text
// is never adopted. Separators remain original ink; PP must confirm each crop.
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>b[0]&&b[3]>b[1];
const h=b=>b[3]-b[1];
const union=bs=>[Math.min(...bs.map(b=>b[0])),Math.min(...bs.map(b=>b[1])),Math.max(...bs.map(b=>b[2])),Math.max(...bs.map(b=>b[3]))];
const row=(a,b)=>Math.min(a[3],b[3])-Math.max(a[1],b[1])>=.7*Math.min(h(a),h(b))&&Math.abs(a[1]+a[3]-b[1]-b[3])<=.5*Math.max(h(a),h(b));
const intersects=(a,b)=>Math.min(a[2],b[2])>Math.max(a[0],b[0])&&row(a,b);
export function measuredContextCandidates(regions,reference={}){
 const body=regions.map((r,index)=>({...r,index})).filter(r=>r.type==='本文候補'&&valid(r.box)&&/[ぁ-ゖァ-ヺ\p{Script=Han}]/u.test(r.text||''));
 const refs=(reference.lines||[]).filter(r=>valid(r.box)&&r.glyphs?.length),used=new Set(),out=[];
 for(const seed of body){
  if(used.has(seed.index))continue;
  const rs=new Set([seed]),ls=new Set();let changed=true;
  while(changed){changed=false;for(const l of refs)if(!ls.has(l)&&[...rs].some(r=>intersects(r.box,l.box))){ls.add(l);changed=true;}for(const r of body)if(!rs.has(r)&&[...ls].some(l=>intersects(r.box,l.box))){rs.add(r);changed=true;}}
  for(const r of rs)used.add(r.index);
  if(![...rs].some(r=>[...ls].some(l=>intersects(r.box,l.box)&&h(l.box)>=1.25*h(r.box)&&h(l.box)<=3*h(r.box))))continue;
  const glyphs=[...ls].flatMap(l=>l.glyphs).filter(g=>valid(g.box));
  // Uncertain non-punctuation glyphs cannot safely define a replacement crop.
  if(glyphs.some(g=>!/^\p{P}$/u.test(g.text||'')&&(!Number.isFinite(g.confidence)||g.confidence<.5)))continue;
  const separators=glyphs.filter(g=>/^\p{P}$/u.test(g.text||''));
  const letters=glyphs.filter(g=>!separators.includes(g)).sort((a,b)=>a.box[0]-b.box[0]);
  const parts=[];for(const g of letters){const last=parts.at(-1);if(!last||g.box[0]-last[2]>.3*h(g.box)||separators.some(s=>s.box[0]>=last[2]&&s.box[2]<=g.box[0]))parts.push([...g.box]);else parts[parts.length-1]=union([last,g.box]);}
  if(!parts.length||parts.some(b=>(b[2]-b[0])/h(b)>12.5))continue;
  // Never let a crop erase a separate ruby/held detection.
  const indices=[...rs].map(r=>r.index);
  if(regions.some((r,i)=>!indices.includes(i)&&valid(r.box)&&parts.some(b=>Math.min(b[2],r.box[2])>Math.max(b[0],r.box[0])&&Math.min(b[3],r.box[3])>Math.max(b[1],r.box[1]))))continue;
  out.push({indices,parts,originals:[...rs].map(({index,text,box})=>({index,text,box})),separators});
 }
 return out;
}
export async function verifyMeasuredContexts(source,canonical,reference,recognize){
 const regions=canonical.extendedRegions||canonical.classifiedRegions,candidates=measuredContextCandidates(regions,reference),decisions=[],replacements=new Map(),removed=new Set();
 for(const c of candidates){const checks=[];for(const box of c.parts){const first=await recognize(source,box,0),second=await recognize(source,box,.12);checks.push({box,first,second,accepted:Boolean(first.text?.trim())&&first.text===second.text&&[first,second].every(r=>Number.isFinite(r.minimumProbability)&&r.minimumProbability>=.85)});}
 const accepted=checks.every(r=>r.accepted);decisions.push({...c,checks,accepted});if(!accepted)continue;
 const sourceTexts=[...new Set(c.indices.flatMap(i=>[regions[i].text,...(regions[i].sourceTexts||[])]))];
 replacements.set(Math.min(...c.indices),checks.map(r=>({text:r.first.text,box:[...r.box],type:'本文候補',sourceTexts,canonicalRegions:c.originals,provenance:'measured-context-two-pp-crops'})));
 for(const i of c.indices)removed.add(i);
 }
 return {...canonical,extendedRegions:regions.flatMap((r,i)=>replacements.get(i)||(removed.has(i)?[]:[r])),contextVerification:{candidates:candidates.length,accepted:replacements.size,decisions}};
}
