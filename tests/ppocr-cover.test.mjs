import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {renderResult} from '../kanji-reading/still-prototype/pipeline.mjs';
import {paintLabels} from '../kanji-reading/camera-prototype/paint.mjs';
const {createCanvas}=createRequire(import.meta.url)('../meikiocr-test/node_modules/@napi-rs/canvas');
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
test('PP region mask covers source ink outside the detector box and preserves ruby',()=>{
 const source=createCanvas(220,110),ctx=source.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,220,110);ctx.fillStyle='black';ctx.fillRect(40,40,120,40);ctx.fillStyle='red';ctx.fillRect(50,20,50,12);
 const box={x0:45,y0:44,x1:155,y1:76},ruby={x0:50,y0:20,x1:100,y1:32};
 const result={lines:[{id:0,box,glyphs:[{text:'本文',box,geometry:'detected-region'}]},{id:1,box:ruby,glyphs:[{text:'ほんぶん',box:ruby,geometry:'detected-region'}]}],labels:[{source:'本文',output:'a',lineId:0,box,geometry:'detected-region'}]};
 const preview=createCanvas(1,1),layout=renderResult(preview,source,result,{paperState:{resolve:()=>[[255,255,255]]}});assert.equal(layout.drawn.length,1);
 const masked=createCanvas(1,1);paintLabels(masked,source,{drawn:layout.drawn.map(l=>({...l,rows:[]}))},{still:true});
 for(let y=40;y<80;y++)for(let x=40;x<160;x++)assert.deepEqual(pixel(masked,x,y),[255,255,255,255]);
 for(let y=20;y<32;y++)for(let x=50;x<100;x++)assert.deepEqual(pixel(masked,x,y),pixel(source,x,y));
 const camera=createCanvas(1,1);paintLabels(camera,source,layout,{still:true});assert.deepEqual(camera.getContext('2d').getImageData(0,0,220,110).data,preview.getContext('2d').getImageData(0,0,220,110).data,'preview and camera must paint identical pixels');
 const label=layout.drawn[0];assert.ok(label.fontSize>(box.y1-box.y0)*.75);assert.equal(label.textBaseline,'alphabetic');assert.ok(Number.isFinite(label.textOffsetY));
});

test('a crowded PP label can retain its old font size instead of disappearing',()=>{
 const source=createCanvas(85,70),ctx=source.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,85,70);
 const box={x0:5,y0:20,x1:80,y1:50},result={lines:[{id:0,box,glyphs:[{text:'語',box,geometry:'detected-region'}]}],labels:[{source:'語',output:'WWWWWW',lineId:0,box,geometry:'detected-region'}]};
 const layout=renderResult(createCanvas(1,1),source,result);assert.equal(layout.drawn.length,1);assert.equal(layout.omitted.length,0);assert.ok(layout.drawn[0].fontSize<30*.75,'only the crowded label falls back to its original size');
});
