import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSnapshot} from '../../still-prototype/pipeline.mjs';
import {normalizeRegions} from '../../still-prototype/regions.mjs';
import {allocateLabels} from '../../still-prototype/layout.mjs';
import {StillViewport,bindStillZoom} from '../../camera-prototype/zoom.mjs';
const line=(text,x,y,h=40,unit=30)=>({text,orientation:'horizontal',glyphs:[...text].map((text,i)=>({text,confidence:.95,box:[x+i*unit,y,x+(i+1)*unit,y+h]}))});
const token=(surface,reading)=>({surface,reading,start:0,end:surface.length,pos:['名詞'],unknown:false});
const readings={'町':'マチ','学校':'ガッコウ','どう':'ドウ','いい':'イイ','か':'カ','きれい':'キレイ'};
const analyze=async text=>[token(text,readings[text]||text)];
const snapshot={lines:[line('まち',30,5,12,15),line('町',30,30)]};
test('verified machi covers ruby and body exactly once in every display mode',async()=>{
 for(const mode of ['あア漢','ア漢','漢']){
  const r=await analyzeSnapshot(snapshot,analyze,{mode,verifyRuby:async()=> 'まち'});
  assert.equal(r.labels.length,1);assert.equal(r.labels[0].output,'machi');assert.equal(r.labels[0].coversRuby,true);
  assert.deepEqual(r.labels[0].box,{x0:30,x1:60,y0:5,y1:70});
  const layout=allocateLabels(r,300,120,(t,f)=>t.length*f*.5);assert.equal(layout.drawn.length,1);assert.equal(layout.omitted.length,0);
 }
});
test('consecutive ruby words on a single Han run keep distinct associations',async()=>{
 const s={lines:[line('まち',20,5,12,15),line('ひと',50,5,12,15),line('町人',20,30)]};
 const r=await analyzeSnapshot(s,analyze,{verifyRuby:async c=>c.reading});
 assert.deepEqual(r.labels.map(l=>l.output),['machi','hito']);assert.equal(r.pairs.length,2);
});
test('nearby unrelated glyphs prevent a destructive ruby union',async()=>{
 const s={lines:[...snapshot.lines,line('。',40,20,8,8)]};
 const r=await analyzeSnapshot(s,analyze,{verifyRuby:async c=>c.reading});assert.equal(r.pairs.length,0);
});
test('unverified ruby does not create a merged mask',async()=>{
 const r=await analyzeSnapshot(snapshot,analyze,{verifyRuby:async()=> 'まつ'});assert.equal(r.pairs.length,0);assert.ok(r.labels.every(l=>!l.coversRuby));
});
test('ordinary dictionary kanji readings remain available without ruby',async()=>{
 const r=await analyzeSnapshot({lines:[line('学校',20,30)]},analyze);assert.equal(r.labels[0].output,'gakkoo');
});
for(const [text,expected,macron] of [['いい','ii','ī'],['どう','doo','dō'],['か','ka','ka'],['きれい','kiree','kirē']])test('recognized '+text+' keeps existing vowel rules',async()=>{
 for(const [style,output] of [['double',expected],['macron',macron]]){
  const r=await analyzeSnapshot({lines:[line(text,20,30)]},analyze,{style});assert.equal(r.labels[0].output,output);
 }
});
test('duplicate OCR regions disappear while adjacent identical characters survive',async()=>{
 const s={lines:[line('い',20,30),line('い',20,30),line('い',50,30)]};
 const r=await analyzeSnapshot(s,analyze);assert.equal(r.regionDiagnostics.duplicates,1);assert.equal(r.labels.length,1);assert.equal(r.labels[0].output,'ii');assert.deepEqual(r.labels[0].box,{x0:20,x1:80,y0:30,y1:70});
});
test('conflicting OCR text is never rewritten from geometry alone',()=>{
 const s={lines:[line('し',20,30),line('い',20,30)]};const r=normalizeRegions(s);assert.equal(r.lines.length,2);assert.equal(r.regionDiagnostics.duplicates,0);
});
test('irregular choices, short small kana and bottom edge retain their own coordinates',async()=>{
 const s={lines:[line('どう',300,550),line('か',500,550),line('いい',320,390),line('きれい',200,30),line('か',5,590,10,8)]};
 const original=JSON.stringify(s),r=await analyzeSnapshot(s,analyze),layout=allocateLabels(r,650,600,(t,f)=>t.length*f*.5);
 assert.equal(layout.drawn.length,5);assert.equal(layout.omitted.length,0);assert.equal(JSON.stringify(s),original);
 for(const label of layout.drawn){assert.ok(label.displayBox.x0<label.box.x1&&label.displayBox.x1>label.box.x0);assert.ok(label.displayBox.y1<=600);}
});
test('zoom preserves the pinch anchor, clamps scale and bounds panning',()=>{
 const view=new StillViewport();view.resize(400,300,400,300);view.zoom(2,50,20);
 assert.deepEqual([view.scale,view.x,view.y],[2,-50,-20]);assert.equal(50*view.scale+view.x,50);assert.equal(20*view.scale+view.y,20);
 view.resize(390,844,1179,620);view.zoom(100);assert.equal(view.scale,8);
 view.pan(1e6,-1e6);assert.ok(Math.abs(view.x)<1400);assert.ok(Math.abs(view.y)<1400);view.reset();assert.deepEqual([view.scale,view.x,view.y],[1,0,0]);
});
test('pointer pinch, one-finger pan, double tap and mode exit use a shared transform',()=>{
 const events={},layer={style:{},parentElement:{getBoundingClientRect:()=>({width:400,height:300,left:0,top:0})},addEventListener:(type,f)=>events[type]=f,setPointerCapture(){}};
 const zoom=bindStillZoom(layer,()=>({width:400,height:300}));zoom.setActive(true);
 const send=(type,id,x,y,time)=>events[type]({type,pointerId:id,clientX:x,clientY:y,timeStamp:time,preventDefault(){}});
 send('pointerdown',1,100,150,0);send('pointerdown',2,200,150,10);send('pointermove',2,300,150,20);assert.equal(zoom.view.scale,2);
 send('pointerup',2,300,150,30);const before=zoom.view.x;send('pointermove',1,130,150,40);assert.equal(zoom.view.x,before+30);send('pointerup',1,130,150,50);
 send('pointerdown',1,150,150,100);send('pointerup',1,150,150,130);send('pointerdown',1,150,150,250);send('pointerup',1,150,150,280);assert.equal(zoom.view.scale,1);
 zoom.setActive(false);assert.equal(layer.style.transform,'');send('pointerdown',1,100,100,300);send('pointermove',1,200,100,350);assert.equal(layer.style.transform,'');
});
test('landscape resize clamps translation without moving labels independently',()=>{
 const view=new StillViewport();view.resize(390,844,1179,620);view.zoom(8);view.pan(500,500);view.resize(844,390,1179,620);assert.equal(view.scale,8);assert.ok(Number.isFinite(view.x)&&Number.isFinite(view.y));view.zoom(1);assert.deepEqual([view.x,view.y],[0,0]);
});
