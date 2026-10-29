// Display-only paper repair. Never passed to OCR. A closing (light paper) or
// opening (dark paper) removes small foreground strokes while retaining local
// paper colors and straight color-panel boundaries, instead of a flat rectangle.
function extrema(input,width,height,radius,maximum,horizontal){
 const output=new Uint8ClampedArray(input.length),length=horizontal?width:height,count=horizontal?height:width;
 const queue=new Int32Array(length),at=(line,pos)=>horizontal?line*width+pos:pos*width+line;
 for(let line=0;line<count;line++)for(let channel=0;channel<3;channel++){
  let head=0,tail=0,next=0;
  for(let pos=0;pos<length;pos++){
   for(;next<=Math.min(length-1,pos+radius);next++){
    const value=input[at(line,next)*4+channel];
    while(tail>head&&(maximum?input[at(line,queue[tail-1])*4+channel]<=value:input[at(line,queue[tail-1])*4+channel]>=value))tail--;
    queue[tail++]=next;
   }
   while(queue[head]<pos-radius)head++;
   output[at(line,pos)*4+channel]=input[at(line,queue[head])*4+channel];
  }
 }
 for(let i=3;i<output.length;i+=4)output[i]=255;
 return output;
}
export function repairedPaperPixels(input,width,height,radius,paper){
 const light=paper[0]*.299+paper[1]*.587+paper[2]*.114>145;
 let data=input;
 for(const [maximum,horizontal] of [[light,true],[light,false],[!light,true],[!light,false]])data=extrema(data,width,height,radius,maximum,horizontal);
 // Broad solid ink can exceed the filter kernel. Use nearby repaired paper
 // rather than retaining that ink. The representative is only the last resort.
 const luminance=(p,i)=>p[i]*.299+p[i+1]*.587+p[i+2]*.114,base=paper[0]*.299+paper[1]*.587+paper[2]*.114;
 const isPaper=i=>light?luminance(data,i)>=Math.max(160,base-65):luminance(data,i)<=Math.min(110,base+65);
 const repaired=new Uint8ClampedArray(data);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;if(isPaper(i))continue;
  let chosen=null;
  for(let d=radius;d<=radius*8&&!chosen;d+=radius)for(const [dx,dy] of [[0,-d],[0,d],[-d,0],[d,0],[-d,-d],[d,-d],[-d,d],[d,d]]){
   const xx=x+dx,yy=y+dy;if(xx<0||xx>=width||yy<0||yy>=height)continue;
   const j=(yy*width+xx)*4;if(isPaper(j)){chosen=data.subarray(j,j+3);break;}
  }
  repaired.set(chosen||paper,i);
 }
 return repaired;
}
export function makePaperPatch(source,label,makeCanvas){
 const regions=[...label.eraseRegions,...label.textRegions],h=(label.bodyBox||label.box).y1-(label.bodyBox||label.box).y0,radius=Math.max(2,Math.ceil(h*.22));
 const x0=Math.max(0,Math.floor(Math.min(...regions.map(r=>r.x0))-radius*2)),y0=Math.max(0,Math.floor(Math.min(...regions.map(r=>r.y0))-radius*2));
 const x1=Math.min(source.width,Math.ceil(Math.max(...regions.map(r=>r.x1))+radius*2)),y1=Math.min(source.height,Math.ceil(Math.max(...regions.map(r=>r.y1))+radius*2));
 if(x1<=x0||y1<=y0)return null;
 const canvas=makeCanvas(),width=x1-x0,height=y1-y0;canvas.width=width;canvas.height=height;
 const pixels=source.getContext('2d',{willReadFrequently:true}).getImageData(x0,y0,width,height),ctx=canvas.getContext('2d');
 pixels.data.set(repairedPaperPixels(pixels.data,width,height,radius,label.backgroundRgb));ctx.putImageData(pixels,0,0);
 return {canvas,x:x0,y:y0};
}
