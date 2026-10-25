import{createRequire}from'node:module';import{readFile,writeFile}from'node:fs/promises';import assert from'node:assert/strict';import{server}from'./browser-server-v2.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');const recorded=JSON.parse(await readFile('../results/numeric-still.json','utf8'));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 const page=await browser.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base+'/'))external.push(r.url())});await page.goto(base);await page.waitForFunction(()=>!!window.stillLab);
 const results=await page.evaluate(async recorded=>{
  const image=new Image();image.src='/fixtures/numeric.png';await image.decode();const source=document.createElement('canvas');source.width=image.width;source.height=image.height;source.getContext('2d').drawImage(image,0,0);
  return recorded.variants.map(variant=>{const output=document.createElement('canvas');return{mode:variant.mode,style:variant.style,...stillLab.renderResult(output,source,{...recorded.result,...variant}),width:output.width,height:output.height};});
 },recorded);
 const overlaps=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.y1,b.y1)>Math.max(a.y0,b.y0);
 for(const result of results)for(const [i,label]of result.drawn.entries()){
  const box=label.displayBox;assert.ok(box.x0>=0&&box.x1<=result.width&&box.y0>=0&&box.y1<=result.height);assert.ok(label.horizontalScale>=.7);assert.equal(label.rows.join(''),label.output);
  assert.ok(!result.drawn.slice(i+1).some(other=>overlaps(box,other.displayBox)),'label collision');
  const line=recorded.result.lines.find(l=>l.id===label.lineId);
  for(const glyph of line.glyphs){if(/^[0-9０-９A-Za-z]+$/.test(glyph.text))assert.ok(!overlaps(box,glyph.box),'digit/Latin covered');if(result.mode==='漢'&&/^[ぁ-ゖァ-ヺ]+$/.test(glyph.text))assert.ok(!overlaps(box,glyph.box),'kana covered in Han mode');if(result.mode==='ア漢'&&/^[ぁ-ゖ]+$/.test(glyph.text))assert.ok(!overlaps(box,glyph.box),'hiragana covered');}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await writeFile('../results/layout-chromium.json',JSON.stringify({browser:browser.version(),environment:'Linux Chromium, replay of actual OCR snapshot from authored raster; not physical camera',errors,external,results},null,2)+'\n');
 console.log(results.map(r=>({mode:r.mode,style:r.style,drawn:r.drawn.length,omitted:r.omitted.map(l=>[l.source,l.reason]),wrapped:r.drawn.filter(l=>l.rows.length===2).length})));
}finally{await browser.close();server.close()}
