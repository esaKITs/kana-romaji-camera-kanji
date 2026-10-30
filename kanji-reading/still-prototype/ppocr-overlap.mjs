// Additional measured-crop verification. The experiment core and its raw output
// are retained verbatim; conflicting tile fragments are replaced only when two
// PP recognition crops agree at the existing .85 confidence gate.
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>b[0]&&b[3]>b[1];
const union=bs=>[Math.min(...bs.map(b=>b[0])),Math.min(...bs.map(b=>b[1])),Math.max(...bs.map(b=>b[2])),Math.max(...bs.map(b=>b[3]))];
const height=b=>b[3]-b[1];
const overlap=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
const sameRow=(a,b)=>Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]))>=Math.min(height(a),height(b))*.6&&Math.max(height(a),height(b))<=Math.min(height(a),height(b))*2;
export function overlappingRegionCandidates(regions,reference={}){
 const remaining=new Set(regions.flatMap((r,i)=>r.type==='本文候補'&&r.text?.trim()&&valid(r.box)?[i]:[])),candidates=[];
 while(remaining.size){
  const indices=[remaining.values().next().value];remaining.delete(indices[0]);
  for(let k=0;k<indices.length;k++)for(const j of [...remaining])if(overlap(regions[indices[k]].box,regions[j].box)>0&&sameRow(regions[indices[k]].box,regions[j].box)){indices.push(j);remaining.delete(j);}
  if(indices.length<2)continue;
  const originals=indices.map(index=>({index,text:regions[index].text,box:[...regions[index].box]})),initial=union(originals.map(r=>r.box)),h=height(initial);
  // Only measured reference boxes closely contained in this same row may enlarge
  // the crop. They supply geometry, never replacement text or guessed glyphs.
  const measured=(reference.lines||[]).filter(r=>valid(r.box)&&r.glyphs?.length&&sameRow(initial,r.box)&&overlap(initial,r.box)>0&&r.box[0]>=initial[0]-h&&r.box[2]<=initial[2]+h);
  const box=union([initial,...measured.map(r=>r.box)]);
  if(regions.some((r,i)=>!indices.includes(i)&&valid(r.box)&&r.text?.trim()&&overlap(box,r.box)>0))continue;
  candidates.push({indices,originals,box});
 }
 return candidates;
}
export async function verifyOverlappingRegions(source,canonical,reference,recognize){
 const regions=canonical.extendedRegions||canonical.classifiedRegions,candidates=overlappingRegionCandidates(regions,reference),decisions=[],accepted=new Map(),removed=new Set();
 for(const candidate of candidates){
  const first=await recognize(source,candidate.box,0),second=await recognize(source,candidate.box,.12);
  const accept=Boolean(first.text?.trim())&&/[ぁ-ゖァ-ヺ\p{Script=Han}]/u.test(first.text)&&first.text===second.text&&[first,second].every(r=>Number.isFinite(r.minimumProbability)&&r.minimumProbability>=.85);
  decisions.push({...candidate,first,second,accepted:accept});
  if(!accept)continue;
  const firstIndex=Math.min(...candidate.indices),sourceTexts=[...new Set(candidate.indices.flatMap(i=>[regions[i].text,...(regions[i].sourceTexts||[])]))];
  accepted.set(firstIndex,{...regions[firstIndex],box:[...candidate.box],text:first.text,sourceTexts,provenance:'measured-overlap-two-pp-crops',canonicalRegions:candidate.originals});
  for(const i of candidate.indices)if(i!==firstIndex)removed.add(i);
 }
 return {...canonical,extendedRegions:regions.flatMap((r,i)=>removed.has(i)?[]:[accepted.get(i)||r]),overlapVerification:{candidates:candidates.length,accepted:accepted.size,decisions}};
}
