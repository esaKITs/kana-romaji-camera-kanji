
// Detect horizontal text bands from image ink density before running OCR.
// This is a geometry-only proposal stage: it never guesses Japanese readings.
function adaptiveBands(source,{maxBands=18,minHeight=48,pad=22}={}){
 const w=source.width,h=source.height,scale=Math.min(1,800/Math.max(w,h));
 const cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
 const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,cw,ch);
 const pixels=ctx.getImageData(0,0,cw,ch).data,counts=new Array(ch).fill(0);
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
  const i=(y*cw+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
  if(Math.max(r,g,b)<175&&Math.max(r,g,b)-Math.min(r,g,b)<75)counts[y]++;
 }
 const threshold=Math.max(2,Math.floor(cw*.008)),active=counts.map(n=>n>=threshold);
 const spans=[];let start=-1;
 for(let y=0;y<=ch;y++){if(y<ch&&active[y]&&start<0)start=y;if(start>=0&&(y===ch||!active[y])){spans.push([start,y]);start=-1;}}
 if(!spans.length)return [];
 const merged=[];
 for(const s of spans){const last=merged[merged.length-1];if(last&&s[0]-last[1]<=Math.max(4,Math.round(12*scale)))last[1]=s[1];else merged.push([...s]);}
 const bands=merged.map(([a,b])=>[Math.max(0,Math.floor(a/scale)-pad),Math.min(h,Math.ceil(b/scale)+pad)]);
 const combined=[];
 for(const band of bands){const last=combined[combined.length-1];if(last&&band[0]<=last[1])last[1]=Math.max(last[1],band[1]);else combined.push([...band]);}
 if(combined.length>maxBands)return [];
 return combined.filter(([a,b])=>b-a>=Math.min(minHeight,h)).map(([y,bottom])=>({x:0,y,width:w,height:bottom-y}));
}
async function scanAdaptive(source,scan,id){
 const width=source.width,height=source.height;
 const bands=adaptiveBands(source);
 if(!bands.length)return null;
 const lines=[],diagnostics={detectorProposals:[],detectionRegions:[]},tiles=[];
 for(let i=0;i<bands.length;i++){
  const {x,y,width:w,height:h}=bands[i],tile=document.createElement('canvas');
  tile.width=w;tile.height=h;tile.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);
  const snapshot=await scan(tile,id+'-adaptive-'+i);
  const shift=b=>Array.isArray(b)?[b[0]+x,b[1]+y,b[2]+x,b[3]+y]:b&&typeof b==='object'?{...b,x0:b.x0+x,x1:b.x1+x,y0:b.y0+y,y1:b.y1+y}:b;
  for(const line of snapshot.lines||[])lines.push({...line,box:shift(line.box),glyphs:(line.glyphs||[]).map(g=>({...g,box:shift(g.box)}))});
  for(const key of ['detectorProposals','detectionRegions'])for(const entry of snapshot.diagnostics?.[key]||[])diagnostics[key].push({...entry,box:shift(entry.box)});
  tiles.push({x,y,width:w,height:h,detected:(snapshot.lines||[]).length});
 }
 return {width,height,lines,diagnostics:{...diagnostics,stillTiles:tiles,scanLayout:'adaptive-horizontal-bands'}};
}
// Four rows by two columns; scan top to bottom and left to right.
// Overlap protects text at tile edges; midpoint ownership avoids duplicate lines.
export async function scanStillTiles(source, scan, id, {rows=4,columns=2,overlapX=60,overlapY=80,adaptive=false}={}) {
 const width=source.width,height=source.height;
 if(!(width>0&&height>0&&rows>0&&columns>0))throw Error('Invalid still scan dimensions');
 if(adaptive){const result=await scanAdaptive(source,scan,id);if(result)return result;}
 // Keep the established horizontal-textbook scan for wide, short images.
 // The 4x2 experiment targets portrait pages, where the right edge was missed.
 if(width>height){
  const tileHeight=400,overlap=80,starts=[];
  for(let y=0;y<height;y+=tileHeight-overlap){starts.push(y);if(y+tileHeight>=height)break;}
  const lines=[],tiles=[],diagnostics={detectorProposals:[],detectionRegions:[]};
  const shift=(b,y)=>Array.isArray(b)?[b[0],b[1]+y,b[2],b[3]+y]:b;
  for(let i=0;i<starts.length;i++){
   const y=starts[i],h=Math.min(tileHeight,height-y),tile=document.createElement('canvas');
   tile.width=width;tile.height=h;tile.getContext('2d').drawImage(source,0,y,width,h,0,0,width,h);
   const snapshot=await scan(tile,id+'-wide-'+i);
   const lower=i===0?0:(starts[i-1]+Math.min(tileHeight,height-starts[i-1])+y)/2;
   const upper=i===starts.length-1?height:(y+h+starts[i+1])/2;
   for(const line of snapshot.lines||[]){const box=shift(line.box,y),mid=(box[1]+box[3])/2;if(mid<lower||mid>=upper)continue;lines.push({...line,box,glyphs:(line.glyphs||[]).map(g=>({...g,box:shift(g.box,y)}))});}
   for(const key of ['detectorProposals','detectionRegions'])for(const entry of snapshot.diagnostics?.[key]||[]){const box=shift(entry.box,y),mid=(box[1]+box[3])/2;if(mid>=lower&&mid<upper)diagnostics[key].push({...entry,box});}
   tiles.push({y,height:h,detected:(snapshot.lines||[]).length});
  }
  return {width,height,lines,diagnostics:{...diagnostics,stillTiles:tiles,scanLayout:'wide-horizontal-strips'}};
 }
 const xEdges=Array.from({length:columns+1},(_,i)=>Math.round(i*width/columns));
 const yEdges=Array.from({length:rows+1},(_,i)=>Math.round(i*height/rows));
 const lines=[],tiles=[],diagnostics={detectorProposals:[],detectionRegions:[]};
 const shifted=(box,x,y)=>Array.isArray(box)?[box[0]+x,box[1]+y,box[2]+x,box[3]+y]:box&&typeof box==='object'?{...box,x0:box.x0+x,x1:box.x1+x,y0:box.y0+y,y1:box.y1+y}:box;
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const x=Math.max(0,xEdges[col]-overlapX),y=Math.max(0,yEdges[row]-overlapY);
  const right=Math.min(width,xEdges[col+1]+overlapX),bottom=Math.min(height,yEdges[row+1]+overlapY);
  const w=right-x,h=bottom-y,tile=document.createElement('canvas');
  tile.width=w;tile.height=h;tile.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);
  const snapshot=await scan(tile,id+'-'+row+'-'+col);
  // A detected line is owned by the cell containing its center.

  for(const line of snapshot.lines||[]){
   const box=shifted(line.box,x,y);
   lines.push({...line,box,glyphs:(line.glyphs||[]).map(g=>({...g,box:shifted(g.box,x,y)}))});
  }
  for(const key of ['detectorProposals','detectionRegions'])for(const entry of snapshot.diagnostics?.[key]||[]){
   const box=shifted(entry.box,x,y);diagnostics[key].push({...entry,box});
  }
  tiles.push({row,col,x,y,width:w,height:h,detected:(snapshot.lines||[]).length});
 }
 // Deduplicate only near-identical readings of the same ink from overlapping tiles.
 const area=b=>Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1]);
 const intersection=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 const unique=[];
 for(const line of lines){
  const duplicate=unique.findIndex(old=>Array.isArray(old.box)&&Array.isArray(line.box)&&intersection(old.box,line.box)/Math.max(1,Math.min(area(old.box),area(line.box)))>=.8&&old.text===line.text);
  if(duplicate<0)unique.push(line);
  else if((line.glyphs?.length||0)>(unique[duplicate].glyphs?.length||0))unique[duplicate]=line;
 }
 return {width,height,lines:unique,diagnostics:{...diagnostics,stillTiles:tiles,deduplicatedLines:lines.length-unique.length}};
}
