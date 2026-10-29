import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadEngine} from '../kanji-reading/lab/src/engines.mjs';
import {analyzePPOCRRegions} from '../kanji-reading/still-prototype/ppocr-reading.mjs';
import {snapshotFromPPOCR} from '../kanji-reading/still-prototype/ppocr-adapter.mjs';
const engine=await loadEngine('kuromoji',{node:true});
test('measured tall single kana stays eligible, with no guessed text orientation',async()=>{
 const raw=[{text:'み',box:[10,10,41,45]}];
 const snapshot=snapshotFromPPOCR({rawRegions:raw,classifiedRegions:raw.map(r=>({...r,type:'本文候補'}))});
 assert.equal(snapshot.lines[0].orientation,'unknown');
 const result=await analyzePPOCRRegions(snapshot,engine.analyze,{mode:'あア漢',style:'double',verifyRuby:async()=>null});
 assert.equal(result.labels[0].output,'mi');assert.deepEqual(snapshot.rawRegions,raw);
});
test('actual dictionary splits of kana words and auxiliary endings do not corrupt display',async()=>{
 for(const [text,expected]of [['こうべへ','koobe e'],['とうきょう','tookyoo'],['ませんか','masen ka'],['ましょう','mashoo'],['にくとやさい','niku to yasai'],['し','shi'],['あのみせ','ano mise'],['パンです','pan desu']]){
  const r={text,box:[10,10,240,45],type:'本文候補'},raw=[{text,box:r.box}];
  const snapshot=snapshotFromPPOCR({rawRegions:raw,classifiedRegions:[r]});
  const result=await analyzePPOCRRegions(snapshot,engine.analyze,{mode:'あア漢',style:'double',verifyRuby:async()=>null});
  assert.equal(result.labels[0].output,expected,text);assert.deepEqual(snapshot.rawRegions,raw);
 }
});

test('partial modes retain kana prefixes while converting their Han and covering ruby',async()=>{
 for(const mode of ['ア漢','漢']){
  const snapshot=snapshotFromPPOCR({rawRegions:[],classifiedRegions:[{text:'お茶を',box:[20,100,150,130],type:'本文候補'},{text:'ちゃ',box:[50,70,90,90],type:'ルビ候補',parentText:'お茶を'}]});
  const result=await analyzePPOCRRegions(snapshot,engine.analyze,{mode,style:'double',verifyRuby:async()=>null});assert.equal(result.labels.length,1);assert.match(result.labels[0].output,/おcha/);assert.equal(result.labels[0].convertedHan,true);assert.deepEqual(result.labels[0].rubyLineIds,[1]);
 }
});

test('romaji labels use Latin punctuation while the measured OCR text is unchanged',async()=>{
 const raw=[{text:'ます。',box:[10,10,240,45]}],snapshot=snapshotFromPPOCR({rawRegions:raw,classifiedRegions:raw.map(r=>({...r,type:'本文候補'}))});
 const result=await analyzePPOCRRegions(snapshot,engine.analyze,{mode:'あア漢',style:'double',verifyRuby:async()=>null});assert.equal(result.labels[0].output,'masu.');assert.deepEqual(snapshot.rawRegions,raw);assert.equal(result.lines[0].text,'ます。');
});
