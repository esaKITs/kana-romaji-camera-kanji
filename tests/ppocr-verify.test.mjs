import {test} from 'node:test';import assert from 'node:assert/strict';
import {clippedRegionCandidates,verifyClippedRegions} from '../kanji-reading/still-prototype/ppocr-verify.mjs';
import {snapshotFromPPOCR} from '../kanji-reading/still-prototype/ppocr-adapter.mjs';
const primary={text:'一本のペン',box:[12,55,112,75],type:'本文候補'},measured={text:'三本のペン',box:[10,40,115,82],glyphs:[{text:'三本のペン',box:[10,40,115,82]}]};
const run=()=>({rawRegions:[{text:primary.text,box:[...primary.box]}],classifiedRegions:[structuredClone(primary)],extendedRegions:[structuredClone(primary)]});
const reference=()=>({lines:[structuredClone(measured)]});
test('geometry recovery uses unique independently measured regions and retains canonical OCR',async()=>{
 const input=run(),copy=structuredClone(input),calls=[];const out=await verifyClippedRegions({},input,reference(),async(source,box,padding)=>{calls.push({box,padding});return{text:measured.text,minimumProbability:.98};});
 assert.deepEqual(input,copy);assert.deepEqual(out.rawRegions,copy.rawRegions);assert.deepEqual(out.classifiedRegions,copy.classifiedRegions);assert.equal(out.geometryVerification.accepted,1);assert.deepEqual(calls.map(c=>c.padding),[0,.12]);assert.ok(calls.every(c=>c.box.every((v,i)=>v===measured.box[i])));
 assert.equal(out.extendedRegions[0].text,measured.text);assert.deepEqual(out.extendedRegions[0].box,measured.box);assert.deepEqual(out.extendedRegions[0].canonicalRegion,{text:primary.text,box:primary.box});
 const snapshot=snapshotFromPPOCR(out);assert.equal(snapshot.lines[0].provenance,'measured-crop-pp-verified');assert.deepEqual(snapshot.lines[0].canonicalRegion,out.extendedRegions[0].canonicalRegion);
});
test('reference text alone, a single successful crop, or low model scores cannot overwrite PP',async()=>{
 for(const readings of [[['違う',.99],['違う',.99]],[[measured.text,.99],['違う',.99]],[[measured.text,.84],[measured.text,.99]]]){
  let i=0;const input=run(),out=await verifyClippedRegions({},input,reference(),async()=>{const [text,minimumProbability]=readings[i++];return{text,minimumProbability};});assert.equal(out.geometryVerification.accepted,0);assert.deepEqual(out.extendedRegions,input.extendedRegions);
 }
});
test('unclipped geometry, ambiguous reference regions and ruby intersections are protected',()=>{
 assert.equal(clippedRegionCandidates([{...primary,text:measured.text}],reference()).length,0,'already-agreeing PP text and geometry remain unchanged');
 assert.equal(clippedRegionCandidates([primary],{lines:[{...measured,box:[10,54,115,76]}]}).length,0);
 assert.equal(clippedRegionCandidates([primary],{lines:[measured,structuredClone(measured)]}).length,0);
 assert.equal(clippedRegionCandidates([primary,{text:'さん',type:'ルビ候補',box:[20,35,50,45]}],reference()).length,0);
 assert.equal(clippedRegionCandidates([primary,{...primary,box:[13,56,111,74]}],reference()).length,0);
 assert.equal(clippedRegionCandidates([{...primary,type:'ルビ候補'}],reference()).length,0);
});
