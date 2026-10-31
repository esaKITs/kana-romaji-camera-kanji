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
 for(const readings of [[['違う',.99],['違う',.99]],[[measured.text,.99],['違う',.99]],[[measured.text,.84],[measured.text,.99],[measured.text,.84]]]){
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

test('iPhone report: matching text with one low crop retries without lowering .85',async()=>{
 const original={text:'士日間みます。',box:[85,293,501,317],type:'本文候補'};
 const line={text:'二十日間休みます。',box:[71,281,515,328],glyphs:[{text:'二',box:[71,281,124,328]}]};
 const input={rawRegions:[structuredClone(original)],classifiedRegions:[structuredClone(original)]},before=structuredClone(input),margins=[];
 const scores=[.9914557337760925,.5346751809120178,.98];
 const out=await verifyClippedRegions({},input,{lines:[line]},async(source,box,padding)=>{margins.push(padding);assert.deepEqual(box,line.box);return{text:line.text,minimumProbability:scores[margins.length-1]};});
 assert.deepEqual(input,before);assert.deepEqual(out.rawRegions,before.rawRegions);assert.deepEqual(margins,[0,.12,.06]);
 assert.equal(out.geometryVerification.accepted,1);assert.equal(out.extendedRegions[0].text,line.text);assert.deepEqual(out.extendedRegions[0].box,line.box);
 const d=out.geometryVerification.decisions[0];assert.equal(d.second.minimumProbability,.5346751809120178);assert.equal(d.extra[0].padding,.06);assert.equal(d.reason,'reference-and-two-confident-pp-crops-agree-after-retry');
});
test('retry cannot outvote a contrary PP text, two low initial crops, or a low/invalid retry',async()=>{
 const cases=[
  [[measured.text,.99],['違う',.99]],
  [[measured.text,.84],[measured.text,.83]],
  [[measured.text,.99],[measured.text,.53],['違う',.99]],
  [[measured.text,.99],[measured.text,.53],[measured.text,.84]],
  [[measured.text,.99],[measured.text,.53],[measured.text,NaN]],
 ];
 for(const readings of cases){let i=0;const input=run(),out=await verifyClippedRegions({},input,reference(),async()=>{assert.ok(i<readings.length,'bounded retry');const [text,minimumProbability]=readings[i++];return{text,minimumProbability};});assert.equal(i,readings.length);assert.equal(out.geometryVerification.accepted,0);assert.deepEqual(out.extendedRegions,input.extendedRegions);}
});
