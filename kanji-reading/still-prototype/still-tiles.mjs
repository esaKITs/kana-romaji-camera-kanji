// Still-mode tiled detection: preserve original pixels and image coordinates.
export async function scanStillTiles(source, scan, id, {tileHeight=400, overlap=80}={}) {
 const width=source.width,height=source.height;
 if(!(width>0&&height>0&&tileHeight>overlap&&overlap>=0))throw Error('Invalid still scan dimensions');
 const starts=[];for(let y=0;y<height;y+=tileHeight-overlap){starts.push(y);if(y+tileHeight>=height)break;}
 const lines=[],tiles=[],diagnostics={detectorProposals:[],detectionRegions:[]};
 const shifted=(box,y)=>Array.isArray(box)?[box[0],box[1]+y,box[2],box[3]+y]:box;
 for(let i=0;i<starts.length;i++){
  const y=starts[i],h=Math.min(tileHeight,height-y),tile=document.createElement('canvas');
  tile.width=width;tile.height=h;tile.getContext('2d').drawImage(source,0,y,width,h,0,0,width,h);
  const snapshot=await scan(tile,id+'-'+i);
  // Assign overlap to exactly one tile by midpoint, rather than guessing text.
  const lower=i===0?0:(starts[i-1]+Math.min(tileHeight,height-starts[i-1])+y)/2;
  const upper=i===starts.length-1?height:(y+h+starts[i+1])/2;
  for(const line of snapshot.lines||[]){
   const box=shifted(line.box,y),mid=(box[1]+box[3])/2;
   if(mid<lower||mid>=upper)continue;
   lines.push({...line,box,glyphs:(line.glyphs||[]).map(g=>({...g,box:shifted(g.box,y)}))});
  }
  for(const key of ['detectorProposals','detectionRegions'])for(const entry of snapshot.diagnostics?.[key]||[]){
   const box=shifted(entry.box,y),mid=(box[1]+box[3])/2;
   if(mid>=lower&&mid<upper)diagnostics[key].push({...entry,box});
  }
  tiles.push({y,height:h,detected:(snapshot.lines||[]).length});
 }
 return {width,height,lines,diagnostics:{...diagnostics,stillTiles:tiles}};
}
