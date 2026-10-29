import {labelReplacesGlyph} from './ruby-height.mjs';
// Horizontal Still allocator. Measurement is injected so geometry can be tested
// independently of fonts. Never borrow pixels occupied by preserved glyphs.
const overlap=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.y1,b.y1)>Math.max(a.y0,b.y0);
function rowsFor(text,measure){
 const chars=[...text];let best=null;
 for(let i=1;i<chars.length;i++){
  const rows=[chars.slice(0,i).join(''),chars.slice(i).join('')];
  // Do not strand a word separator at either end.
  if(rows.some(r=>r.trim()!==r))continue;
  const width=Math.max(...rows.map(measure));
  if(!best||width<best.width)best={rows,width};
 }
 return best;
}
export function allocateLabels(result,width,height,measure,{minScale=.70,compactLines=new Set()}={}){
 const drawn=[],omitted=[],occupied=[];
 const regionBodies=result.labels.filter(l=>l.geometry==='detected-region').map(l=>l.bodyBox||l.box);
 // Region envelopes vary with kana shape. Labels on the same body baseline use
 // the same nominal font, without inventing any per-character coordinates.
 const rowHeight=b=>{const h=b.y1-b.y0,neighbors=regionBodies.filter(q=>{const qh=q.y1-q.y0;return qh>=h*.6&&qh<=h/ .6&&Math.abs(q.y1-b.y1)<=Math.max(h,qh)*.45;}).map(q=>q.y1-q.y0).sort((a,b)=>a-b);return neighbors.length?Math.max(h*.75,Math.min(h*1.15,(neighbors[Math.floor((neighbors.length-1)/2)]+neighbors[Math.floor(neighbors.length/2)])/2)):h;};
 for(const line of result.lines){
  const labels=result.labels.filter(l=>l.lineId===line.id).sort((a,b)=>a.box.x0-b.box.x0);
  const protectedGlyphs=result.lines.flatMap(l=>l.glyphs.map(g=>({...g,ownerLineId:l.id}))).filter(g=>!labels.some(label=>labelReplacesGlyph(label,g,g.ownerLineId)));
  // Curved packaging/slanted baselines enlarge the union box without enlarging
  // the characters. Use character height rather than the whole line's envelope.
  const heights=line.glyphs.map(g=>g.box.y1-g.box.y0).filter(h=>Number.isFinite(h)&&h>0).sort((a,b)=>a-b);
  const characterHeight=heights.length?heights[Math.floor(heights.length/2)]:line.box.y1-line.box.y0;
  const regionLabels=labels.some(l=>l.geometry==='detected-region');
  const font=regionLabels?rowHeight(labels[0].bodyBox||labels[0].box)*(compactLines.has(line.id)?.56:.85):Math.min(line.box.y1-line.box.y0,characterHeight)*.56;
  const cells=labels.map(label=>{
   const b=label.bodyBox||label.box,obstacles=protectedGlyphs.map(g=>g.box).filter(q=>q.y0<b.y1&&q.y1>b.y0).filter(q=>label.geometry!=='detected-region'||Math.min(q.y1,b.y1)-Math.max(q.y0,b.y0)>(b.y1-b.y0)*.2);
   const center=(b.x0+b.x1)/2;
   return{label,left:Math.max(0,...obstacles.filter(q=>q.x1<=center).map(q=>q.x1+1)),right:Math.min(width,...obstacles.filter(q=>q.x0>=center).map(q=>q.x0-1)),blocked:obstacles.some(q=>q.x0<center&&q.x1>center)};
  });
  const groups=[];
  for(const cell of cells){const group=groups.at(-1);if(group&&group.at(-1).right===cell.right&&group[0].left===cell.left&&!cell.blocked&&!group[0].blocked)group.push(cell);else groups.push([cell]);}
  for(const group of groups){
   const left=group[0].left,right=group.at(-1).right,available=right-left,gap=2,padding=4;
   let items=group.map(c=>({...c,rows:[c.label.output],font,natural:measure(c.label.output,font)}));
   const required=()=>items.reduce((n,i)=>n+i.natural*minScale+padding,0)+gap*(items.length-1);
   if(required()>available||!anchorBounds(minScale)){
    const options=items.map((item,index)=>({index,split:rowsFor(item.label.output,t=>measure(t,font*.82)),h:item.label.box.y1-item.label.box.y0})).filter(o=>o.split&&font*.82*2<=o.h).sort((a,b)=>(items[b.index].natural-b.split.width)-(items[a.index].natural-a.split.width));
    for(const option of options){if(required()<=available&&anchorBounds(minScale))break;const item=items[option.index];item.rows=option.split.rows;item.font=font*.82;item.natural=option.split.width;}
   }
   // Allocate in source order; a shared scale preserves typographic consistency.
   const natural=items.reduce((n,i)=>n+i.natural,0);let scale=Math.min(1,(available-padding*items.length-gap*(items.length-1))/Math.max(1,natural));
   // A row may fit while early words push a short particle past its source.
   function anchorBounds(s){
    const bounds=[];let edge=left;
    for(const item of items){const w=item.natural*s+padding,b=item.label.box,low=Math.max(edge,b.x0+1-w),high=Math.min(right-w,b.x1-1);if(low>high)return null;bounds.push({low,high});edge=low+w+gap;}
    return bounds;
   }
   while(scale>=minScale&&!anchorBounds(scale)){if(scale===minScale){scale=minScale-.01;break;}scale=Math.max(minScale,scale-.01);}
   if(scale<minScale||group.some(c=>c.blocked)){
    // A crowded group must not suppress unrelated labels that still fit locally.
    for(const cell of group){const b=cell.label.box;const clipped={...b,x0:Math.max(b.x0,cell.left),x1:Math.min(b.x1,cell.right)};const w=clipped.x1-clipped.x0;const s=Math.min(1,(w-padding)/Math.max(1,measure(cell.label.output,font)));
     if(!cell.blocked&&s>=minScale)place(cell.label,[cell.label.output],font,s,clipped);
     else if(!cell.blocked){
      const split=rowsFor(cell.label.output,t=>measure(t,font*.82)),wrappedScale=split?Math.min(1,(w-padding)/Math.max(1,split.width)):0;
      if(split&&font*.82*2<=b.y1-b.y0&&wrappedScale>=minScale)place(cell.label,split.rows,font*.82,wrappedScale,clipped);
      else omitted.push({...cell.label,reason:'line-allocation-required'});
     }
     else omitted.push({...cell.label,reason:cell.blocked?'protected-glyph-collision':'line-allocation-required'});
    }
    continue;
   }
   const widths=items.map(i=>i.natural*scale+padding),total=widths.reduce((a,b)=>a+b,0)+gap*(items.length-1);
   // Keep each word at its own source center. Only move it when a neighbor
   // needs room; do not compact a whole line into one centered text strip.
   const bounds=anchorBounds(scale);
   const positions=items.map((item,i)=>Math.max(bounds[i].low,Math.min(bounds[i].high,((item.label.bodyBox||item.label.box).x0+(item.label.bodyBox||item.label.box).x1-widths[i])/2)));
   let edge=left;
   for(let i=0;i<items.length;i++){positions[i]=Math.max(edge,positions[i]);edge=positions[i]+widths[i]+gap;}
   edge=right;
   for(let i=items.length-1;i>=0;i--){positions[i]=Math.min(positions[i],bounds[i].high,edge-widths[i]);edge=positions[i]-gap;}
   for(let i=0;i<items.length;i++){
    const item=items[i],b=item.label.box,anchor=item.label.bodyBox||b,x=positions[i],rect={x0:x,x1:x+widths[i],y0:Math.max(0,anchor.y0),y1:Math.min(height,anchor.y1)};
    if(rect.x0<left-.01||rect.x1>right+.01||rect.x1<=b.x0||rect.x0>=b.x1)omitted.push({...item.label,reason:'source-anchor-displaced'});
    else place(item.label,item.rows,item.font,scale,rect);
   }
  }
 }
 function place(label,rows,font,scale,rect){
  if(occupied.some(q=>overlap(q,rect))){omitted.push({...label,reason:'label-collision'});return;}
  // Stretch glyphs vertically, never horizontally. Reserve headroom for furigana,
  // but stop before another source line or an already placed label.
  const body=label.bodyBox||label.box,bodyHeight=Math.max(1,body.y1-body.y0);
  const desiredTop=label.heightPolicy?.requestedTop??(label.coversRuby?body.y0:Math.max(0,body.y0-bodyHeight*.5));
  const pad=label.heightPolicy?Math.max(4,Math.ceil(bodyHeight*.35)):0;
  const left=Math.min(rect.x0,label.box.x0-pad),right=Math.max(rect.x1,label.box.x1+pad);
  const blockers=result.lines.flatMap(line=>line.glyphs.map(g=>({...g,ownerLineId:line.id,regionType:line.regionType})))
   .filter(g=>!labelReplacesGlyph(label,g,g.ownerLineId))
   // An adjacent word's ruby may touch the padded erase box without touching
   // this text. Clip that ink in the mask; do not shrink the whole label for it.
   .filter(g=>g.regionType!=='ルビ候補'||g.box.x0<rect.x1&&g.box.x1>rect.x0).map(g=>g.box)
   .filter(q=>q.y1<=body.y0&&q.x0<right&&q.x1>left);
  const priorBottom=blockers.length?Math.max(...blockers.map(q=>q.y1+(label.heightPolicy?Math.max(2,(q.y1-q.y0)*.2):2))):0;
  const top=Math.min(rect.y0,Math.max(desiredTop,priorBottom));
  const tallRect={...rect,y0:top};
  const textHeight=Math.max(1,font*rows.length);
  const regionLabel=label.geometry==='detected-region';
  const ink=regionLabel&&measure.ink?rows.map(row=>measure.ink(row,font)):null;
  const ascent=ink?Math.max(...ink.map(m=>m.ascent)):font*.8,descent=ink?Math.max(...ink.map(m=>m.descent)):font*.2;
  const inkHeight=ascent+descent+font*(rows.length-1);
  const verticalScale=regionLabel?Math.min(label.heightPolicy?Math.max(.5,scale*1.65):2.2,Math.max(.5,(tallRect.y1-tallRect.y0)*.88/Math.max(1,inkHeight))):Math.min(1.55,Math.max(1,(tallRect.y1-tallRect.y0-2)/textHeight));
  if(occupied.some(q=>overlap(q,tallRect))){omitted.push({...label,reason:'extended-label-collision'});return;}
  const coveredRubyLineIds=label.heightPolicy?(label.rubyLineIds||[]).filter(id=>{const q=result.lines.find(l=>l.id===id)?.box;return q&&q.y0>=top&&q.y1<=body.y1;}):undefined;
  occupied.push(tallRect);drawn.push({...label,...(coveredRubyLineIds?{coveredRubyLineIds,coversRuby:coveredRubyLineIds.length>0}:{}),displayBox:tallRect,horizontalScale:scale,verticalScale,fontSize:font,rows,...(regionLabel?{textBaseline:'alphabetic',textOffsetY:(ascent-descent)/2,...(label.heightPolicy?{textCenterY:Math.max(tallRect.y0+inkHeight*verticalScale/2,body.y1-bodyHeight*.12-inkHeight*verticalScale/2)}:{})}:{})});
 }
 return{drawn,omitted};
}
