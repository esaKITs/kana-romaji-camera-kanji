import {test} from 'node:test';import assert from 'node:assert/strict';
import {localPdfRange} from '../kanji-reading/camera-prototype/pdf-range.mjs';
class Transport{constructor(length,initialData,done){Object.assign(this,{length,initialData,done,received:[]});}onDataRange(begin,bytes){this.received.push({begin,bytes});}}
const pdf={PDFDataRangeTransport:Transport};
test('large local PDFs read only requested byte ranges, never file.arrayBuffer',async()=>{
 const calls=[],file={size:153625296,arrayBuffer(){throw Error('Whole PDF allocation forbidden');},slice(begin,end){calls.push([begin,end]);return new Blob([new Uint8Array(end-begin)]);}};
 const r=localPdfRange(pdf,file);assert.equal(r.length,file.size);assert.equal(r.initialData.length,0);r.requestDataRange(0,65536);r.requestDataRange(file.size-100,file.size+100);await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(calls,[[0,65536],[file.size-100,file.size]]);assert.deepEqual(r.received.map(x=>[x.begin,x.bytes.length]),[[0,65536],[file.size-100,100]]);
});
test('aborting drops late reads and prevents future byte requests',async()=>{
 let complete,calls=0;const r=localPdfRange(pdf,{size:100,slice(){calls++;return{arrayBuffer:()=>new Promise(resolve=>complete=resolve)};}});r.requestDataRange(0,100);r.abort();complete(new ArrayBuffer(100));r.requestDataRange(0,100);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,1);assert.deepEqual(r.received,[]);
});

test('range read failures are reported rather than leaving conversion pending',async()=>{const error=new Error('file unavailable');let reported;const r=localPdfRange(pdf,{size:10,slice:()=>({arrayBuffer:async()=>{throw error;}})},e=>reported=e);r.requestDataRange(0,10);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(reported,error);assert.deepEqual(r.received,[]);});
