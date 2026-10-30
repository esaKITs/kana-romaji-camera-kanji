import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {loadEngine} from '../kanji-reading/lab/src/engines.mjs';
import {applyNumericReadings} from '../kanji-reading/lab/src/numeric-reading.mjs';
import {tables} from '../kanji-reading/lab/src/openjtalk-counter-data.mjs';
import {snapshotFromPPOCR} from '../kanji-reading/still-prototype/ppocr-adapter.mjs';
import {analyzePPOCRRegions} from '../kanji-reading/still-prototype/ppocr-reading.mjs';
const cases=JSON.parse(await readFile('tests/fixtures/counter-readings.json'));
const engine=await loadEngine('kuromoji',{node:true});
const analyze=async text=>applyNumericReadings(text,engine.analyze(text)).tokens;
const variants=(n,kanji)=>[kanji,String(n),String(n).replace(/[0-9]/g,c=>String.fromCharCode(c.charCodeAt(0)+0xfee0))];
test('Open JTalk 1.11 tables are extracted unchanged from the pinned BSD source',async()=>{
 const source=await readFile('kanji-reading/vendor/open-jtalk/njd_set_digit_rule_utf_8.h','utf8');
 assert.equal(createHash('sha256').update(source).digest('hex'),'b176ec4d0e28ae06ce927756a371dc39c7466be429e48bc39e8d07944b63f9c9');
 const clean=source.replace(/\/\*[\s\S]*?\*\//g,'');let count=0;
 for(const m of clean.matchAll(/static const char \*(njd_set_digit_rule_\w+)\[\] = \{([\s\S]*?)\};/g)){
  assert.deepEqual(tables[m[1].replace('njd_set_digit_rule_','')],[...m[2].matchAll(/"(?:[^"\\]|\\.)*"/g)].map(m=>JSON.parse(m[0])));count++;
 }assert.equal(count,50);
});
test('existing dictionary plus counter rules resolve all three numeral spellings and complete labels',async()=>{
 for(const [n,kanji,unit,reading,output] of cases)for(const number of variants(n,kanji)){
  const text=number+unit,raw=engine.analyze(text),copy=structuredClone(raw),corrected=applyNumericReadings(text,raw);
  assert.deepEqual(raw,copy);assert.equal(corrected.tokens.length,1,text);assert.equal(corrected.tokens[0].reading,reading,text);assert.equal(corrected.tokens[0].numericValidated,true,text);
  for(const mode of ['あア漢','ア漢','漢']){
   const region={text,box:[10,50,700,100],type:'本文候補'},snapshot=snapshotFromPPOCR({rawRegions:[region],classifiedRegions:[region]}),before=structuredClone(snapshot);
   const r=await analyzePPOCRRegions(snapshot,analyze,{mode,style:'double',verifyRuby:async()=>null});
   assert.equal(r.labels.length,1,text+' '+mode);assert.equal(r.labels[0].output,output,text+' '+mode);assert.equal(r.withheld.length,0,text);assert.deepEqual(snapshot,before);
  }
 }
});
test('counter additions keep names, lexical words, unsupported numbers and source offsets intact',()=>{
 for(const text of ['三本松','四日市','二階堂','八代市','一枚岩','十分に注意','3.5個','-3枚','01台','第3回','10000件']){
  const raw=engine.analyze(text),r=applyNumericReadings(text,raw);assert.ok(!r.tokens.some(t=>t.numericValidated),text);
 }
 const text='３枚と6個',r=applyNumericReadings(text,engine.analyze(text));assert.deepEqual(r.tokens.map(t=>[t.surface,t.start,t.end]),[['３枚',0,2],['と',2,3],['6個',3,5]]);
});
test('counter contraction preserves voicing inside compound hundreds',()=>{
 for(const [text,reading] of [['三百本','サンビャッポン'],['600匹','ロッピャッピキ'],['８００杯','ハッピャッパイ'],['300分','サンビャップン']])assert.equal(applyNumericReadings(text,engine.analyze(text)).tokens[0].reading,reading,text);
});
test('件 stays unvoiced after 三/千 while 軒 voices',()=>{
 for(const [text,reading] of [['三件','サンケン'],['13件','ジュウサンケン'],['１０００件','センケン'],['三軒','サンゲン'],['1000軒','センゲン']])assert.equal(applyNumericReadings(text,engine.analyze(text)).tokens[0].reading,reading,text);
});
