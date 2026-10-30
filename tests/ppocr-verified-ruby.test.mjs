import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadEngine} from '../kanji-reading/lab/src/engines.mjs';
import {analyzePPOCRRegions} from '../kanji-reading/still-prototype/ppocr-reading.mjs';
import {snapshotFromPPOCR} from '../kanji-reading/still-prototype/ppocr-adapter.mjs';
const engine=await loadEngine('kuromoji',{node:true});
const scene=(text,ruby)=>snapshotFromPPOCR({rawRegions:[{text,box:[20,100,300,140]},{text:ruby,box:[20,75,150,92]}],classifiedRegions:[{text,box:[20,100,300,140],type:'本文候補'},{text:ruby,box:[20,75,150,92],type:'ルビ候補',parentText:text}]});
const options={mode:'あア漢',style:'double',verifyRuby:async c=>({reading:c.reading,method:'independent-test-reread'})};
test('verified whole name ruby overrides multiple actual dictionary tokens exactly once',async()=>{
 const snapshot=scene('山田一郎','やまだいちろう'),before=structuredClone(snapshot);
 assert.equal((await engine.analyze('山田一郎')).length,2);
 const r=await analyzePPOCRRegions(snapshot,engine.analyze,options);
 assert.equal(r.labels.length,1);assert.equal(r.labels[0].output,'yamadaichiroo');assert.deepEqual(r.withheld,[]);assert.equal(r.labels[0].coversRuby,true);assert.deepEqual(snapshot,before);
});
test('independently verified ruby can override a different dictionary reading',async()=>{
 const snapshot=scene('日本の','にほん'),before=structuredClone(snapshot);
 const r=await analyzePPOCRRegions(snapshot,engine.analyze,options);
 assert.equal(r.labels[0]?.output,'nihon no');assert.deepEqual(r.withheld,[]);assert.deepEqual(snapshot,before);
});
test('a rejected name ruby retains the proper-name gate and annotation',async()=>{
 const r=await analyzePPOCRRegions(scene('山田友子','やまだともこ'),engine.analyze,{...options,verifyRuby:async()=>null});
 assert.equal(r.labels.length,0);assert.equal(r.pairs.length,0);assert.equal(r.withheld.length,2);
});
test('multiple possible Han runs cannot receive a mismatching ruby by text order',async()=>{
 const r=await analyzePPOCRRegions(scene('日本の生活','にほん'),engine.analyze,options);
 assert.equal(r.pairs.length,0);assert.ok(r.labels[0].output.includes('日本'));assert.equal(r.labels[0].coversRuby,false);
});
test('same-page reuse requires identical body and ruby and an actually verified reference',async()=>{
 const a=scene('山田友子','やまだともこ'),b=structuredClone(a.lines);b.forEach(l=>{l.box=l.box.map((v,i)=>i%2?v+100:v);l.glyphs=[{text:l.text,box:l.box,geometry:'detected-region'}];});
 const snapshot={...a,lines:[...a.lines,...b]};let calls=0;
 const result=await analyzePPOCRRegions(snapshot,engine.analyze,{...options,verifyRuby:async c=>++calls===2?{reading:c.reading,method:'independent-test-reread'}:null});
 assert.equal(result.labels.length,2);assert.ok(result.labels.every(l=>l.output==='yamadatomoko'));assert.equal(result.pairs.filter(p=>p.verification==='same-document-verified-ruby').length,1);assert.deepEqual(result.withheld,[]);
 b[1].text='やまだゆうこ';const mismatch=await analyzePPOCRRegions({...a,lines:[...a.lines,...b]},engine.analyze,{...options,verifyRuby:async c=>c.rubyBox.y0>100?{reading:c.reading,method:'independent-test-reread'}:null});assert.equal(mismatch.labels.length,1);assert.ok(mismatch.withheld.some(t=>t.surface==='友子'));
});
test('geometry-repaired body retains annotation ownership by its original canonical spelling',async()=>{
 const snapshot=snapshotFromPPOCR({rawRegions:[],classifiedRegions:[{text:'山田一郎',box:[20,100,300,140],type:'本文候補',canonicalRegion:{text:'山田ー郎',box:[20,100,300,140]}},{text:'やまだいちろう',box:[20,75,150,92],type:'ルビ候補',parentText:'山田ー郎'}]});
 const r=await analyzePPOCRRegions(snapshot,engine.analyze,options);assert.equal(r.labels[0]?.output,'yamadaichiroo');assert.equal(r.labels[0]?.coversRuby,true);
});
test('a verified lexical stem retains its original verb-chain grouping',async()=>{
 const r=await analyzePPOCRRegions(scene('失礼します。','しつれい'),engine.analyze,options);assert.equal(r.labels[0]?.output,'shitsureeshimasu.');
});
