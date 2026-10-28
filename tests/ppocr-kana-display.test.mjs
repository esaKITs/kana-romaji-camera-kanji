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
 for(const [text,expected]of [['こうべへ','koobe e'],['とうきょう','tookyoo'],['ませんか','masen ka'],['ましょう','mashoo'],['にくとやさい','niku to yasai'],['し','shi']]){
  const r={text,box:[10,10,240,45],type:'本文候補'},raw=[{text,box:r.box}];
  const snapshot=snapshotFromPPOCR({rawRegions:raw,classifiedRegions:[r]});
  const result=await analyzePPOCRRegions(snapshot,engine.analyze,{mode:'あア漢',style:'double',verifyRuby:async()=>null});
  assert.equal(result.labels[0].output,expected,text);assert.deepEqual(snapshot.rawRegions,raw);
 }
});
