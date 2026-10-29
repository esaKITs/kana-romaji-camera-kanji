import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {renderResult} from '../kanji-reading/still-prototype/pipeline.mjs';
import {paintLabels} from '../kanji-reading/camera-prototype/paint.mjs';
import {applyRubyHeightPolicy} from '../kanji-reading/still-prototype/ruby-height.mjs';
const {createCanvas}=createRequire(import.meta.url)('../meikiocr-test/node_modules/@napi-rs/canvas');
const box=(x,y,w,h)=>({x0:x,y0:y,x1:x+w,y1:y+h});
const line=(id,b)=>({id,text:'語',box:b,regionType:'本文候補',sourceRegions:[{text:'語'}],glyphs:[{text:'語',box:b,geometry:'detected-region'}]});
const label=l=>({lineId:l.id,source:l.text,output:'hon',box:l.box,bodyBox:l.box,geometry:'detected-region',convertedHan:true});
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
const mask=(source,layout)=>{const c=createCanvas(1,1);paintLabels(c,source,{drawn:layout.drawn.map(l=>({...l,rows:[]}))},{still:true});return c;};
test('PP text distortion is bounded independently of the full ruby-erasing frame',()=>{
 const a=line(0,box(30,100,80,24)),b=line(1,box(180,97,80,27)),result=applyRubyHeightPolicy({lines:[a,b],labels:[label(a),label(b)]}),source=createCanvas(320,180),ctx=source.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,320,180);
 const original=structuredClone(result),layout=renderResult(createCanvas(1,1),source,result);assert.equal(layout.drawn.length,2);assert.equal(layout.omitted.length,0);assert.deepEqual(result,original);
 assert.equal(layout.drawn[0].fontSize,layout.drawn[1].fontSize,'similar regions on the same baseline share a nominal font');
 for(const l of layout.drawn){assert.ok(l.verticalScale/l.horizontalScale<=1.65+1e-6);assert.ok(l.verticalScale>1);assert.ok(l.displayBox.y0<l.bodyBox.y0);assert.equal(l.displayBox.y1,l.bodyBox.y1);assert.ok(l.textCenterY>=(l.displayBox.y0+l.displayBox.y1)/2);}
});
test('local replacement paper keeps a colored panel boundary and removes ink on both sides',()=>{
 const source=createCanvas(240,150),ctx=source.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,240,150);ctx.fillStyle='rgb(250,210,190)';ctx.fillRect(0,0,120,150);
 const a=line(0,box(60,70,120,30)),result=applyRubyHeightPolicy({lines:[a],labels:[label(a)]});ctx.fillStyle='black';for(const x of [70,90,135,165])ctx.fillRect(x,70,3,25);
 const preview=createCanvas(1,1),layout=renderResult(preview,source,result),out=mask(source,layout);assert.equal(layout.drawn.length,1);assert.ok(layout.drawn[0].backgroundPatch);
 for(let y=45;y<100;y++)for(let x=55;x<185;x++)assert.deepEqual(pixel(out,x,y),x<120?[250,210,190,255]:[255,255,255,255]);
 for(const [x,y] of [[20,20],[225,70],[70,140]])assert.deepEqual(pixel(out,x,y),pixel(source,x,y));
 const camera=createCanvas(1,1);paintLabels(camera,source,layout,{still:true});assert.deepEqual(camera.getContext('2d').getImageData(0,0,240,150).data,preview.getContext('2d').getImageData(0,0,240,150).data);
});
test('dark local paper removes white strokes and preserves the dark surface',()=>{
 const source=createCanvas(240,150),ctx=source.getContext('2d');ctx.fillStyle='rgb(30,45,60)';ctx.fillRect(0,0,240,150);ctx.fillStyle='white';for(const x of [70,90,135,165])ctx.fillRect(x,70,3,25);
 const a=line(0,box(60,70,120,30)),result=applyRubyHeightPolicy({lines:[a],labels:[label(a)]}),layout=renderResult(createCanvas(1,1),source,result),out=mask(source,layout);
 assert.equal(layout.drawn[0].foregroundColor,'#ffffff');for(let y=45;y<100;y++)for(let x=55;x<185;x++)assert.deepEqual(pixel(out,x,y),[30,45,60,255]);
});

test('a neighboring ruby touching only mask padding does not shrink a short particle',()=>{
 const a=line(0,box(100,100,60,24)),b=line(1,box(170,97,150,27)),ruby={...line(2,box(166,75,75,17)),text:'ほん',regionType:'ルビ候補',parentText:'別語'};
 const result=applyRubyHeightPolicy({lines:[a,b,ruby],labels:[label(a),label(b)]}),source=createCanvas(400,180),ctx=source.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,400,180);ctx.fillStyle='red';ctx.fillRect(166,75,75,17);result.labels[0].output='de';
 const layout=renderResult(createCanvas(1,1),source,result),particle=layout.drawn.find(l=>l.lineId===0);assert.ok(particle);assert.equal(particle.verticalScale,1.65);assert.equal(particle.displayBox.y0,result.labels[0].heightPolicy.requestedTop);assert.ok(particle.displayBox.x1<ruby.box.x0);assert.equal(layout.omitted.length,0);
 const out=mask(source,layout);for(let y=75;y<92;y++)for(let x=166;x<241;x++)assert.deepEqual(pixel(out,x,y),pixel(source,x,y),'unowned neighboring ruby stays protected');
});
