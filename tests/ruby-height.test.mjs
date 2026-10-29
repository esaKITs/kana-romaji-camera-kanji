import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {applyRubyHeightPolicy,defaultUpperRatio} from '../kanji-reading/still-prototype/ruby-height.mjs';
import {renderResult} from '../kanji-reading/still-prototype/pipeline.mjs';import {paintLabels} from '../kanji-reading/camera-prototype/paint.mjs';
const {createCanvas}=createRequire(import.meta.url)('../meikiocr-test/node_modules/@napi-rs/canvas');
const box=(x,y,w,h)=>({x0:x,y0:y,x1:x+w,y1:y+h});
const line=(id,text,b,type='本文候補',parentText)=>({id,text,box:b,regionType:type,parentText,sourceRegions:[{text}],glyphs:[{text,box:b,geometry:'detected-region'}]});
const label=l=>({lineId:l.id,source:l.text,output:'hon',box:l.box,bodyBox:l.box,geometry:'detected-region',convertedHan:true});
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
test('one ruby observation sets a shared ratio, including Han without detected ruby',()=>{
 const a=line(0,'本',box(30,100,80,30)),r=line(1,'ほん',box(30,70,60,20),'ルビ候補','本'),b=line(2,'字',box(180,180,80,30));
 const result=applyRubyHeightPolicy({lines:[a,r,b],labels:[label(a),label(b)]});
 assert.equal(result.rubyHeightPolicy.sampleCount,1);assert.equal(result.rubyHeightPolicy.upperRatio,1);
 assert.equal(result.labels[0].heightPolicy.upperRatio,result.labels[1].heightPolicy.upperRatio);
 assert.ok(result.labels[1].heightPolicy.requestedTop<=150);assert.deepEqual(result.labels[0].rubyLineIds,[1]);
});
test('without ruby the default still expands upward from a fixed body bottom',()=>{
 const a=line(0,'本',box(30,100,100,30)),result=applyRubyHeightPolicy({lines:[a],labels:[label(a)]});
 assert.equal(result.rubyHeightPolicy.source,'default');assert.equal(result.rubyHeightPolicy.upperRatio,defaultUpperRatio);
 const source=createCanvas(180,160);source.getContext('2d').fillStyle='white';source.getContext('2d').fillRect(0,0,180,160);
 const layout=renderResult(createCanvas(1,1),source,result);assert.equal(layout.drawn.length,1);assert.ok(layout.drawn[0].displayBox.y0<100);assert.equal(layout.drawn[0].displayBox.y1,130);
});
test('attached ruby is erased, while the prior body row stays pixel-identical',()=>{
 const a=line(0,'本',box(30,100,80,30)),r=line(1,'ほん',box(30,70,60,20),'ルビ候補','本'),b=line(2,'字',box(180,180,80,30)),prior=line(3,'前の行',box(180,135,80,20));
 const result=applyRubyHeightPolicy({lines:[a,r,b,prior],labels:[label(a),label(b)]}),source=createCanvas(300,240),ctx=source.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,300,240);ctx.fillStyle='black';ctx.fillRect(30,70,60,20);ctx.fillRect(30,100,80,30);ctx.fillRect(180,180,80,30);ctx.fillStyle='red';ctx.fillRect(180,135,80,20);ctx.fillStyle='blue';ctx.fillRect(190,161,60,12);
 const layout=renderResult(createCanvas(1,1),source,result,{paperState:{resolve:()=>[[255,255,255]]}});assert.equal(layout.drawn.length,2);
 const first=layout.drawn.find(l=>l.lineId===0),second=layout.drawn.find(l=>l.lineId===2);assert.deepEqual(first.coveredRubyLineIds,[1]);assert.ok(first.displayBox.y0<70);assert.ok(second.displayBox.y0>=159);assert.equal(second.displayBox.y1,210);
 const mask=createCanvas(1,1);paintLabels(mask,source,{drawn:layout.drawn.map(l=>({...l,rows:[]}))},{still:true});
 for(let y=70;y<90;y++)for(let x=30;x<90;x++)assert.deepEqual(pixel(mask,x,y),[255,255,255,255]);
 for(let y=135;y<155;y++)for(let x=180;x<260;x++)assert.deepEqual(pixel(mask,x,y),pixel(source,x,y));
 for(let y=161;y<173;y++)for(let x=190;x<250;x++)assert.deepEqual(pixel(mask,x,y),[255,255,255,255],'inferred headroom covers annotation ink absent from OCR regions');
 assert.ok(first.verticalScale>1,'romaji uses the added vertical space');
});
test('a ruby blocked by prior body text is preserved whole, not half-erased',()=>{
 const a=line(0,'本',box(30,100,80,30)),r=line(1,'ほん',box(30,70,60,20),'ルビ候補','本'),prior=line(2,'前',box(30,50,80,30));
 const result=applyRubyHeightPolicy({lines:[a,r,prior],labels:[label(a)]}),source=createCanvas(180,160);const x=source.getContext('2d');x.fillStyle='white';x.fillRect(0,0,180,160);x.fillStyle='red';x.fillRect(30,70,60,20);
 const layout=renderResult(createCanvas(1,1),source,result);assert.equal(layout.drawn.length,1);assert.deepEqual(layout.drawn[0].coveredRubyLineIds,[]);
 const mask=createCanvas(1,1);paintLabels(mask,source,{drawn:layout.drawn.map(l=>({...l,rows:[]}))},{still:true});for(let y=70;y<90;y++)for(let xx=30;xx<90;xx++)assert.deepEqual(pixel(mask,xx,y),pixel(source,xx,y));
});
test('ambiguous ruby ownership is preserved instead of erased',()=>{
 const a=line(0,'本',box(30,100,80,30)),b=line(2,'本',box(35,100,80,30)),r=line(1,'ほん',box(40,70,50,20),'ルビ候補','本');
 const result=applyRubyHeightPolicy({lines:[a,b,r],labels:[label(a),label(b)]});assert.equal(result.rubyHeightPolicy.sampleCount,0);assert.ok(result.labels.every(l=>l.rubyLineIds.length===0));
});
test('unconverted Han can calibrate height without losing its annotation',()=>{
 const a=line(0,'本',box(30,100,80,30)),r=line(1,'ほん',box(30,70,60,20),'ルビ候補','本');
 const result=applyRubyHeightPolicy({lines:[a,r],labels:[{...label(a),convertedHan:false}]});assert.equal(result.rubyHeightPolicy.sampleCount,1);assert.deepEqual(result.labels[0].rubyLineIds,[]);assert.equal(result.labels[0].coversRuby,false);
});
