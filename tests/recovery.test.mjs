import test from'node:test';import assert from'node:assert/strict';
import{recoveryRegions,mergeRecovery,recognitionViewport,restoreRecognitionCoordinates}from'../kanji-reading/still-prototype/recovery.mjs';
import{runPipeline}from'../meikiocr-test/vendor/meikiocr-web/index.js';
const line=(text,box,confidence=.95)=>({text,box,orientation:'horizontal',glyphs:[...text].map(text=>({text,box,confidence}))});
test('recovery adds context to short ink without hiding a known neighboring row',()=>{
 const snapshot={width:400,height:300,lines:[line('語',[10,40,90,80])],diagnostics:{detectorProposals:[{box:[20,95,70,115],confidence:.4},{box:[10,40,90,80],confidence:.3}]}};
 const regions=recoveryRegions(snapshot);assert.equal(regions.length,1);assert.ok(regions[0].box[1]>=80);assert.ok(regions[0].box[3]-regions[0].box[1]>=40);
});
test('recovery budget is bounded and overlapping detector proposals do not duplicate work',()=>{
 const snapshot={width:600,height:400,lines:[],diagnostics:{detectorProposals:Array.from({length:20},(_,i)=>({box:[i*25,100,i*25+20,130],confidence:.4})).concat([{box:[0,100,20,130],confidence:.3}])}};
 assert.equal(recoveryRegions(snapshot).length,6);assert.equal(recoveryRegions(snapshot,{limit:2}).length,2);
});
test('only a more confident independent reread replaces conflicting text at the same position',()=>{
 const b=[20,80,120,110],primary={lines:[line('しいしい',b,.55)]},regions=[{box:[18,70,122,120],originalBox:b}];
 const good=mergeRecovery(primary,{lines:[line('いい',[20,70,120,120],.9)]},regions);assert.deepEqual(good.snapshot.lines.map(l=>l.text),['いい']);assert.deepEqual(good.decisions[0].replaced,['しいしい']);
 const bad=mergeRecovery(primary,{lines:[line('候補',[20,70,120,120],.5)]},regions);assert.deepEqual(bad.snapshot.lines,primary.lines);assert.equal(bad.decisions[0].accepted,false);
});
test('validated tall region hints use the existing horizontal model without a detector pass',async()=>{
 let called=0;const engine={backend:'test',modelSetId:'test',detect(){throw Error('No detector expected for explicit regions');},async recognizeHorizontal(){called++;return{labels:new Int32Array([12363]),scores:new Float32Array([.95]),boxes:new Float32Array([0,0,16,32]),perItem:1};}};
 const frame={frameId:'region',width:100,height:80,rgba:new ArrayBuffer(100*80*4),regions:[[10,20,30,60]]},cfg={profile:'meikipop-v2',maxInputPixels:10000,recognitionBatchSize:1,verticalEnabled:false};
 const r=await runPipeline(engine,frame,cfg);assert.equal(called,1);assert.equal(r.lines.length,1);assert.equal(r.lines[0].orientation,'horizontal');assert.equal(r.diagnostics.detectionSource,'supplied-regions');assert.deepEqual(r.diagnostics.detectorProposals,[]);
 for(const regions of [[],Array(17).fill([0,0,1,1]),[[0,0,101,2]],[[0,0,NaN,1]],[[0,0,1.5,1]]])await assert.rejects(runPipeline(engine,{...frame,regions},cfg));
});
test('cropped recognition restores exact source coordinates for glyphs and diagnostics',()=>{
 const viewport=recognitionViewport([[100,50,140,90],[180,70,200,100]],400,300);assert.deepEqual(viewport.regions,[[0,0,40,40],[80,20,100,50]]);assert.deepEqual([viewport.width,viewport.height],[100,50]);
 const restored=restoreRecognitionCoordinates({lines:[line('文字',[5,10,25,30])],diagnostics:{detectionRegions:[{box:[0,0,40,40]}]}},viewport);
 assert.deepEqual(restored.lines[0].box,[105,60,125,80]);assert.deepEqual(restored.lines[0].glyphs[0].box,[105,60,125,80]);assert.deepEqual(restored.diagnostics.detectionRegions[0].box,[100,50,140,90]);assert.deepEqual([restored.width,restored.height],[400,300]);
 assert.throws(()=>recognitionViewport([[0,0,401,10]],400,300));
});
