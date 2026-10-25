import{createRequire}from'node:module';import{readFile,writeFile}from'node:fs/promises';
import{server}from'./browser-server-v2.mjs';import{evaluateCase,summarize}from'../src/evaluation.mjs';
const{chromium}=createRequire(import.meta.url)('playwright');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const original=JSON.parse(await readFile('evaluation-100.json','utf8')).cases,extra=JSON.parse(await readFile('numeric-extra-100.json','utf8')),results=[];
try{for(const engine of ['kuromoji','sudachi-small']){
 const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
 const page=await b.newPage(),requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
 const data=await page.evaluate(async({engine,cases,guards})=>{
  const w=new Worker('/lab/worker-v2.js');let id=0;const rpc=(value)=>new Promise((resolve,reject)=>{let request=++id;const timer=setTimeout(()=>reject(Error('timeout')),60000);w.onmessage=({data})=>{if(data.id!==request)return;clearTimeout(timer);data.error?reject(Error(data.error)):resolve(data)};w.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};w.postMessage({id:request,...value})});
  try{const init=await rpc({command:'init',engine}),rows=[];for(const c of cases){const r=await rpc({command:'analyze',text:c.text,numeric:true});rows.push({id:c.id,...r});}const checked=[];for(const c of guards){const r=await rpc({command:'analyze',text:c.text,numeric:true});checked.push({id:c.id,...r});}return{init,rows,guards:checked};}finally{await rpc({command:'dispose'});w.terminate()}
 },{engine,cases:[...original,...extra.positive],guards:extra.guards});
 const rows=[...original,...extra.positive].map((item,i)=>{const{tokens,...r}=evaluateCase(item,data.rows[i].tokens);return r});
 const guards=extra.guards.map((g,i)=>{const start=g.text.indexOf(g.target),end=start+g.target.length;return{id:g.id,pass:!data.guards[i].tokens.some(t=>t.numericValidated&&t.start<end&&t.end>start)}});
 const network={requests:requests.length,external:requests.filter(r=>!r.url.startsWith(base+'/')).length,nonGet:requests.filter(r=>r.method!=='GET').length};if(network.external||network.nonGet||errors.length)throw Error(JSON.stringify({network,errors}));
 const result={engine,browser:b.version(),environment:'Linux headless Chromium, text-only Worker evaluation; not Safari/physical phone',initMs:data.init.initMs,original:summarize(rows.slice(0,100)),extra:summarize(rows.slice(100)),guards,network,errors,rows};results.push(result);console.log(engine,result.original.raw.correct,result.extra.raw.correct,guards.filter(g=>g.pass).length);
 }finally{await b.close()}
}await writeFile('../results/numeric-chromium.json',JSON.stringify({results})+'\n');}finally{server.close()}
