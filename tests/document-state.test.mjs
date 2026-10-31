import {test} from 'node:test';import assert from 'node:assert/strict';
import {DocumentState} from '../kanji-reading/camera-prototype/document-state.mjs';import {exportName} from '../kanji-reading/camera-prototype/documents.mjs';import {renderPdfPage,createImagePdf} from '../kanji-reading/camera-prototype/pdf-io.mjs';
test('PDF selection preserves original page order, excludes unselected pages and tracks conversions per resolution',()=>{
 const d=new DocumentState();assert.equal(d.dpi,600);d.replace({numPages:5},'教材.pdf');assert.deepEqual(d.pages(),[1]);d.select(5,true);d.select(3,true);assert.deepEqual(d.pages(),[1,3,5]);assert.equal(d.ready(),false);
 const run={snapshot:{rawRegions:[{text:'二十日間',box:[1,2,3,4]}]},result:{mode:'あア漢',style:'double',pairs:[]},rendering:{drawn:[{backgroundPatch:{canvas:{pixelBytes:999}}}]},primarySnapshot:{duplicate:true},recovery:{sourceCanvas:true}};
 const original=structuredClone(run);for(const n of [1,3,5])d.remember(n,run);assert.equal(d.ready(),true);assert.deepEqual(run,original);assert.equal(d.records.get(3).run.rendering,null);assert.ok(!('primarySnapshot' in d.records.get(3).run));assert.ok(!('recovery' in d.records.get(3).run));assert.deepEqual(d.records.get(3).run.snapshot,run.snapshot);
 d.dpi=200;assert.equal(d.ready(),false);d.remember(1,run,200);d.select(3,false);d.select(5,false);assert.equal(d.ready(),true);d.select(1,false);assert.equal(d.ready(),false);assert.throws(()=>d.select(0,true));assert.throws(()=>d.select(6,true));
});
test('replacing or closing a PDF invalidates asynchronous operations and old page results',()=>{
 const d=new DocumentState(),first={numPages:3},second={numPages:2};d.replace(first,'first.pdf');const epoch=d.cancel();assert.ok(d.owns(epoch));d.remember(1,{snapshot:{},result:{},rendering:{}});assert.equal(d.replace(second,'second.pdf'),first);assert.equal(d.owns(epoch),false);assert.equal(d.records.size,0);assert.deepEqual(d.pages(),[1]);const next=d.epoch;assert.equal(d.clear(),second);assert.equal(d.owns(next),false);assert.equal(d.pdf,null);assert.deepEqual(d.pages(),[]);
});
test('oversized PDF pages are rejected before allocating a canvas, with an explicit lower-resolution choice',async()=>{
 let cleaned=0;const pdf={getPage:async()=>({getViewport:({scale})=>({width:1800*scale,height:1800*scale}),cleanup:()=>cleaned++})};
 await assert.rejects(renderPdfPage(pdf,1,300),/too large at 300 dpi.*300, 200 or 150/);assert.equal(cleaned,1);await assert.rejects(renderPdfPage(pdf,1,0),/Invalid PDF resolution/);await assert.rejects(createImagePdf([]),/at least one page/);
});
test('saved filenames identify original PDF pages and preserve Japanese names safely',()=>{assert.equal(exportName('教材.pdf',3,'png'),'教材-page-3-romaji.png');assert.equal(exportName('教材.pdf',0,'pdf'),'教材-romaji.pdf');assert.equal(exportName(null,0,'png'),'kana-romaji.png');assert.ok(!/[<>:"/\\|?*]/.test(exportName('../bad:name.pdf',1,'png')));});

test('default 600 dpi preserves A4 pixels and 300 dpi remains explicit',async()=>{
 const original=globalThis.document;const canvases=[],scales=[];let cleaned=0;
 globalThis.document={createElement:()=>{const c={};canvases.push(c);return c;}};
 const pdf={getPage:async()=>({getViewport:({scale})=>{scales.push(scale);return{width:595.28*scale,height:841.89*scale};},render:({canvas})=>({promise:Promise.resolve(canvas)}),cleanup:()=>cleaned++})};
 try{const fine=await renderPdfPage(pdf,1),small=await renderPdfPage(pdf,1,300);assert.equal(fine.dpi,600);assert.deepEqual([fine.canvas.width,fine.canvas.height],[4961,7016]);assert.deepEqual([small.canvas.width,small.canvas.height],[2481,3508]);assert.equal(cleaned,2);assert.equal(canvases.length,2);assert.deepEqual(scales,[1,600/72,1,300/72]);}finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
