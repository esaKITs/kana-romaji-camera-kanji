// One transform for the composited image, romaji and position guides.
export class StillViewport{
 constructor(){this.reset();this.resize(1,1,1,1);}
 reset(){this.scale=1;this.x=0;this.y=0;}
 resize(width,height,imageWidth,imageHeight){
  this.width=Math.max(1,width);this.height=Math.max(1,height);
  const fit=Math.min(this.width/Math.max(1,imageWidth),this.height/Math.max(1,imageHeight));
  this.imageWidth=imageWidth*fit;this.imageHeight=imageHeight*fit;this.clamp();
 }
 clamp(){const dx=Math.max(0,(this.imageWidth*this.scale-this.width)/2),dy=Math.max(0,(this.imageHeight*this.scale-this.height)/2);this.x=Math.max(-dx,Math.min(dx,this.x));this.y=Math.max(-dy,Math.min(dy,this.y));}
 pan(x,y){this.x+=x;this.y+=y;this.clamp();}
 zoom(scale,anchorX=0,anchorY=0){const next=Math.max(1,Math.min(8,scale)),ratio=next/this.scale;this.x=anchorX-(anchorX-this.x)*ratio;this.y=anchorY-(anchorY-this.y)*ratio;this.scale=next;this.clamp();}
 transform(){return `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;}
}
export function bindStillZoom(layer,source){
 const view=new StillViewport(),points=new Map();let active=false,lastTap=null,gesture=null;
 const paint=()=>{layer.style.transform=active?view.transform():'';};
 function resize(){if(!active)return;const rect=layer.parentElement.getBoundingClientRect(),image=source();view.resize(rect.width,rect.height,image?.width||1,image?.height||1);paint();}
 const distance=()=>{const p=[...points.values()];return p.length===2?Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y):0;};
 layer.addEventListener('pointerdown',event=>{
  if(!active||event.pointerType==='mouse'&&event.button!==0||points.size>=2)return;
  event.preventDefault();layer.setPointerCapture(event.pointerId);points.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(points.size===1)gesture={x:event.clientX,y:event.clientY,moved:false,multi:false,time:event.timeStamp};else {gesture={x:event.clientX,y:event.clientY,moved:false,multi:true,time:event.timeStamp};lastTap=null;}
 });
 layer.addEventListener('pointermove',event=>{
  if(!active||!points.has(event.pointerId))return;event.preventDefault();
  const previous=points.get(event.pointerId),oldDistance=distance(),old=[...points.values()],mid=old.length===2?{x:(old[0].x+old[1].x)/2,y:(old[0].y+old[1].y)/2}:null;
  points.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6)gesture.moved=true;
  if(points.size===2&&oldDistance>0){
   const rect=layer.parentElement.getBoundingClientRect();view.zoom(view.scale*distance()/oldDistance,mid.x-rect.left-rect.width/2,mid.y-rect.top-rect.height/2);
   view.pan((event.clientX-previous.x)/2,(event.clientY-previous.y)/2);
  }else if(view.scale>1)view.pan(event.clientX-previous.x,event.clientY-previous.y);
  paint();
 });
 function end(event){
  if(!points.has(event.pointerId))return;points.delete(event.pointerId);
  if(event.type==='pointerup'&&!points.size&&!gesture.multi&&!gesture.moved&&event.timeStamp-gesture.time<300){
   if(lastTap&&event.timeStamp-lastTap.time<350&&Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<30){view.reset();paint();lastTap=null;}
   else lastTap={time:event.timeStamp,x:event.clientX,y:event.clientY};
  }else lastTap=null;
 }
 for(const type of ['pointerup','pointercancel','lostpointercapture'])layer.addEventListener(type,end);
 layer.addEventListener('dblclick',event=>{if(active){event.preventDefault();view.reset();paint();}});
 return {setActive(value){if(active===value){resize();return;}active=value;points.clear();gesture=null;lastTap=null;view.reset();resize();paint();},reset(){points.clear();lastTap=null;view.reset();resize();},resize,view};
}
