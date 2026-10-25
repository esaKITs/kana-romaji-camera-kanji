import {readFile,writeFile,mkdir} from 'node:fs/promises';import os from 'node:os';
import {loadEngine} from '../src/engines.mjs';import {evaluateCase,summarize} from '../src/evaluation.mjs';
const engineName=process.argv[2],set=JSON.parse(await readFile('evaluation-100.json','utf8'));
const before=process.memoryUsage(),engine=await loadEngine(engineName,{node:true}),after=process.memoryUsage();
try{
 const rows=set.cases.map(item=>evaluateCase(item,engine.analyze(item.text)));
 const special=JSON.parse(await readFile('special-cases.json','utf8')).map(item=>({...item,result:evaluateCase({...item,acceptedReadings:[]},engine.analyze(item.text))}));
 const times=[];for(let repeat=0;repeat<5;repeat++)for(const c of set.cases){const t=performance.now();engine.analyze(c.text);times.push(performance.now()-t);}times.sort((a,b)=>a-b);
 const byCategory=Object.fromEntries([...new Set(rows.map(x=>x.category))].map(c=>[c,summarize(rows.filter(r=>r.category===c))]));
 const output={engine:engineName,environment:'isolated Linux Node process; no OCR; not a phone',node:process.version,cpu:os.cpus()[0]?.model,datasetVersion:set.version,...summarize(rows),byCategory,initMs:engine.initMs,memory:{before,after,rssDeltaBytes:after.rss-before.rss,wasmLinearBytes:engine.wasmMemory?.()??null},warmLatencyMs:{p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],samples:times.length},rows,special};
 await writeFile('../results/v2-'+engineName+'.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({...output,rows:undefined,special:undefined,byCategory:undefined},null,2));
}finally{engine.dispose()}
