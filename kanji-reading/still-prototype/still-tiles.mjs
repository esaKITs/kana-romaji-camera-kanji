// Four rows by two columns; scan top to bottom and left to right.
// Overlap protects text at tile edges; midpoint ownership avoids duplicate lines.
export async function scanStillTiles(source, scan, id, {rows=4,columns=2,overlapX=60,overlapY=80}={}) {
 const width=source.width,height=source.height;
 if(!(width>0&&height>0&&rows>0&&columns>0))throw Error('Invalid still scan dimensions');
 const xEdges=Array.from({length:columns+1},(_,i)=>Math.round(i*width/columns));
 const yEdges=Array.from({length:rows+1},(_,i)=>Math.round(i*height/rows));
 const lines=[],tiles=[],diagnostics={detectorProposals:[],detectionRegions:[]};
 const shifted=(box,x,y)=>Array.isArray(box)?[box[0]+x,box[1]+y,box[2]+x,box[3]+y]:box;
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const x=Math.max(0,xEdges[col]-overlapX),y=Math.max(0,yEdges[row]-overlapY);
  const right=Math.min(width,xEdges[col+1]+overlapX),bottom=Math.min(height,yEdges[row+1]+overlapY);
  const w=right-x,h=bottom-y,tile=document.createElement('canvas');
  tile.width=w;tile.height=h;tile.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);
  const snapshot=await scan(tile,id+'-'+row+'-'+col);
  // A detected line is owned by the cell containing its center.
  const owned=box=>{if(!Array.isArray(box))return false;const cx=(box[0]+box[2])/2,cy=(box[1]+box[3])/2;return cx>=xEdges[col]&&cx<(col===columns-1?width+1:xEdges[col+1])&&cy>=yEdges[row]&&cy<(row===rows-1?height+1:yEdges[row+1]);};
  for(const line of snapshot.lines||[]){
   const box=shifted(line.box,x,y);if(!owned(box))continue;
   lines.push({...line,box,glyphs:(line.glyphs||[]).map(g=>({...g,box:shifted(g.box,x,y)}))});
  }
  for(const key of ['detectorProposals','detectionRegions'])for(const entry of snapshot.diagnostics?.[key]||[]){
   const box=shifted(entry.box,x,y);if(owned(box))diagnostics[key].push({...entry,box});
  }
  tiles.push({row,col,x,y,width:w,height:h,detected:(snapshot.lines||[]).length});
 }
 return {width,height,lines,diagnostics:{...diagnostics,stillTiles:tiles}};
}
