/* Original browser-side whitespace-aware XY slicing; no third-party code copied.
 * Inspired by the general XY-cut algorithm and SAHI's MIT-licensed slicing approach.
 */
const coords=b=>Array.isArray(b)?b:b&&typeof b==='object'?[b.x0,b.y0,b.x1,b.y1]:null;
const shift=(b,x,y)=>Array.isArray(b)?[b[0]+x,b[1]+y,b[2]+x,b[3]+y]:b&&typeof b==='object'?{...b,x0:b.x0+x,x1:b.x1+x,y0:b.y0+y,y1:b.y1+y}:b;
function axisStarts(length,max){if(length<=max)return[0];const n=Math.ceil(length/max);return Array.from({length:n},(_,i)=>Math.round(i*(length-max)/(n-1)));}
export function planXYCut(source,{sliceWidth=960,sliceHeight=544,pad=24}={}){
 const w=source.width,h=source.height;if(!w||!h||sliceWidth<128||sliceHeight<128||pad<0||pad*2>=Math.min(sliceWidth,sliceHeight))throw Error('Invalid XY cut geometry');
 const sample=document.createElement('canvas');sample.width=w;sample.height=h;const ctx=sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
 const rgba=ctx.getImageData(0,0,w,h).data,rows=new Uint32Array(h),cols=new Uint32Array(w);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if((rgba[i]*.299+rgba[i+1]*.587+rgba[i+2]*.114)<185){rows[y]++;cols[x]++;}}
 const maxW=sliceWidth-2*pad,maxH=sliceHeight-2*pad,queue=[{x0:0,y0:0,x1:w,y1:h}],cores=[];
 const best=(profile,start,end,max)=>{const lo=start+Math.max(24,Math.floor(max*.2)),hi=end-Math.max(24,Math.floor(max*.2));if(lo>hi)return null;const ideal=Math.min(end-1,start+max);let cut=null,cost=Infinity;for(let k=lo;k<=Math.min(hi,ideal);k++){let ink=0;for(let j=Math.max(start,k-3);j<=Math.min(end-1,k+3);j++)ink+=profile[j];const score=ink*1000+(ideal-k)/max;if(score<cost){cost=score;cut=k;}}return cut;};
 while(queue.length){if(queue.length+cores.length>160)throw Error('Too many slices');const r=queue.shift(),rw=r.x1-r.x0,rh=r.y1-r.y0;if(rw<=maxW&&rh<=maxH){cores.push(r);continue;}const axis=rw/maxW>=rh/maxH?'x':'y';let k=axis==='x'?best(cols,r.x0,r.x1,maxW):best(rows,r.y0,r.y1,maxH);if(k===null){const other=axis==='x'?'y':'x';k=other==='x'?best(cols,r.x0,r.x1,maxW):best(rows,r.y0,r.y1,maxH);if(k===null)throw Error('Cannot partition image');if(other==='x')queue.push({...r,x1:k},{...r,x0:k});else queue.push({...r,y1:k},{...r,y0:k});}else if(axis==='x')queue.push({...r,x1:k},{...r,x0:k});else queue.push({...r,y1:k},{...r,y0:k});}
 return cores.sort((a,b)=>a.y0-b.y0||a.x0-b.x0).map((r,index)=>{const x=Math.max(0,r.x0-pad),y=Math.max(0,r.y0-pad),right=Math.min(w,r.x1+pad),bottom=Math.min(h,r.y1+pad);return{x,y,width:right-x,height:bottom-y,index,core:r};});
}
function dedup(lines){const kept=[];for(const line of lines){const b=coords(line.box);if(!b){kept.push(line);continue;}const area=a=>Math.max(0,a[2]-a[0])*Math.max(0,a[3]-a[1]);const i=kept.findIndex(old=>{const a=coords(old.box);if(!a||old.text!==line.text)return false;const inter=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));return inter/Math.max(1,Math.min(area(a),area(b)))>=.78;});if(i<0)kept.push(line);else if((line.glyphs?.length||0)>(kept[i].glyphs?.length||0))kept[i]=line;}return kept;}
export async function scanXYCut(source,scan,id,options={}){
 const slices=planXYCut(source,options),lines=[],tiles=[],diagnostics={detectorProposals:[],detectionRegions:[]};
 for(const s of slices){const tile=document.createElement('canvas');tile.width=s.width;tile.height=s.height;tile.getContext('2d').drawImage(source,s.x,s.y,s.width,s.height,0,0,s.width,s.height);const snapshot=await scan(tile,id+'-xy-'+s.index);for(const line of snapshot.lines||[])lines.push({...line,box:shift(line.box,s.x,s.y),glyphs:(line.glyphs||[]).map(g=>({...g,box:shift(g.box,s.x,s.y)}))});for(const key of ['detectorProposals','detectionRegions'])for(const entry of snapshot.diagnostics?.[key]||[])diagnostics[key].push({...entry,box:shift(entry.box,s.x,s.y)});tiles.push({...s,detected:(snapshot.lines||[]).length});}
 const unique=dedup(lines);return{width:source.width,height:source.height,lines:unique,diagnostics:{...diagnostics,stillTiles:tiles,scanLayout:'xycut-whitespace-slices',deduplicatedLines:lines.length-unique.length}};
}
