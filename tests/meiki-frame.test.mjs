import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanMeikiFrame} from '../kanji-reading/still-prototype/meiki-frame.mjs';

function fixture(width,height){
 const frames=[],reads=[];
 const canvas={width,height,getContext:()=>({getImageData:(x,y,w,h)=>{reads.push([x,y,w,h]);assert.ok(w*h<=4000000,'never allocate an oversized worker input');return{data:new Uint8ClampedArray(4)};}})};
 const ocr={scan:async frame=>{assert.ok(frame.width*frame.height<=4000000);frames.push(frame);const box=[0,0,Math.min(20,frame.width),Math.min(20,frame.height)];return{width:frame.width,height:frame.height,lines:[{text:'test',box,glyphs:[{text:'t',box}]}],diagnostics:{detectorProposals:[{box}],detectionRegions:[{box}]}};}};
 return{canvas,ocr,frames,reads};
}
test('all worker entrances bound the exact 3193x4474 failing frame, including absent and empty regions',async()=>{
 for(const regions of [undefined,[],[[0,0,3193,4474]]]){
  const f=fixture(3193,4474),r=await scanMeikiFrame(f.ocr,f.canvas,'pdf',regions);
  assert.ok(f.frames.length>1);assert.ok(f.frames.every(frame=>!frame.regions),'oversized detector frames must keep detection enabled');
  assert.deepEqual([r.width,r.height],[3193,4474]);
  const last=f.reads.at(-1);assert.equal(last[0]+last[2],3193);assert.equal(last[1]+last[3],4474);
  assert.equal(r.lines.at(-1).box[0],last[0]);assert.equal(r.lines.at(-1).box[1],last[1]);
  assert.deepEqual(r.diagnostics.detectorProposals.at(-1).box,r.lines.at(-1).box);
 }
});
test('small detector input and measured crop keep their original pixels and recognition mode',async()=>{
 const f=fixture(3500,5000);await scanMeikiFrame(f.ocr,f.canvas,'crop',[[3000,4400,3200,4500]]);
 assert.deepEqual(f.reads,[[3000,4400,200,100]]);assert.deepEqual(f.frames[0].regions,[[0,0,200,100]]);
 const g=fixture(960,544);await scanMeikiFrame(g.ocr,g.canvas,'tile');assert.deepEqual(g.reads,[[0,0,960,544]]);assert.equal(g.frames[0].regions,undefined);
});
test('worker errors name the actual frame rather than hiding the failing scan path',async()=>{
 const f=fixture(100,100);f.ocr.scan=async()=>{throw Error('failed');};
 await assert.rejects(scanMeikiFrame(f.ocr,f.canvas,'ruby-7'),/Meiki scan ruby-7 \(100x100\): failed/);
});
