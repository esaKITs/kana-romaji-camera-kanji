// Focus scan is opt-in so ordinary pan/pinch gestures remain unchanged.
export function bindFocusSelection(layer,canvas,onSelect){
 let enabled=false,start=null,multi=false;const touches=new Set();
 const marker=document.createElement('div');marker.style.cssText='position:absolute;border:3px solid #18b6a4;background:#18b6a433;pointer-events:none;z-index:5;display:none;box-sizing:border-box';layer.append(marker);
 function coordinates(e){
  const r=canvas.getBoundingClientRect(),w=canvas.width,h=canvas.height;
  const scale=Math.min(r.width/w,r.height/h),iw=w*scale,ih=h*scale;
  const left=r.left+(r.width-iw)/2,top=r.top+(r.height-ih)/2;
  return {x:Math.max(0,Math.min(w,(e.clientX-left)/scale)),y:Math.max(0,Math.min(h,(e.clientY-top)/scale)),screenX:e.clientX,screenY:e.clientY};
 }
 function draw(a,b){
  const r=layer.getBoundingClientRect(),x=Math.min(a.screenX,b.screenX),y=Math.min(a.screenY,b.screenY);
  marker.style.left=(x-r.left)+'px';marker.style.top=(y-r.top)+'px';
  marker.style.width=Math.abs(a.screenX-b.screenX)+'px';marker.style.height=Math.abs(a.screenY-b.screenY)+'px';marker.style.display='block';
 }
 layer.addEventListener('pointerdown',e=>{
  if(!enabled||e.button>0)return;
  touches.add(e.pointerId);
  if(touches.size>1){multi=true;start=null;marker.style.display='none';return;}
  if(multi)return;
  start={id:e.pointerId,point:coordinates(e)};
  draw(start.point,start.point);
 },true);
 layer.addEventListener('pointermove',e=>{
  if(!enabled||multi||touches.size!==1||!start||e.pointerId!==start.id)return;
  e.preventDefault();
  draw(start.point,coordinates(e));
 },true);
 layer.addEventListener('pointerup',e=>{
  if(!enabled)return;
  const wasMulti=multi;touches.delete(e.pointerId);
  if(wasMulti){start=null;marker.style.display='none';if(!touches.size)multi=false;return;}
  if(!start||e.pointerId!==start.id)return;
  e.preventDefault();
  const a=start.point,b=coordinates(e);start=null;marker.style.display='none';
  const rect=[Math.floor(Math.min(a.x,b.x)),Math.floor(Math.min(a.y,b.y)),Math.ceil(Math.max(a.x,b.x)),Math.ceil(Math.max(a.y,b.y))];
  if(rect[2]-rect[0]>=12&&rect[3]-rect[1]>=12)onSelect(rect);
 },true);
 for(const type of ['pointercancel','lostpointercapture'])layer.addEventListener(type,e=>{
  touches.delete(e.pointerId);start=null;marker.style.display='none';if(!touches.size)multi=false;
 },true);
 return {enable(v){enabled=v;start=null;multi=false;touches.clear();marker.style.display='none';},get enabled(){return enabled;}};
}
