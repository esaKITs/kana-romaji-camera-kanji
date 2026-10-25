import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';import fs from 'node:fs';
import {server} from './browser-server-v2.mjs';import {workerMemory} from './cdp-worker-memory.mjs';import {evaluateCase,summarize} from '../src/evaluation.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const set=JSON.parse(await readFile('evaluation-100.json','utf8'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
function memoryTree(pid){let rss=0,pss=0,count=0;function read(id){try{const s=fs.readFileSync('/proc/'+id+'/smaps_rollup','utf8');rss+=Number(s.match(/^Rss:\s+(\d+)/m)?.[1]||0);pss+=Number(s.match(/^Pss:\s+(\d+)/m)?.[1]||0);count++;let children=fs.readFileSync('/proc/'+id+'/task/'+id+'/children','utf8').trim();for(const child of children.split(/\s+/).filter(Boolean))read(child)}catch{}}read(pid);return count?{rssKiB:rss,pssKiB:pss,processes:count}:{rssKiB:null,pssKiB:null,processes:0,unavailable:'Host /proc process mapping is unavailable'}}
export {memoryTree};
const results=[];
try{for(const engine of ['kuromoji','sudachi-small']){
 const launch=await chromium.launchServer({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});const browser=await chromium.connect(launch.wsEndpoint()),pid=launch.process().pid;
 try{
  const page=await browser.newPage(),requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);const before=memoryTree(pid);let peak=before;const timer=setInterval(()=>{const m=memoryTree(pid);if(m.pssKiB!==null&&m.pssKiB>peak.pssKiB)peak=m},50);
  let data;
  try{data=await page.evaluate(async({engine,cases})=>{
   const w=new Worker('/lab/worker-v2.js');let id=0;
   const rpc=(data)=>new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>reject(Error('Worker timeout')),60000);w.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};w.onmessage=({data:r})=>{if(r.id!==request)return;clearTimeout(timer);r.error?reject(Error(r.error)):resolve(r)};w.postMessage({id:request,...data})});
   try{const init=await rpc({command:'init',engine}),rows=[];for(const c of cases){const r=await rpc({command:'analyze',text:c.text});rows.push({id:c.id,...r});}window.__evaluationWorker=w;return {init,rows};}catch(e){w.terminate();throw e}
  },{engine,cases:set.cases});}finally{clearInterval(timer)}
  const measuredWorker=await workerMemory(browser);await page.evaluate(()=>{window.__evaluationWorker?.terminate();window.__evaluationWorker=null});
  const rows=set.cases.map((c,i)=>evaluateCase(c,data.rows[i].tokens));
  if(requests.some(r=>!r.url.startsWith(base+'/')||r.method!=='GET')||errors.length)throw Error(JSON.stringify({requests,errors}));
  const result={engine,browser:browser.version(),environment:'Linux Chromium reading-only; no OCR. Browser-process-tree PSS; not Safari/phone',initMs:data.init.initMs,...summarize(rows),memory:{worker:measuredWorker,before,peak,peakPssIncreaseMiB:peak.pssKiB===null?null:(peak.pssKiB-before.pssKiB)/1024,readingWasmBytes:data.init.wasmMemoryBytes},requests:requests.length,external:0,nonGet:0,rows};results.push(result);console.log(engine,JSON.stringify({...result,rows:undefined}));
 }finally{await browser.close();await launch.close()}
}await writeFile('../results/v2-chromium.json',JSON.stringify({results},null,2)+'\n');}finally{server.close()}
