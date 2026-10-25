let worker=null,engine=null,serial=0,timer;
const $=id=>document.getElementById(id);
function release(){clearTimeout(timer);worker?.terminate();worker=null;engine=null;$('run').disabled=false;}
$('stop').onclick=()=>{release();$('status').textContent='Analyzer released';};
$('engine').onchange=()=>{release();$('result').textContent='';$('status').textContent='Ready';};
$('run').onclick=()=>{
 const selected=$('engine').value,text=$('text').value;
 if(text.length>4096){$('status').textContent='Maximum: 4096 characters';return;}
 const id=++serial;
 if(!worker||engine!==selected){release();engine=selected;worker=new Worker('./worker.js');}
 $('run').disabled=true;$('status').textContent='Loading / analyzing locally…';$('result').textContent='';
 timer=setTimeout(()=>{release();$('status').textContent='Timed out; analyzer released';},60000);
 worker.onerror=e=>{release();$('status').textContent=e.message;};
 worker.onmessage=({data})=>{
  if(data.id!==serial)return;
  if(data.ready){$('status').textContent='Analyzer ready: '+Math.round(data.initMs)+' ms';return;}
  clearTimeout(timer);$('run').disabled=false;
  if(data.error){release();$('status').textContent=data.error;return;}
  $('status').textContent='Candidate analysis: '+data.analysisAndFormattingMs.toFixed(1)+' ms';
  $('result').textContent=JSON.stringify(data.tokens,null,2);
 };
 worker.postMessage({id,engine:selected,text});
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
