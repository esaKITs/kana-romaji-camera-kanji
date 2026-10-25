import test from 'node:test';import assert from 'node:assert/strict';import {allocateLabels} from '../../still-prototype/layout.mjs';
const box=(x0,x1,y0=10,y1=50)=>({x0,x1,y0,y1});
function scene(words){return{lines:[{id:0,box:box(0,200),glyphs:words.map(w=>({text:w[0],box:box(w[1],w[2])}))}],labels:words.filter(w=>w[3]).map(w=>({lineId:0,source:w[0],output:w[3],box:box(w[1],w[2])}))};}
const measure=(s,f)=>s.length*f*.55;
const overlap=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.y1,b.y1)>Math.max(a.y0,b.y0);
test('adjacent words share free row space, preserve order, and do not collide',()=>{const s=scene([['学',30,70,'gakkoo'],['校',70,110,'toshokan']]);const r=allocateLabels(s,230,80,measure);assert.equal(r.drawn.length,2);assert.equal(r.omitted.length,0);assert.ok(!overlap(...r.drawn.map(l=>l.displayBox)));assert.ok(r.drawn.every(l=>l.horizontalScale===1));});
test('digits and non-target kana remain protected in every mode',()=>{for(const mode of ['あア漢','ア漢','漢']){const s=scene([['3',10,30],['本',30,65,'bon'],['の',65,90]]);s.mode=mode;const r=allocateLabels(s,160,80,measure);assert.equal(r.drawn.length,1);assert.ok(r.drawn[0].displayBox.x0>=30);assert.ok(r.drawn[0].displayBox.x1<=65);}});
test('long label wraps into two rows with a readable font',()=>{const s=scene([['あ',0,20],['図書館',20,80,'toshokan'],['い',80,120]]);const r=allocateLabels(s,120,80,measure);assert.equal(r.drawn.length,1);assert.equal(r.drawn[0].rows.length,2);assert.equal(r.drawn[0].rows.join(''),'toshokan');assert.ok(r.drawn[0].fontSize>=40*.45);assert.ok(r.drawn[0].horizontalScale>=.7);});
test('nearby ruby and other lines cannot be painted over',()=>{const s=scene([['学校',20,100,'gakkoo']]);s.lines.push({id:1,box:box(20,100,0,15),glyphs:[{text:'がっこう',box:box(20,100,0,15)}]});const r=allocateLabels(s,160,80,measure);assert.equal(r.drawn.length,0);assert.equal(r.omitted[0].reason,'protected-glyph-collision');});
test('impossible width is explicitly withheld, never over-compressed',()=>{const s=scene([['3',0,20],['本',20,27,'bon'],['。',27,40]]);const r=allocateLabels(s,40,80,measure);assert.equal(r.drawn.length,0);assert.equal(r.omitted.length,1);});
test('allocation is repeatable and input is immutable',()=>{const s=scene([['学校',20,80,'gakkoo']]);const before=JSON.stringify(s),a=allocateLabels(s,180,80,measure);assert.deepEqual(a,allocateLabels(s,180,80,measure));assert.equal(JSON.stringify(s),before);});
test('overlapping OCR bounds are clipped to preserved neighboring glyphs',()=>{const s=scene([['3',0,22],['本',20,62,'bon'],['の',60,85]]);const r=allocateLabels(s,120,80,measure);assert.equal(r.drawn.length,1);assert.ok(r.drawn[0].displayBox.x0>22);assert.ok(r.drawn[0].displayBox.x1<60);});
test('tight canvases and uneven words never produce out-of-bounds rectangles',()=>{for(const width of [45,80,120,240])for(const text of ['a','gakkoo','toshokan','juusambai']){const s=scene([['語',4,24,text],['語',25,44,'ga']]);const r=allocateLabels(s,width,60,measure);for(const l of r.drawn){assert.ok(l.displayBox.x0>=0&&l.displayBox.x1<=width);assert.ok(l.horizontalScale>=.7);}for(let i=0;i<r.drawn.length;i++)for(const other of r.drawn.slice(i+1))assert.ok(!overlap(r.drawn[i].displayBox,other.displayBox));}});
test('row fitting cannot displace a short particle beyond its own source',()=>{
 const s=scene([['語A',54,149,'long-a'],['語B',149,293,'long-b'],['に',294,340,'ni']]);
 const widths={'long-a':159.26,'long-b':184.12,ni:32.35};
 const r=allocateLabels(s,1100,80,text=>widths[text]??text.length*16);
 assert.equal(r.drawn.length,3);assert.equal(r.omitted.length,0);
 const particle=r.drawn.find(l=>l.source==='に');assert.ok(particle.displayBox.x0<340&&particle.displayBox.x1>294);assert.ok(particle.horizontalScale>=.7&&particle.horizontalScale<1);
});
test('curved or slanted baselines do not inflate romaji size to the union height',()=>{
 const s=scene([['品質',10,80,'hinshitsu'],['に',80,110,'ni'],['問題',110,180,'mondai']]);
 s.lines[0].glyphs.forEach((g,i)=>{g.box.y0=10+i*22;g.box.y1=50+i*22;});s.lines[0].box.y1=94;
 s.labels.forEach((l,i)=>{l.box={...s.lines[0].glyphs[i].box};});
 const r=allocateLabels(s,210,110,measure);assert.equal(r.drawn.length,3);assert.equal(r.omitted.length,0);assert.ok(r.drawn.every(l=>l.fontSize<=40*.56));
});
test('anchor pressure triggers wrapping even when the total canvas width is ample',()=>{
 const s=scene([['長語',10,70,'abcdefghijklmno'],['短語',70,110,'toshokan'],['に',110,140,'ni']]);
 const r=allocateLabels(s,800,90,measure);assert.equal(r.drawn.length,3);assert.equal(r.omitted.length,0);assert.ok(r.drawn.some(l=>l.rows.length===2));
});
