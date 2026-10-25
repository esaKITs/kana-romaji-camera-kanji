import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const {spawn}=await import('node:child_process');
const server=spawn(process.execPath,['scripts/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
const b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{} )});
try{
 const page=await b.newPage(),requests=[],errors=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765');
 const cases=JSON.parse(await readFile('cases.json','utf8')),results=[];
 for(const engine of ['kuromoji','sudachi']){
  await page.selectOption('#engine',engine);await page.fill('#text','学校で本を読みました。');await page.click('#run');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Candidate analysis:'),null,{timeout:60000});
  const smoke=JSON.parse(await page.locator('#result').innerText());
  if(smoke[0].surface!=='学校'||smoke[0].reading!=='ガッコウ')throw Error(engine+' UI smoke failed');
  await page.click('#stop');
  const result=await page.evaluate(async({engine,cases})=>{
   const w=new Worker('./worker.js');let id=0,initMs;
   const run=text=>new Promise((resolve,reject)=>{
    const requestId=++id,t=performance.now(),timer=setTimeout(()=>reject(Error('Worker timeout')),60000);
    w.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};
    w.onmessage=({data})=>{if(data.id!==requestId)return;if(data.ready){initMs=data.initMs;return;}clearTimeout(timer);if(data.error)reject(Error(data.error));else resolve({...data,roundTripMs:performance.now()-t});};
    w.postMessage({id:requestId,engine,text});
   });
   const rows=[];
   try{for(const [text,target,expected,category]of cases){const r=await run(text);let start=text.indexOf(target),end=start+target.length;const selected=r.tokens.filter(t=>t.start<end&&t.end>start);const actual=selected[0]?.start===start&&selected.at(-1)?.end===end&&selected.every(t=>t.reading)?selected.map(t=>t.reading).join(''):null;rows.push({text,target,expected,actual,pass:actual===expected,analysisAndFormattingMs:r.analysisAndFormattingMs,roundTripMs:r.roundTripMs});}}finally{w.terminate()}
   return {engine,initMs,passed:rows.filter(r=>r.pass).length,cases:rows.length,rows};
  },{engine,cases});results.push(result);
 }
 const external=requests.filter(r=>!r.url.startsWith('http://127.0.0.1:8765/'));
 if(external.length||requests.some(r=>r.method!=='GET')||errors.length)throw Error(JSON.stringify({external,errors}));
 const output={environment:'Linux headless Chromium; reading-only workers; no OCR; not a phone or Safari',browser:b.version(),results,network:{requests:requests.length,external:external.length,nonGet:requests.filter(r=>r.method!=='GET').length},pageErrors:errors};
 await writeFile('../results/chromium.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({...output,results:results.map(r=>({...r,rows:undefined}))},null,2));
}finally{await b.close();server.kill()}
