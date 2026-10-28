// Reading/display bridge only. Never invent character boxes or alter OCR output.
import {displayTokens} from './display-tokens.mjs';
import {isHan,isTarget,reviewReason,splitOkurigana} from '../lab/src/policy.mjs';
import {candidateRomanization} from '../lab/src/format.mjs';
import {romaji,rubyKanjiRomaji} from '../lab/generated/romanizer.mjs';
const rect=b=>({x0:b[0],y0:b[1],x1:b[2],y1:b[3]});
const kana=s=>s.normalize('NFC').replace(/[ァ-ヶ]/g,k=>String.fromCharCode(k.charCodeAt(0)-96));
export async function analyzePPOCRRegions(snapshot,analyze,{mode,style,verifyRuby}){
 const lines=snapshot.lines.map((l,id)=>({...l,id,box:rect(l.box),glyphs:[{text:l.text,start:0,end:l.text.length,box:rect(l.box),geometry:'detected-region'}]}));
 const labels=[],pairs=[],withheld=[],analysis=[],cache=new Map();
 const tokensFor=async text=>{if(!cache.has(text))cache.set(text,await analyze(text));return cache.get(text);};
 // Classifier output is authoritative about which regions must not become body labels.
 for(const line of lines){
  if(line.regionType!=='本文候補'||line.orientation==='vertical')continue;
  const raw=await tokensFor(line.text);analysis.push({lineId:line.id,text:line.text,tokens:raw});
  const attached=[];
  for(const ruby of lines.filter(l=>l.regionType==='ルビ候補'&&l.parentText===line.text&&/^[ぁ-ゖァ-ヺー]+$/u.test(l.text))){
   // Identical text may appear on multiple rows. Require a unique nearby parent.
   const parents=lines.filter(l=>l.regionType==='本文候補'&&l.text===ruby.parentText&&
    l.box.y0-ruby.box.y1>=-(ruby.box.y1-ruby.box.y0)*.5&&
    l.box.y0-ruby.box.y1<Math.max(24,(ruby.box.y1-ruby.box.y0)*1.3)&&
    Math.min(l.box.x1,ruby.box.x1)>Math.max(l.box.x0,ruby.box.x0));
   if(parents.length!==1||parents[0]!==line)continue;
   const matches=[];
   for(const m of line.text.matchAll(/[一-龯々]+/gu)){
    const context=await tokensFor(m[0]);
    const reading=context.every(t=>!t.unknown&&t.reading)?context.map(t=>t.reading).join(''):'';
    if(reading&&kana(reading)===kana(ruby.text))matches.push({start:m.index,end:m.index+m[0].length,source:m[0],contextReading:ruby.text});
   }
   if(matches.length!==1)continue;
   const candidate={...matches[0],lineId:line.id,rubyLineId:ruby.id,reading:ruby.text,box:line.box,rubyBox:ruby.box,geometry:'detected-region',parentText:line.text};
   const checked=await verifyRuby(candidate),reading=typeof checked==='string'?checked:checked?.reading;
   if(reading&&kana(reading)===kana(ruby.text)){const pair={...candidate,verified:true,verification:checked?.method||'independent-reread'};pairs.push(pair);attached.push(ruby);}
  }
  const tokens=displayTokens(line.text,raw,mode,[]),pieces=[];let offset=0,changed=false;
  for(const token of tokens){
   if(token.start>offset)pieces.push(line.text.slice(offset,token.start));
   offset=token.end;
   const verified=pairs.find(p=>p.lineId===line.id&&p.start===token.start&&p.end===token.end);
   const review=verified?null:reviewReason(token);
   if(review||(!token.reading&&!verified)||/[ッっ]$/.test(token.reading)){
    pieces.push(token.surface);if(isHan(token.surface))withheld.push({lineId:line.id,surface:token.surface,reason:review||'reading-unresolved'});continue;
   }
   const allTarget=[...token.surface].every(c=>isTarget(c,mode));
   if(allTarget){
    const literalKana=/^[ぁ-ゖァ-ヺー]+$/u.test(token.surface)&&!['は','へ','を'].includes(token.surface)&&token.reading!==token.surface;
    const output=verified?rubyKanjiRomaji(verified.reading,style):literalKana?romaji(token.surface,style):candidateRomanization(token,style);
    pieces.push(output||token.surface);changed ||= Boolean(output);continue;
   }
   const parts=token.numericValidated?token.numericParts:isHan(token.surface)?splitOkurigana(token.surface,token.reading):null;
   if(!parts?.length){pieces.push(token.surface);continue;}
   let position=0,partOutput='';
   for(const part of parts){partOutput+=token.surface.slice(position,part.start);const target=[...part.surface].every(c=>isTarget(c,mode));const output=target?(isHan(part.surface)?rubyKanjiRomaji(part.reading,style):romaji(part.reading,style)):null;partOutput+=output||part.surface;changed ||= Boolean(output);position=part.end;}
   pieces.push(partOutput+token.surface.slice(position));
  }
  if(offset<line.text.length)pieces.push(line.text.slice(offset));
  if(!changed)continue;
  // One label replaces exactly one measured region. Unconverted characters are
  // carried into that label, so a partial mode never erases unlabelled text.
  const rubyBox=attached.length?{x0:Math.min(...attached.map(l=>l.box.x0)),y0:Math.min(...attached.map(l=>l.box.y0)),x1:Math.max(...attached.map(l=>l.box.x1)),y1:Math.max(...attached.map(l=>l.box.y1))}:null;
  const box=rubyBox?{x0:Math.min(line.box.x0,rubyBox.x0),y0:Math.min(line.box.y0,rubyBox.y0),x1:Math.max(line.box.x1,rubyBox.x1),y1:Math.max(line.box.y1,rubyBox.y1)}:line.box;
  labels.push({source:line.text,reading:raw.map(t=>t.reading||t.surface).join(''),output:pieces.join(' '),box:line.box,bodyBox:line.box,rubyBox:null,lineId:line.id,coversRuby:false,geometry:'detected-region',readingSource:'dictionary-region'});
 }
 return {mode,style,lines,pairs,labels,withheld,analysis,nonReading:[],rawRegions:snapshot.rawRegions,classifiedRegions:snapshot.classifiedRegions,regionDiagnostics:{geometry:'detected-regions',duplicates:0,joinedFragments:0,conflictingRegions:0}};
}
