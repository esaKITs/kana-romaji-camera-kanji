import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';import {performance} from 'node:perf_hooks';import {gzipSync,gunzipSync} from 'node:zlib';import os from 'node:os';
import {kuromojiTokens,sudachiTokens,checkSudachiSchema,cachedAnalyzer} from '../src/adapters.mjs';
import {reviewReason} from '../src/policy.mjs';import {rubyKanjiRomaji} from '../generated/romanizer.mjs';
const require=createRequire(import.meta.url),engine=process.argv[2];
const cases=JSON.parse(await readFile('cases.json','utf8'));
const before=process.memoryUsage();const t=performance.now();let analyze,assets,initMs,after;
if(engine==='kuromoji'){
 const k=require('kuromoji');const tokenizer=await new Promise((resolve,reject)=>k.builder({dicPath:'node_modules/kuromoji/dict/'}).build((e,t)=>e?reject(e):resolve(t)));
 analyze=text=>kuromojiTokens(text,tokenizer.tokenize(text));
 initMs=performance.now()-t;after=process.memoryUsage();
 let compressed=0,expanded=0;for(const f of await readdir('node_modules/kuromoji/dict')){let b=await readFile('node_modules/kuromoji/dict/'+f);compressed+=b.length;expanded+=gunzipSync(b).length;}
 assets={dictionaryCompressedBytes:compressed,dictionaryExpandedBytes:expanded,browserScriptBytes:(await stat('node_modules/kuromoji/build/kuromoji.js')).size};
}else{
 const s=await import('sudachi');checkSudachiSchema(s);initMs=performance.now()-t;after=process.memoryUsage();
 analyze=text=>sudachiTokens(text,JSON.parse(s.tokenize(text,s.TokenizeMode.C)));
 const b=await readFile('node_modules/sudachi/sudachi.js');assets={embeddedScriptBytes:b.length,gzipBytes:gzipSync(b).length,dictionaryIdentity:'Embedded; exact dictionary revision not independently established'};
}

const rows=cases.map(([text,target,expected,category])=>{
 const tokens=analyze(text),start=text.indexOf(target),end=start+target.length;
 const selected=tokens.filter(t=>t.start<end&&t.end>start),covered=selected[0]?.start===start&&selected.at(-1)?.end===end;
 const actual=covered&&selected.every(t=>t.reading)?selected.map(t=>t.reading).join(''):null;
 const pass=actual===expected;
 return {text,target,expected,category,actual,pass,review:selected.map(reviewReason).filter(Boolean),romaji:actual?{double:rubyKanjiRomaji(actual,'double'),macron:rubyKanjiRomaji(actual,'macron')}:null,tokens};
});
// warm, per-sentence inference, excluding initialization/asset IO/cache.
for(let i=0;i<3;i++)for(const [text]of cases)analyze(text);
const times=[];for(let i=0;i<10;i++)for(const[text]of cases){let t=performance.now();analyze(text);times.push(performance.now()-t)}times.sort((a,b)=>a-b);
const cached=cachedAnalyzer(analyze);let c=performance.now();for(let i=0;i<1000;i++)cached.analyze(cases[0][0]);const cached1000Ms=performance.now()-c;
const result={engine,version:engine==='kuromoji'?'0.1.2':'0.1.5',runtime:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,environment:'container Node.js; not smartphone/browser; OCR not loaded',cases:rows.length,passed:rows.filter(r=>r.pass).length,initMs,beforeMemory:before,afterMemory:after,rssDeltaBytes:after.rss-before.rss,maxRssIncludingAssetInspectionKiB:process.resourceUsage().maxRSS,assets,warmSentenceLatencyMs:{p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],samples:times.length},cached1000Ms,rows};
await mkdir('../results',{recursive:true});await writeFile('../results/'+engine+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,rows:undefined},null,2));
