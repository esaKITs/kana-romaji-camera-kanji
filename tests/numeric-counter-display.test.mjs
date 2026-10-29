import {test} from 'node:test';import assert from 'node:assert/strict';
import {loadEngine} from '../kanji-reading/lab/src/engines.mjs';import {applyNumericReadings,numericSpans} from '../kanji-reading/lab/src/numeric-reading.mjs';
import {snapshotFromPPOCR} from '../kanji-reading/still-prototype/ppocr-adapter.mjs';import {analyzePPOCRRegions} from '../kanji-reading/still-prototype/ppocr-reading.mjs';import {analyzeSnapshot} from '../kanji-reading/still-prototype/pipeline.mjs';
const engine=await loadEngine('kuromoji',{node:true}),analyze=async text=>applyNumericReadings(text,engine.analyze(text)).tokens;
test('age rules handle hatachi and productive contractions without relaxing numeric guards',()=>{
 for(const [s,k] of [['20歳','ハタチ'],['二十歳','ハタチ'],['２０歳','ハタチ'],['1歳','イッサイ'],['8歳','ハッサイ'],['10歳','ジュッサイ'],['21歳','ニジュウイッサイ'],['18歳','ジュウハッサイ'],['30歳','サンジュッサイ'],['120歳','ヒャクニジュッサイ']])assert.equal(numericSpans(s)[0].reading,k,s);
 for(const s of ['0歳','-3歳','3.5歳','01歳','10000歳','第20歳','20〜30歳'])assert.equal(numericSpans(s).at(-1).reading,null,s);
 assert.deepEqual(numericSpans('歳月'),[]);
});
test('actual Kuromoji plus PP display resolves the entire number-counter in every mode and style',async()=>{
 for(const mode of ['あア漢','ア漢','漢'])for(const style of ['double','macron'])for(const [text,expected]of [['20歳未満','hatachi miman'],['二十歳未満','hatachi miman'],['3本','sambon'],['3時','sanji'],['1人','hitori'],['2人','futari'],['８歳','hassai'],['20日間','hatsukakan']]){
  const r={text,box:[10,50,900,100]},snapshot=snapshotFromPPOCR({rawRegions:[r],classifiedRegions:[{...r,type:'本文候補'}]}),copy=structuredClone(snapshot);
  const result=await analyzePPOCRRegions(snapshot,analyze,{mode,style,verifyRuby:async()=>null});
  assert.equal(result.labels.length,1,text+' '+mode);assert.equal(result.labels[0].output,expected,text+' '+mode);assert.equal(result.withheld.length,0);assert.deepEqual(snapshot,copy);assert.deepEqual(result.labels[0].bodyBox,{x0:10,y0:50,x1:900,y1:100});
 }
});
test('Meiki replaces the full measured numeral span and leaves neighboring kana intact in Han mode',async()=>{
 const text='20歳と3本',glyphs=[...text].map((text,i)=>({text,box:[10+i*30,50,40+i*30,90],confidence:.99})),result=await analyzeSnapshot({lines:[{text,box:[10,50,190,90],orientation:'horizontal',glyphs}]},analyze,{mode:'漢'});
 assert.deepEqual(result.labels.map(l=>[l.source,l.output,l.box.x0,l.box.x1]),[['20歳','hatachi',10,100],['3本','sambon',130,190]]);
});
test('unvalidated numbers, bare digits and names are retained instead of assigned guessed readings',async()=>{
 for(const text of ['20','01歳','0歳','-3歳','3.5歳','一日','三本松']){
  const raw=engine.analyze(text),corrected=applyNumericReadings(text,raw);assert.ok(!corrected.tokens.some(t=>t.numericValidated),text);
  const r={text,box:[10,50,900,100]},snapshot=snapshotFromPPOCR({rawRegions:[r],classifiedRegions:[{...r,type:'本文候補'}]}),result=await analyzePPOCRRegions(snapshot,analyze,{mode:'漢',style:'double',verifyRuby:async()=>null});assert.equal(result.labels.length,0,text);
 }
});
