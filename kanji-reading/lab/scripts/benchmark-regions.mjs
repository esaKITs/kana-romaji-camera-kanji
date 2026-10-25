// Synthetic geometry/analyzer-stub benchmark, NOT OCR or real-photo accuracy.
// node scripts/benchmark-regions.mjs /absolute/path/to/still-prototype/pipeline.mjs
import {pathToFileURL} from 'node:url';
const module=process.argv[2]?pathToFileURL(process.argv[2]).href:new URL('../../still-prototype/pipeline.mjs',import.meta.url).href;
const {analyzeSnapshot}=await import(module);
const line=(text,x,y,h=40,unit=30)=>({text,orientation:'horizontal',glyphs:[...text].map((text,i)=>({text,confidence:.95,box:[x+i*unit,y,x+(i+1)*unit,y+h]}))});
const snapshot={lines:[line('まち',30,5,12,15),line('町',30,30),line('きれい',250,30),line('いい',350,280),line('どう',350,400),line('か',540,400)]};
const reading={'町':'マチ','きれい':'キレイ','いい':'イイ','どう':'ドウ','か':'カ'};
const analyze=async surface=>[{surface,reading:reading[surface]||surface,start:0,end:surface.length,pos:['名詞'],unknown:false}];
const run=()=>analyzeSnapshot(snapshot,analyze,{verifyRuby:async c=>c.reading});
for(let i=0;i<100;i++)await run();
const times=[];
for(let i=0;i<1000;i++){const start=performance.now();await run();times.push(performance.now()-start);}
times.sort((a,b)=>a-b);const r=await run();
console.log(JSON.stringify({kind:'synthetic geometry only; stub analyzer; no OCR/rendering',iterations:times.length,medianMs:times[500],p95Ms:times[950],outputs:r.labels.map(l=>l.output),rubyCovered:r.labels.some(l=>l.coversRuby),heapUsedBytes:process.memoryUsage().heapUsed},null,2));
