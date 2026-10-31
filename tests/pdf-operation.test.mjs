import {test} from 'node:test';import assert from 'node:assert/strict';
import {createOperationReport} from '../kanji-reading/camera-prototype/operation-report.mjs';
test('PDF failure keeps the original stage and exception after reload, without creating a fresh empty report',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const first=createOperationReport({storage,version:'test'});first.begin({bytes:123});first.step('ocr-frame-scan',{width:3193,height:4474,pixels:14285482});first.fail(Error('frame exceeds maxInputPixels=4000000'));first.fail(Error('generic conversion failed'));
 const restored=createOperationReport({storage});assert.equal(restored.current.error.phase,'ocr-frame-scan');assert.equal(restored.current.error.message,'frame exceeds maxInputPixels=4000000');assert.equal(restored.current.events.at(-1).width,3193);assert.equal(restored.current.complete,false);
 restored.step('startup');assert.equal(restored.current.phase,'ocr-frame-scan');
 restored.begin({operation:'retry'});restored.finish();assert.equal(restored.current.complete,true);assert.equal(restored.current.error,undefined);
});
test('an interrupted operation retains its last phase and bounds event storage',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const first=createOperationReport({storage});first.begin();for(let i=0;i<200;i++)first.step('ocr-frame-scan',{id:i});
 const restored=createOperationReport({storage});assert.equal(restored.current.phase,'ocr-frame-scan');assert.equal(restored.current.complete,false);assert.equal(restored.current.events.length,80);assert.equal(restored.current.events.at(-1).id,199);
});
