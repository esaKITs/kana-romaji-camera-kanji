import {makePaperPatch} from './paper-patch.mjs';
import {labelReplacesGlyph} from './ruby-height.mjs';
import {analyzePPOCRRegions} from './ppocr-reading.mjs';
import {sampledPaperColor,selectPapers,paperFor,foregroundFor} from './paper.mjs';
import {displayTokens,openingBullet} from './display-tokens.mjs';
import {allocateLabels} from './layout.mjs';
import {normalizeRegions} from './regions.mjs';
import {splitOkurigana,isHan,isTarget,modes,reviewReason} from '../lab/src/policy.mjs';
import {candidateRomanization} from '../lab/src/format.mjs';
import {romaji,rubyKanjiRomaji} from '../lab/generated/romanizer.mjs';
const union=boxes=>({x0:Math.min(...boxes.map(b=>b.x0)),y0:Math.min(...boxes.map(b=>b.y0)),x1:Math.max(...boxes.map(b=>b.x1)),y1:Math.max(...boxes.map(b=>b.y1))});
const valid=b=>Object.values(b).every(Number.isFinite)&&b.x1>b.x0&&b.y1>b.y0;
function splitByPaper(source){
 if(!source?.getContext)return ()=>false;
 const ctx=source.getContext('2d',{willReadFrequently:true}),w=source.width,h=source.height;
 const sample=g=>{
  const b=g.box,x=Math.max(0,Math.min(w-1,Math.round((b[0]+b[2])/2))),dy=Math.max(2,Math.round((b[3]-b[1])*.2));
  const ys=[Math.max(0,Math.round(b[1]-dy)),Math.min(h-1,Math.round(b[3]+dy))];
  const colors=ys.map(y=>ctx.getImageData(x,y,1,1).data);
  return [0,1,2].map(k=>Math.max(colors[0][k],colors[1][k]));
 };
 return (a,b)=>{
  const p=sample(a),q=sample(b),distance=Math.hypot(...p.map((v,i)=>v-q[i]));
  const luminance=v=>.299*v[0]+.587*v[1]+.114*v[2];
  return distance>38&&Math.abs(luminance(p)-luminance(q))>15;
 };
}
export function sourceLines(snapshot,source=null){
 const boundary=splitByPaper(source);let id=0;
 return snapshot.lines.filter(l=>l.orientation!=='vertical').flatMap(l=>{
  const raw=(l.glyphs||[]).filter(g=>g.text&&g.box?.length===4);
  const groups=[];let group=[];
  for(const glyph of raw){
   if(group.length&&boundary(group[group.length-1],glyph)){groups.push(group);group=[];}
   group.push(glyph);
  }
  if(group.length)groups.push(group);
  return groups.map(gs=>{
   let offset=0;
   const glyphs=gs.map(g=>{const start=offset;offset+=g.text.length;return {text:g.text,start,end:offset,confidence:g.confidence,box:{x0:g.box[0],y0:g.box[1],x1:g.box[2],y1:g.box[3]}};});
   if(glyphs.some(g=>!valid(g.box)))return null;
   return {id:id++,text:glyphs.map(g=>g.text).join(''),glyphs,box:union(glyphs.map(g=>g.box))};
  }).filter(Boolean);
 });
}
export function spanBox(line,start,end){
 const glyphs=line.glyphs.filter(g=>g.start<end&&g.end>start);
 if(!glyphs.length||glyphs[0].start!==start||glyphs.at(-1).end!==end)return null;
 return union(glyphs.map(g=>g.box));
}
export function rubyCandidates(lines){
 const candidates=[];
 // OCR often joins consecutive annotated words into one Han run. Consider
 // glyph-aligned subspans; uniqueness below rejects competing associations.
 for(const main of lines)for(const run of main.text.matchAll(/[\p{Script=Han}々〆]+/gu)){
 const boundaries=main.glyphs.filter(g=>g.start>=run.index&&g.end<=run.index+run[0].length);
 for(let first=0;first<boundaries.length;first++)for(let last=first;last<Math.min(boundaries.length,first+16);last++){
  const start=boundaries[first].start,end=boundaries[last].end,match={0:main.text.slice(start,end),index:start};
  const box=spanBox(main,match.index,match.index+match[0].length);if(!box)continue;
  const h=box.y1-box.y0,w=box.x1-box.x0;
  for(const ruby of lines){
   if(ruby===main||!/^[ぁ-ゖァ-ヺー]+$/u.test(ruby.text))continue;
   const q=ruby.box,rh=q.y1-q.y0,rw=q.x1-q.x0,overlap=Math.max(0,Math.min(q.x1,box.x1)-Math.max(q.x0,box.x0));
   if(rw>w*2.4)continue;
   if(rh<h*.18||rh>h*.72||q.y1>box.y0+h*.12||box.y0-q.y1>h*.8)continue;
   if(overlap<Math.min(w,rw)*.7||overlap<w*.65||Math.abs((q.x0+q.x1-box.x0-box.x1)/2)>w*.25)continue;
   if(Math.min(...ruby.glyphs.map(g=>g.confidence??0))<.75)continue;
   const cover=union([box,q]);
   // Do not erase an unrelated glyph between ruby and its proposed body.
   if(lines.some(l=>l.glyphs.some(g=>!(l===ruby||l===main&&g.start>=start&&g.end<=end)&&Math.min(g.box.x1,cover.x1)>Math.max(g.box.x0,cover.x0)&&Math.min(g.box.y1,cover.y1)>Math.max(g.box.y0,cover.y0))))continue;
   candidates.push({lineId:main.id,start,end,source:match[0],box,rubyLineId:ruby.id,rubyBox:q,reading:ruby.text});
  }
 }
 }
 // Neither competing bodies nor competing ruby lines may be resolved by iteration order.
 return candidates.filter(c=>candidates.filter(x=>x.rubyLineId===c.rubyLineId).length===1&&!candidates.some(x=>x!==c&&x.lineId===c.lineId&&x.start<c.end&&x.end>c.start));
}
export async function analyzeSnapshot(snapshot,analyze,{mode='あア漢',style='double',verifyRuby=async()=>null,source=null}={}){
 if(!modes.includes(mode))throw Error('Invalid mode');
 if(snapshot.engine==='ppocrv6-manga')return analyzePPOCRRegions(snapshot,analyze,{mode,style,verifyRuby});
 const normalized=normalizeRegions(snapshot),lines=sourceLines(normalized,source),pairs=[],candidates=rubyCandidates(lines);
 const tokenCache=new Map();const tokensFor=async line=>{if(!tokenCache.has(line.id))tokenCache.set(line.id,await analyze(line.text));return tokenCache.get(line.id);};
 for(const c of candidates){
  const main=lines.find(l=>l.id===c.lineId),contextTokens=(await tokensFor(main)).filter(t=>t.start>=c.start&&t.end<=c.end);
  const contextReading=contextTokens.length&&contextTokens[0].start===c.start&&contextTokens.at(-1).end===c.end&&contextTokens.every(t=>!t.unknown&&t.reading)?contextTokens.map(t=>t.reading).join(''):null;
  const checked=await verifyRuby({...c,contextReading}),reread=typeof checked==='string'?checked:checked?.reading;
  if(reread?.normalize('NFC')===c.reading.normalize('NFC'))pairs.push({...c,verified:true,verification:typeof checked==='object'?checked.method:'independent-reread'});
 }
 const consumedRuby=new Set(candidates.map(p=>p.rubyLineId)),labels=[],withheld=[],nonReading=[],analysis=[];
 for(const line of lines){
  if(consumedRuby.has(line.id))continue;
  const rawTokens=await tokensFor(line),candidate=openingBullet(line),bullet=candidate&&rawTokens.some(t=>t.start===0&&t.end===1)?candidate:null;
  analysis.push({lineId:line.id,text:line.text,tokens:rawTokens});
  if(bullet)nonReading.push({...bullet,lineId:line.id});
  const tokens=displayTokens(line.text,rawTokens,mode,pairs.filter(p=>p.lineId===line.id),{bulletEnd:bullet?.end});
  for(const pair of pairs.filter(p=>p.lineId===line.id)){
   labels.push({source:pair.source,reading:pair.reading,output:rubyKanjiRomaji(pair.reading,style),box:union([pair.box,pair.rubyBox]),bodyBox:pair.box,rubyBox:pair.rubyBox,lineId:line.id,readingSource:'verified-ruby',coversRuby:true});
  }
  for(const token of tokens){
   if(bullet&&token.start===0&&token.end===bullet.end)continue;
   if(pairs.some(p=>p.lineId===line.id&&token.start<p.end&&token.end>p.start)){
    // Whole-ruby spans override analyzer boundaries. Partial overlaps are withheld.
    continue;
   }
   const pair=pairs.find(p=>p.lineId===line.id&&p.start===token.start&&p.end===token.end);
   const review=pair?null:reviewReason(token);
   if(review){if(isHan(token.surface))withheld.push({surface:token.surface,reason:review});continue;}
   const reading=pair?.reading||token.reading;if(!reading)continue;
   if(/[ッっ]$/.test(reading)){withheld.push({surface:token.surface,reason:'incomplete-sokuon'});continue;}
   // A validated number+counter is one pronunciation (20歳=ハタチ,
   // 3本=サンボン), including in the Han-only modes. Bare digits stay untouched.
   const allTarget=Boolean(token.numericValidated&&token.reading)||[...token.surface].every(c=>isTarget(c,mode));
   let parts;
   if(allTarget)parts=[{surface:token.surface,reading,start:0,end:token.surface.length}];
   else if(token.numericValidated)parts=token.numericParts?.filter(p=>[...p.surface].every(c=>isTarget(c,mode)));
   else if(isHan(token.surface))parts=splitOkurigana(token.surface,reading)?.filter(p=>[...p.surface].every(c=>isTarget(c,mode)));
   else parts=[];
   if(!parts?.length){if(token.numericValidated)withheld.push({surface:token.surface,reason:'numeric-alignment-unresolved'});continue;}
   for(const part of parts){
    const box=spanBox(line,token.start+part.start,token.start+part.end);
    if(!box){withheld.push({surface:part.surface,reason:'glyph-alignment-unresolved'});continue;}
    const literalKana=/^[ぁ-ゖァ-ヺー]+$/u.test(part.surface)&&!['は','へ','を'].includes(part.surface)&&part.reading!==part.surface;
    const output=literalKana?romaji(part.surface,style):part===parts[0]&&allTarget&&!pair?candidateRomanization(token,style):isHan(part.surface)?rubyKanjiRomaji(part.reading,style):romaji(part.reading,style);
    if(!output)continue;
    labels.push({source:part.surface,reading:part.reading,output,box,lineId:line.id,readingSource:pair?'verified-ruby':token.readingSource||'dictionary-candidate',coversRuby:false});
   }
  }
 }
 return {mode,style,lines:lines.map(l=>({id:l.id,text:l.text,box:l.box,glyphs:l.glyphs})),pairs,labels,withheld,nonReading,analysis,regionDiagnostics:normalized.regionDiagnostics};
}
// Subtract preserved glyph rectangles from a background/text region.
export function visibleRegions(box,obstacles){
 let regions=[box];
 for(const q of obstacles){const next=[];for(const r of regions){
  const x0=Math.max(r.x0,q.x0),x1=Math.min(r.x1,q.x1),y0=Math.max(r.y0,q.y0),y1=Math.min(r.y1,q.y1);
  if(x1<=x0||y1<=y0){next.push(r);continue;}
  for(const part of [{x0:r.x0,x1:r.x1,y0:r.y0,y1:y0},{x0:r.x0,x1:r.x1,y0:y1,y1:r.y1},{x0:r.x0,x1:x0,y0,y1},{x0:x1,x1:r.x1,y0,y1}])if(part.x1>part.x0&&part.y1>part.y0)next.push(part);
 }regions=next;}
 return regions;
}
function paperSampleBox(label,source){
 const b=label.bodyBox||label.box,h=b.y1-b.y0;
 return {x0:Math.max(0,b.x0-h*.5),x1:Math.min(source.width,b.x1+h*.5),y0:Math.max(0,b.y0-h*.5),y1:Math.min(source.height,b.y1+h*.5)};
}
export function renderResult(canvas,source,result,{paperState=null}={}){
 canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
 const measure=(text,font)=>{ctx.font=`700 ${font}px system-ui`;return ctx.measureText(text).width;};
 measure.ink=(text,font)=>{ctx.font=`700 ${font}px system-ui`;const m=ctx.measureText(text);return {ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent};};
 let layout=allocateLabels(result,canvas.width,canvas.height,measure);
 const compactLines=new Set(layout.omitted.filter(l=>l.geometry==='detected-region').map(l=>l.lineId));
 if(compactLines.size)layout=allocateLabels(result,canvas.width,canvas.height,measure,{compactLines});
 const samples=layout.drawn.map(l=>({rgb:sampledPaperColor(l.heightPolicy?paperSampleBox(l,source):l.bodyBox||l.box,source),weight:Math.min(5,Math.max(1,Math.sqrt((l.box.x1-l.box.x0)*(l.box.y1-l.box.y0))/30))}));
 const papers=paperState?paperState.resolve(samples):selectPapers(samples);layout.papers=papers;
 layout.drawn.forEach((l,i)=>{l.backgroundRgb=paperState?.colorFor?paperState.colorFor(samples[i].rgb,l):paperFor(samples[i].rgb,papers);l.backgroundColor='rgb('+l.backgroundRgb.join(',')+')';l.foregroundColor=foregroundFor(l.backgroundRgb);});
 const preserved=result.lines.flatMap(l=>l.glyphs.map(g=>({...g,ownerLineId:l.id}))).filter(g=>!layout.drawn.some(label=>labelReplacesGlyph(label,g,g.ownerLineId))).map(g=>g.box);
 // First clear the entire source word, independently of its new text position.
 // Draw all backgrounds before any text, so no later mask erases a label.
 for(const label of layout.drawn){
  const b=label.box,body=label.bodyBox||b,pad=label.geometry==='detected-region'?Math.max(4,Math.ceil((body.y1-body.y0)*.35)):Math.max(2,Math.min(6,Math.ceil((body.y1-body.y0)*.08))),sourceBox={x0:Math.max(0,b.x0-pad),x1:Math.min(canvas.width,b.x1+pad),y0:label.heightPolicy?label.displayBox.y0:Math.max(0,b.y0-pad),y1:Math.min(canvas.height,b.y1+pad)};
  label.eraseRegions=visibleRegions(sourceBox,preserved);label.textRegions=visibleRegions(label.displayBox,preserved);
  if(label.heightPolicy){label.backgroundPatch=makePaperPatch(source,label,()=>canvas.ownerDocument?canvas.ownerDocument.createElement('canvas'):new canvas.constructor(1,1));}
  ctx.save();ctx.beginPath();for(const r of [...label.eraseRegions,...label.textRegions])ctx.rect(r.x0,r.y0,r.x1-r.x0,r.y1-r.y0);ctx.clip();
  if(label.backgroundPatch){const p=label.backgroundPatch;ctx.drawImage(p.canvas,p.x,p.y);}else{ctx.fillStyle=label.backgroundColor;ctx.fillRect(0,0,canvas.width,canvas.height);}
  ctx.restore();
 }
 for(const label of layout.drawn){
  const b=label.displayBox;ctx.save();ctx.beginPath();for(const r of label.textRegions)ctx.rect(r.x0,r.y0,r.x1-r.x0,r.y1-r.y0);ctx.clip();ctx.translate((b.x0+b.x1)/2,label.textCenterY??(b.y0+b.y1)/2);ctx.scale(label.horizontalScale,label.verticalScale??1);ctx.font=`700 ${label.fontSize}px system-ui`;ctx.textAlign='center';ctx.textBaseline=label.textBaseline||'middle';ctx.fillStyle=label.foregroundColor;
  label.rows.forEach((row,i)=>ctx.fillText(row,0,(i-(label.rows.length-1)/2)*label.fontSize+(label.textOffsetY||0)));ctx.restore();
 }
 return layout;
}
