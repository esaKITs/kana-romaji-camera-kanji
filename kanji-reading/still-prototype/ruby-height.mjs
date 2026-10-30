// Display geometry only. OCR regions and reading decisions remain unchanged.
export const defaultUpperRatio=.5;
const contains=(a,b)=>a&&b.x0>=a.x0-.5&&b.x1<=a.x1+.5&&b.y0>=a.y0-.5&&b.y1<=a.y1+.5;
export function labelReplacesGlyph(label,glyph,lineId){
 if(label.geometry==='detected-region'){
  const rubyIds=label.coveredRubyLineIds??label.rubyLineIds??[];
  return lineId===label.lineId&&contains(label.bodyBox||label.box,glyph.box)||rubyIds.includes(lineId)&&contains(label.rubyBox,glyph.box);
 }
 return contains(label.box,glyph.box)||label.coversRuby&&contains(label.rubyBox,glyph.box);
}
export function applyRubyHeightPolicy(result){
 const {lines}=result,associations=[];
 for(const ruby of lines.filter(l=>l.regionType==='ルビ候補')){
  const r=ruby.box,rh=r.y1-r.y0,rw=r.x1-r.x0;
  const parents=lines.filter(main=>{
   if(main.regionType!=='本文候補'||!main.sourceRegions?.some(q=>(q.text===ruby.parentText||q.sourceTexts?.includes(ruby.parentText))))return false;
   const b=main.box,h=b.y1-b.y0,gap=b.y0-r.y1,overlap=Math.max(0,Math.min(b.x1,r.x1)-Math.max(b.x0,r.x0));
   return h>rh*1.12&&gap>=-rh*.5&&gap<Math.max(24,rh*1.3)&&overlap/Math.max(1,Math.min(rw,b.x1-b.x0))>.24;
  });
  if(parents.length===1)associations.push({lineId:parents[0].id,rubyLineId:ruby.id,rubyBox:r});
 }
 const samples=[];
 for(const main of lines){
  const attached=associations.filter(a=>a.lineId===main.id);
  if(attached.length){const h=main.box.y1-main.box.y0;samples.push((main.box.y0-Math.min(...attached.map(a=>a.rubyBox.y0)))/h);}
 }
 samples.sort((a,b)=>a-b);
 const upperRatio=samples.length?samples[Math.floor(samples.length/2)]:defaultUpperRatio;
 const labels=result.labels.map(label=>{
  if(label.geometry!=='detected-region')return label;
  const body=label.bodyBox||label.box,h=body.y1-body.y0;
  // Only annotations of actually converted Han/number text are replaceable.
  const attached=label.convertedHan?associations.filter(a=>a.lineId===label.lineId&&(!label.rubyLineIds||label.rubyLineIds.includes(a.rubyLineId))):[];
  const rubyBox=attached.length?{x0:Math.min(...attached.map(a=>a.rubyBox.x0)),y0:Math.min(...attached.map(a=>a.rubyBox.y0)),x1:Math.max(...attached.map(a=>a.rubyBox.x1)),y1:Math.max(...attached.map(a=>a.rubyBox.y1))}:null;
  const box=rubyBox?{x0:Math.min(body.x0,rubyBox.x0),y0:Math.min(body.y0,rubyBox.y0),x1:Math.max(body.x1,rubyBox.x1),y1:Math.max(body.y1,rubyBox.y1)}:body;
  const requestedTop=Math.max(0,Math.min(body.y0-h*upperRatio,rubyBox?.y0??body.y0)-h*.1);
  return {...label,box,bodyBox:body,rubyBox,rubyLineIds:attached.map(a=>a.rubyLineId),coversRuby:Boolean(rubyBox),heightPolicy:{upperRatio,requestedTop,source:samples.length?'observed-ruby':'default'}};
 });
 return {...result,labels,rubyHeightPolicy:{upperRatio,source:samples.length?'observed-ruby':'default',sampleCount:samples.length,associations}};
}
