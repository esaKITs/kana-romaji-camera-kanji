import {test} from 'node:test';import assert from 'node:assert/strict';
import {overlappingRegionCandidates,verifyOverlappingRegions} from '../kanji-reading/still-prototype/ppocr-overlap.mjs';
import {verifyPPOCRRuby} from '../kanji-reading/still-prototype/ppocr-verify.mjs';
const regions=[{text:'しします',box:[818,521,978,556],type:'本文候補'},{text:'失礼しまて',box:[751,526,948,550],type:'本文候補'}];
const reference={lines:[{text:'礼します。',box:[791,517,983,558],glyphs:[{text:'礼',box:[791,517,832,558]}]}]};
test('overlapping actual-device region envelopes request one measured union crop',()=>{
 const c=overlappingRegionCandidates(regions,reference);assert.equal(c.length,1);assert.deepEqual(c[0].box,[751,517,983,558]);assert.deepEqual(c[0].indices,[0,1]);
});
test('two confident crop agreements replace conflicting display regions, retaining raw sources',async()=>{
 const canonical={rawRegions:structuredClone(regions),classifiedRegions:structuredClone(regions)},before=structuredClone(canonical),calls=[];
 const r=await verifyOverlappingRegions({},canonical,reference,async(s,b,p)=>{calls.push([b,p]);return {text:'失礼します。',minimumProbability:.96};});
 assert.equal(r.extendedRegions.length,1);assert.equal(r.extendedRegions[0].text,'失礼します。');assert.deepEqual(r.extendedRegions[0].sourceTexts,['しします','失礼しまて']);assert.equal(r.overlapVerification.accepted,1);assert.equal(calls.length,2);assert.deepEqual(canonical,before);assert.deepEqual(r.rawRegions,before.rawRegions);
});
test('disagreement, low probability and ruby intersections never remove a source',async()=>{
 for(const [first,second] of [[{text:'失礼します',minimumProbability:.99},{text:'失礼しまて',minimumProbability:.99}],[{text:'失礼します',minimumProbability:.99},{text:'失礼します',minimumProbability:.84}]]){
  let n=0;const r=await verifyOverlappingRegions({}, {classifiedRegions:regions},reference,async()=>[first,second][n++]);assert.deepEqual(r.extendedRegions,regions);assert.equal(r.overlapVerification.accepted,0);
 }
 assert.deepEqual(overlappingRegionCandidates([...regions,{text:'しつれい',type:'ルビ候補',box:[760,510,830,525]}],reference),[]);
});
test('independent ruby confirmation requires both confident PP readings and valid measured geometry',async()=>{
 const c={reading:'にほん',rubyBox:{x0:1,y0:2,x1:60,y1:25}},calls=[];
 const r=await verifyPPOCRRuby({},c,async(s,b,p)=>{calls.push([b,p]);return {text:'ニホン',minimumProbability:.9};});assert.equal(r.reading,'にほん');assert.equal(r.accepted,true);assert.deepEqual(calls,[[[1,2,60,25],0],[[1,2,60,25],.12]]);
 const failed=await verifyPPOCRRuby({},c,async()=>({text:'にぽん',minimumProbability:.99}));assert.equal(failed.reading,null);
 const low=await verifyPPOCRRuby({},c,async()=>({text:'にほん',minimumProbability:.84}));assert.equal(low.reading,null);
});

test('one low but agreeing ruby crop gets one bounded retry, never a contrary vote',async()=>{
 const c={reading:'やまだともこ',rubyBox:{x0:1,y0:2,x1:100,y1:25}};
 for(const [third,expected] of [[{text:c.reading,minimumProbability:.99},true],[{text:c.reading,minimumProbability:.84},false],[{text:'やまだゆうこ',minimumProbability:.99},false]]){
  const calls=[],r=await verifyPPOCRRuby({},c,async(s,b,p)=>{calls.push(p);return calls.length===1?{text:c.reading,minimumProbability:.83}:calls.length===2?{text:c.reading,minimumProbability:.99}:third;});assert.deepEqual(calls,[0,.12,.06]);assert.equal(r.accepted,expected);
 }
});
