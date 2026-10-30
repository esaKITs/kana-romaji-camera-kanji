import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {fingerprintInput,createOcrReport} from '../kanji-reading/still-prototype/ocr-diagnostics.mjs';
test('input fingerprint hashes the exact decoded pixels without storing image bytes',async()=>{
 const pixels=new Uint8ClampedArray([255,255,255,255,0,0,0,255]),source={width:2,height:1,getContext:()=>({getImageData:()=>({data:pixels})})};
 const r=await fingerprintInput(source);assert.deepEqual(r,{width:2,height:1,rgbaSha256:createHash('sha256').update(pixels).digest('hex')});
 const failed=await fingerprintInput({width:1,height:1,getContext(){throw Error('unavailable');}});assert.deepEqual(failed,{width:1,height:1,error:'unavailable'});
});
test('downloaded report keeps raw OCR, geometry and rejection evidence separate from displayed readings',()=>{
 const run={inputFingerprint:{width:1500,height:620,rgbaSha256:'a'.repeat(64)},rawText:'士日間みます',effectiveText:'士日間みます',snapshot:{rawRegions:[{text:'士日間みます',box:[85,293,501,317]}],geometryVerification:{accepted:0,decisions:[{accepted:false,reason:'recognizers-disagree-or-score-low'}]}},result:{analysis:[],withheld:[{surface:'日間'}]},rendering:{drawn:[{output:'shi 日間 mimasu',box:{x0:85,x1:501,y0:293,y1:317},backgroundPatch:{rgba:new Uint8Array(100)}}],omitted:[]}};
 const before=structuredClone(run),r=createOcrReport(run,{origin:'built-in-sample',environment:{userAgent:'test'}});assert.deepEqual(run,before);assert.deepEqual(r.snapshot.rawRegions,run.snapshot.rawRegions);assert.equal(r.snapshot.geometryVerification.decisions[0].accepted,false);assert.equal(r.rawText,'士日間みます');assert.equal(r.rendering.drawn[0].output,'shi 日間 mimasu');assert.ok(!('backgroundPatch' in r.rendering.drawn[0]));assert.ok(!JSON.stringify(r).includes('rgba"'));assert.equal(r.schema,'kana-camera-ocr-report-v1');
});
