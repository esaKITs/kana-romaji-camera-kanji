import {initialize,runStill,dispose} from './ocr-entry.mjs';
const $=id=>document.getElementById(id);
$('run').onclick=async()=>{
 try{const file=$('image').files[0];if(!file)throw Error('Select an image');$('run').disabled=true;$('status').textContent='Loading local engines…';
  await initialize();const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const result=await runStill(canvas,{output:$('output')});$('details').textContent=JSON.stringify({rawText:result.rawText,pairs:result.result.pairs,labels:result.result.labels,withheld:result.result.withheld},null,2);$('status').textContent='Development result';
 }catch(e){$('status').textContent=e.message}finally{$('run').disabled=false;}
};
window.addEventListener('pagehide',()=>{dispose().catch(()=>{})});
