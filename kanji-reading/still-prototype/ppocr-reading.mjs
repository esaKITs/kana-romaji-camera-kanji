import {applyRubyHeightPolicy} from './ruby-height.mjs';
// Reading/display bridge only. Never invent character boxes or alter OCR output.
import {displayTokens} from './display-tokens.mjs';
import {isHan,isTarget,reviewReason,splitOkurigana} from '../lab/src/policy.mjs';
import {candidateRomanization,readingRomanization} from '../lab/src/format.mjs';
const parentMatches=(r,text)=>r.text===text||r.sourceTexts?.includes(text);
const rect=b=>({x0:b[0],y0:b[1],x1:b[2],y1:b[3]});
const kana=s=>s.normalize('NFC').replace(/[ァ-ヶ]/g,k=>String.fromCharCode(k.charCodeAt(0)-96));
// The analyzer can split a kana word or a standalone auxiliary across tokens.
// Preserve grammatical particles and ordinary word boundaries; romanize a run
// together so the existing lexical long-vowel rules see the complete spelling.
export function groupPPOCRTokens(tokens){
 const result=[],isKana=t=>/^[ぁ-ゖァ-ヺー]+$/u.test(t.surface);
 const particle=t=>t.pos?.[0]==='助詞'&&!t.pos.includes('終助詞');
 for(const token of tokens){
  const previous=result.at(-1);
  const adjacentAuxiliary=previous?.pos?.[0]==='助動詞'&&token.pos?.[0]==='助動詞';
  const splitKanaWord=previous?.pos?.[0]==='副詞'&&(token.pos?.[0]==='名詞'||token.pos?.includes('終助詞'));
  if(previous&&previous.end===token.start&&isKana(previous)&&isKana(token)&&!particle(previous)&&!particle(token)&&(adjacentAuxiliary||splitKanaWord)){
   result[result.length-1]={...previous,surface:previous.surface+token.surface,reading:(previous.reading||previous.surface)+(token.reading||token.surface),end:token.end,lexicalKanaGroup:previous.lexicalKanaGroup||splitKanaWord,members:[...(previous.members||[previous]),...(token.members||[token])]};
  }else result.push(token);
 }
 return result;
}
export function regionReadingParts(surface,reading){
 const direct=splitOkurigana(surface,reading);if(direct)return direct;
 const m=surface.match(/^([ぁ-ゖァ-ヺー]+)([\p{Script=Han}々〆]+)([ぁ-ゖァ-ヺー]*)$/u),h=reading&&kana(reading);
 if(!m||!h)return null;
 const prefix=kana(m[1]),suffix=kana(m[3]);
 if(!h.startsWith(prefix)||!h.endsWith(suffix)||h.length<=prefix.length+suffix.length)return null;
 const start=m[1].length,end=start+m[2].length;
 return [{surface:m[1],reading:prefix,start:0,end:start},{surface:m[2],reading:h.slice(prefix.length,suffix.length?-suffix.length:undefined),start,end},...(m[3]?[{surface:m[3],reading:suffix,start:end,end:surface.length}]:[])];
}
export async function analyzePPOCRRegions(snapshot,analyze,{mode,style,verifyRuby}){
 // Display-only stitching: overlapping tiles may retain a shared text suffix.
 // Preserve every source region in snapshot/rawRegions and record contributors.
 const displayRegions=[];
 for(const original of snapshot.lines){
  const r={...original,sourceRegions:[original]};
  const previous=displayRegions.find(q=>q.regionType==='本文候補'&&r.regionType==='本文候補'&&q.box[0]<r.box[0]&&q.box[2]>r.box[0]&&Math.abs(q.box[1]-r.box[1])<Math.min(q.box[3]-q.box[1],r.box[3]-r.box[1])*.2);
  let shared=0;if(previous)for(let n=2;n<=Math.min(previous.text.length,r.text.length);n++)if(previous.text.slice(-n)===r.text.slice(0,n))shared=n;
  if(shared){previous.text+=r.text.slice(shared);previous.box=[Math.min(previous.box[0],r.box[0]),Math.min(previous.box[1],r.box[1]),Math.max(previous.box[2],r.box[2]),Math.max(previous.box[3],r.box[3])];previous.sourceRegions.push(original);}
  else displayRegions.push(r);
 }
 const lines=displayRegions.map((l,id)=>({...l,id,box:rect(l.box),glyphs:[{text:l.text,start:0,end:l.text.length,box:rect(l.box),geometry:'detected-region'}]}));
 const labels=[],pairs=[],withheld=[],analysis=[],cache=new Map(),rubyLinksByLine=new Map(),rubyAttempts=[];
 const tokensFor=async text=>{if(!cache.has(text))cache.set(text,await analyze(text));return cache.get(text);};
 // Classifier output is authoritative about which regions must not become body labels.
 for(const line of lines){
  if(line.regionType!=='本文候補'||line.orientation==='vertical')continue;
  const raw=await tokensFor(line.text);analysis.push({lineId:line.id,text:line.text,tokens:raw});
  const rubyLinks=[];rubyLinksByLine.set(line.id,rubyLinks);
  for(const ruby of lines.filter(l=>l.regionType==='ルビ候補'&&line.sourceRegions.some(r=>parentMatches(r,l.parentText))&&/^[ぁ-ゖァ-ヺー]+$/u.test(l.text))){
   // Identical text may appear on multiple rows. Require a unique nearby parent.
   const parents=lines.filter(l=>l.regionType==='本文候補'&&l.sourceRegions.some(r=>parentMatches(r,ruby.parentText))&&
    l.box.y0-ruby.box.y1>=-(ruby.box.y1-ruby.box.y0)*.5&&
    l.box.y0-ruby.box.y1<Math.max(24,(ruby.box.y1-ruby.box.y0)*1.3)&&
    Math.min(l.box.x1,ruby.box.x1)>Math.max(l.box.x0,ruby.box.x0));
   if(parents.length!==1||parents[0]!==line)continue;
   const matches=[],runs=[...line.text.matchAll(/[\p{Script=Han}々〆]+/gu)];
   for(const m of runs){
    const end=m.index+m[0].length,touched=raw.filter(t=>t.start<end&&t.end>m.index);
    const contextParts=touched.flatMap(t=>{
     if(t.unknown||!t.reading)return [];
     if(t.start>=m.index&&t.end<=end)return [{start:t.start,end:t.end,reading:t.reading}];
     return (regionReadingParts(t.surface,t.reading)||[]).map(p=>({...p,start:t.start+p.start,end:t.start+p.end})).filter(p=>p.start>=m.index&&p.end<=end);
    });
    const context=await tokensFor(m[0]);
    const alignedContext=contextParts.length&&contextParts[0].start===m.index&&contextParts.at(-1).end===end;
    const reading=alignedContext?contextParts.map(p=>p.reading).join(''):context.every(t=>!t.unknown&&t.reading)?context.map(t=>t.reading).join(''):'';
    if(reading&&kana(reading)===kana(ruby.text)||runs.length===1)matches.push({start:m.index,end:m.index+m[0].length,source:m[0],contextReading:reading||null});
   }
   if(matches.length!==1)continue;
   rubyLinks.push({ruby,...matches[0],dictionaryAgrees:kana(matches[0].contextReading||'')===kana(ruby.text)});
   const candidate={...matches[0],lineId:line.id,rubyLineId:ruby.id,reading:ruby.text,box:line.box,rubyBox:ruby.box,geometry:'detected-region',parentText:line.text};
   rubyAttempts.push(candidate);
   const checked=await verifyRuby(candidate),reading=typeof checked==='string'?checked:checked?.reading;
   if(reading&&kana(reading)===kana(ruby.text)){const pair={...candidate,verified:true,verification:checked?.method||'independent-reread'};pairs.push(pair);}
  }
 }
 // Repeated labels may have different crop scores. Reuse only a previously
 // verified identical body spelling AND identical detected annotation reading;
 // never share a body-only guess between homographs with different ruby.
 for(const candidate of rubyAttempts){
  if(pairs.some(p=>p.lineId===candidate.lineId&&p.rubyLineId===candidate.rubyLineId))continue;
  const trusted=pairs.find(p=>p.source===candidate.source&&kana(p.reading)===kana(candidate.reading)&&p.verification!=='same-document-verified-ruby');
  if(trusted)pairs.push({...candidate,verified:true,verification:'same-document-verified-ruby',referenceLineId:trusted.lineId,referenceRubyLineId:trusted.rubyLineId});
 }
 for(const line of lines){
  if(line.regionType!=='本文候補'||line.orientation==='vertical')continue;
  const raw=await tokensFor(line.text),rubyLinks=rubyLinksByLine.get(line.id)||[];
  // Verified annotation spans override analyzer boundaries as one reading.
  // Accept only spans aligned to existing token boundaries: no guessed glyph boxes.
  const linePairs=pairs.filter(p=>p.lineId===line.id),aligned=linePairs.filter(p=>{
   const touched=raw.filter(t=>t.start<p.end&&t.end>p.start);
   return touched.length&&touched[0].start===p.start&&touched.at(-1).end===p.end&&touched.map(t=>t.surface).join('')===p.source;
  });
  const readingTokens=raw.flatMap(t=>{
   const pair=aligned.find(p=>p.start<t.end&&p.end>t.start);
   if(!pair)return [t];
   if(t.start!==pair.start)return [];
   const members=raw.filter(t=>t.start>=pair.start&&t.end<=pair.end);
   const dictionaryAgrees=members.every(t=>!t.unknown&&t.reading)&&kana(members.map(t=>t.reading).join(''))===kana(pair.reading);
   return [{...(members.length===1?members[0]:{pos:['verified-ruby']}),surface:pair.source,reading:pair.reading,start:pair.start,end:pair.end,unknown:false,pronunciation:dictionaryAgrees?members[0]?.pronunciation:null,verifiedRuby:pair,...(dictionaryAgrees?{members}: {})}];
  });
  const tokens=groupPPOCRTokens(displayTokens(line.text,readingTokens,mode,[])),pieces=[];let offset=0,changed=false,convertedHan=false;
  const convertedSpans=[];
  for(const token of tokens){
   if(token.start>offset)pieces.push(line.text.slice(offset,token.start));
   offset=token.end;
   const verified=aligned.find(p=>p.start===token.start&&p.end===token.end);
   const review=verified?null:reviewReason(token);
   if(review||(!token.reading&&!verified)||/[ッっ]$/.test(token.reading)){
    pieces.push(token.surface);if(isHan(token.surface))withheld.push({lineId:line.id,surface:token.surface,reason:review||'reading-unresolved'});continue;
   }
   // A validated number+counter is one pronunciation (20歳=ハタチ,
   // 3本=サンボン), including in the Han-only modes. Bare digits stay untouched.
   const allTarget=Boolean(token.numericValidated&&token.reading)||[...token.surface].every(c=>isTarget(c,mode));
   if(allTarget){
    const output=verified&&!token.members?readingRomanization(verified.reading,style,{surface:verified.source}):candidateRomanization(token,style);
    pieces.push(output||token.surface);changed ||= Boolean(output);convertedHan ||= Boolean(output)&&isHan(token.surface);if(output&&isHan(token.surface))convertedSpans.push({start:token.start,end:token.end});continue;
   }
   const parts=token.numericValidated?token.numericParts:isHan(token.surface)?regionReadingParts(token.surface,token.reading):null;
   if(!parts?.length){pieces.push(token.surface);continue;}
   let position=0,partOutput='';
   for(const part of parts){partOutput+=token.surface.slice(position,part.start);const target=[...part.surface].every(c=>isTarget(c,mode));const output=target?readingRomanization(part.reading,style,{surface:part.surface,numericValidated:token.numericValidated}):null;partOutput+=output||part.surface;changed ||= Boolean(output);convertedHan ||= Boolean(output)&&isHan(part.surface);if(output&&isHan(part.surface))convertedSpans.push({start:token.start+part.start,end:token.start+part.end});position=part.end;}
   pieces.push(partOutput+token.surface.slice(position));
  }
  if(offset<line.text.length)pieces.push(line.text.slice(offset));
  if(!changed)continue;
  // One label replaces exactly one measured region. Unconverted characters are
  // carried into that label, so a partial mode never erases unlabelled text.
  const eligibleRubyIds=rubyLinks.filter(link=>(link.dictionaryAgrees||linePairs.some(p=>p.rubyLineId===link.ruby.id))&&convertedSpans.some(s=>s.start<=link.start&&s.end>=link.end)).map(link=>link.ruby.id);
  labels.push({rubyLineIds:eligibleRubyIds,source:line.text,reading:tokens.map(t=>t.reading||t.surface).join(''),output:pieces.join(' ').replace(/\s*。/g,'.').replace(/\s*、/g,','),box:line.box,bodyBox:line.box,rubyBox:null,lineId:line.id,coversRuby:false,geometry:'detected-region',readingSource:'dictionary-region',convertedHan});
 }
 return applyRubyHeightPolicy({mode,style,lines,pairs,labels,withheld,analysis,nonReading:[],rawRegions:snapshot.rawRegions,classifiedRegions:snapshot.classifiedRegions,regionDiagnostics:{geometry:'detected-regions',duplicates:0,joinedFragments:0,conflictingRegions:0}});
}
