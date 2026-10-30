import test from 'node:test';import assert from 'node:assert/strict';
import {loadEngine} from '../src/engines.mjs';
import {displayTokens} from '../../still-prototype/display-tokens.mjs';
import {candidateRomanization} from '../src/format.mjs';
import {analyzeSnapshot} from '../../still-prototype/pipeline.mjs';
const cases=[['いわてへ','iwate e','iwate e'],['学校へ','gakkoo e','gakkō e'],['本を','hon o','hon o'],['絵へ','e e','e e'],['井戸を','ido o','ido o'],['水がある','mizu ga aru','mizu ga aru'],['水はある','mizu wa aru','mizu wa aru']];
test('actual dictionary tokens keep particle boundaries in PP region labels in both styles',async()=>{
 const engine=await loadEngine('kuromoji',{node:true});
 try{for(const [text,double,macron] of cases){
  const raw=engine.analyze(text),snapshot={engine:'ppocrv6-manga',width:1000,height:200,lines:[{id:0,text,box:[20,40,980,90],regionType:'本文候補',orientation:'horizontal',glyphs:[]} ]};
  for(const [style,expected] of [['double',double],['macron',macron]]){
   const groups=displayTokens(text,raw,'あア漢');assert.equal(groups.map(t=>candidateRomanization(t,style)).join(' '),expected,text+' '+style);
   const result=await analyzeSnapshot(snapshot,async()=>raw,{mode:'あア漢',style});assert.equal(result.labels[0].output,expected,text+' measured PP label '+style);
  }
 }}finally{engine.dispose();}
});
test('grouped particles cannot merge neighboring vowels, including before e/o and after ga/wa',()=>{
 for(const members of [
  [{surface:'絵',reading:'エ',pos:['名詞']},{surface:'へ',reading:'ヘ',pos:['助詞']}],
  [{surface:'井戸',reading:'イド',pos:['名詞']},{surface:'を',reading:'ヲ',pos:['助詞']}],
  [{surface:'が',reading:'ガ',pos:['助詞']},{surface:'ある',reading:'アル',pos:['動詞']}],
  [{surface:'は',reading:'ハ',pos:['助詞']},{surface:'ある',reading:'アル',pos:['動詞']}],
 ]){
  const token={surface:members.map(t=>t.surface).join(''),reading:members.map(t=>t.reading).join(''),members};
  for(const style of ['double','macron'])assert.equal(candidateRomanization(token,style),members.map(t=>candidateRomanization(t,style)).join(''));
 }
});

test('岩手へ dictionary pronunciation keeps final e separate from particle e',async()=>{
 const engine=await loadEngine('kuromoji',{node:true});
 try{const text='岩手へ',raw=engine.analyze(text);for(const style of ['double','macron']){
  assert.equal(displayTokens(text,raw,'あア漢').map(t=>candidateRomanization(t,style)).join(' '),'iwate e');
 }}finally{engine.dispose();}
});
