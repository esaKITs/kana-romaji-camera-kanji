// Keep distant measured regions separate: their combined bounding rectangle can
// exceed the worker input limit even though every individual text crop fits.
export async function scanRegionalCrops(source,regions,scanOne){
 const lines=[],diagnostics={detectorProposals:[],detectionRegions:[],recognitionViewports:[]};
 let index=0;
 for(const region of regions){
  const oversized=(region[2]-region[0])*(region[3]-region[1])>4000000,pieces=[];
  if(oversized){for(let y=region[1];y<region[3];y+=464){for(let x=region[0];x<region[2];x+=832){pieces.push([x,y,Math.min(region[2],x+960),Math.min(region[3],y+544)]);if(x+960>=region[2])break;}if(y+544>=region[3])break;}}
  else pieces.push(region);
  for(const piece of pieces){
  const result=await scanOne(piece,index++,oversized);lines.push(...result.lines);
  for(const key of ['detectorProposals','detectionRegions'])diagnostics[key].push(...(result.diagnostics?.[key]||[]));
  if(result.diagnostics?.recognitionViewport)diagnostics.recognitionViewports.push(result.diagnostics.recognitionViewport);
  }
 }
 return{width:source.width,height:source.height,lines,diagnostics};
}
