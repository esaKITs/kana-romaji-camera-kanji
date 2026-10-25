import {readFile,writeFile} from 'node:fs/promises';
import {loadEngine} from '../src/engines.mjs';import {applyNumericReadings} from '../src/numeric-reading.mjs';import {evaluateCase,summarize} from '../src/evaluation.mjs';
const original=JSON.parse(await readFile('evaluation-100.json','utf8')).cases,extra=JSON.parse(await readFile('numeric-extra-100.json','utf8'));
const compact=r=>{const{tokens,...rest}=r;return rest;};
for(const name of ['kuromoji','sudachi-small']){
 const engine=await loadEngine(name,{node:true});
 try{
  const datasets=[];
  for(const[label,set]of [['original-100',original],['extra-positive-80',extra.positive]]){
   const rows=set.map(c=>{const raw=engine.analyze(c.text),t=performance.now(),corrected=applyNumericReadings(c.text,raw),correctionMs=performance.now()-t;return {id:c.id,before:compact(evaluateCase(c,raw)),after:compact(evaluateCase(c,corrected.tokens)),decisions:corrected.decisions,correctionMs}});
   datasets.push({name:label,n:set.length,before:summarize(rows.map(r=>r.before)),after:summarize(rows.map(r=>r.after)),regressions:rows.filter(r=>r.before.correct&&!r.after.correct).map(r=>r.id),rows});
  }
  const guards=extra.guards.map(c=>{const raw=engine.analyze(c.text),r=applyNumericReadings(c.text,raw),start=c.text.indexOf(c.target),end=start+c.target.length;const improper=r.tokens.some(t=>t.numericValidated&&t.start<end&&t.end>start);return {...c,pass:!improper,raw,output:r.tokens,decisions:r.decisions}});
  const result={engine:name,environment:'Linux Node; no OCR; unchanged analyzer/dictionary from previous comparison',initMs:engine.initMs,datasets,guards:{n:guards.length,passed:guards.filter(g=>g.pass).length,rows:guards}};
  await writeFile('../results/numeric-'+name+'.json',JSON.stringify(result)+'\n');console.log(JSON.stringify({engine:name,datasets:datasets.map(({rows,...r})=>r),guards:{n:guards.length,passed:result.guards.passed}},null,2));
 }finally{engine.dispose()}
}
