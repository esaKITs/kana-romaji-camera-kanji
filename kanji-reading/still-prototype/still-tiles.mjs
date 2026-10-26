// Four rows by two columns; scan top to bottom and left to right.
// Overlap protects text at tile edges; midpoint ownership avoids duplicate lines.
export async function scanStillTiles(source, scan, id, {rows=4,columns=2,overlapX=60,overlapY=80}={}) {
 const width=source.width,height=source.height;
 if(!(width>0&&height>0&&rows>0&&columns>0))throw Error('Invalid still scan dimensions');
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
