// Opacity affects the replacement paper only. Romaji remains fully readable.
export const sourceLevels=[0,25,55,100];
export function paintLabels(canvas,source,layout,{still=false,reveal=0}={}){
 canvas.width=source.width;canvas.height=source.height;const x=canvas.getContext('2d');
 if(still)x.drawImage(source,0,0);
 x.globalAlpha=1-(sourceLevels.includes(reveal)?reveal:0)/100;
 // Union rectangles per label so overlapping erase/text regions are not darkened twice.
 for(const l of layout.drawn){x.save();x.beginPath();for(const b of [...l.eraseRegions,...l.textRegions])x.rect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);x.clip();x.fillStyle=l.backgroundColor;x.fillRect(0,0,canvas.width,canvas.height);x.restore();}
 x.globalAlpha=1;
 for(const l of layout.drawn){const b=l.displayBox;x.save();x.beginPath();for(const r of l.textRegions)x.rect(r.x0,r.y0,r.x1-r.x0,r.y1-r.y0);x.clip();x.translate((b.x0+b.x1)/2,(b.y0+b.y1)/2);x.scale(l.horizontalScale,1);x.font=`700 ${l.fontSize}px system-ui`;x.textAlign='center';x.textBaseline='middle';x.fillStyle=l.foregroundColor;
  if(reveal){x.strokeStyle=l.foregroundColor==='#ffffff'?'#15212a':'#ffffff';x.lineWidth=Math.max(1,l.fontSize*.07);x.lineJoin='round';l.rows.forEach((r,i)=>x.strokeText(r,0,(i-(l.rows.length-1)/2)*l.fontSize));}
  l.rows.forEach((r,i)=>x.fillText(r,0,(i-(l.rows.length-1)/2)*l.fontSize));x.restore();
 }
}
