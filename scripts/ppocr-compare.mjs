import {chromium} from '../meikiocr-test/node_modules/playwright/index.mjs';
import {createPagesServer,base} from './pages-server.mjs';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const input=process.env.PPOCR_IMAGE;assert.ok(input,'Set PPOCR_IMAGE to actual textbook');
await mkdir('test-results/ppocr',{recursive:true});
await copyFile('tests/fixtures/ppocr-experiment-21a0546.html','dist/ppocr-experiment/baseline.html');
await copyFile('kanji-reading/camera-prototype/paint.mjs','dist/test-paint.mjs');
await copyFile('kanji-reading/still-prototype/ruby-height.mjs','dist/test-ruby-height.mjs');
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
// Local verified-download transport for environments where Chromium cannot use proxy.
if(process.env.PPOCR_LOCAL_ASSETS)await page.route(/https:\/\/(cdn.jsdelivr.net|huggingface.co)\//,async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);try{await route.fulfill({body:await readFile('.cache/ppocr/'+name),contentType:name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')||name.endsWith('.mjs')?'text/javascript':'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*'}});}catch(e){console.error('ASSET MISSING',name);await route.abort();}});
page.on('console',m=>console.log(m.text()));page.on('pageerror',e=>console.error(e));
try{
 const root='http://127.0.0.1:'+server.address().port+base;
 await page.goto(root+'ppocr-experiment/baseline.html');await page.locator('#file').setInputFiles(input);await page.locator('[value=tiles]').check();await page.locator('[value=classify]').check();await page.locator('#run').click();
 await page.waitForFunction(()=>/比較表示|実行エラー/.test(document.querySelector('#status').textContent),{},{timeout:240000});
 const baseline=await page.evaluate(()=>({raw:lastResults,classified:lastResults?classifyLocal(mergeRecognizedRegions(lastResults)):null,status:document.querySelector('#status').textContent}));assert.ok(baseline.raw,baseline.status);
 await writeFile('test-results/ppocr/baseline.json',JSON.stringify(baseline,null,2));
 await page.goto(root+'ppocr-experiment/index.html');await page.locator('#file').setInputFiles(input);await page.locator('[value=tiles]').check();await page.locator('#run').click();await page.waitForFunction(()=>window.ppocrExperiment||/実行エラー/.test(document.querySelector('#status').textContent),{},{timeout:240000});
 const experiment=await page.evaluate(()=>window.ppocrExperiment);assert.deepEqual(experiment.rawRegions,baseline.raw);assert.deepEqual(experiment.classifiedRegions,baseline.classified);
 await page.locator('#single').check();await page.locator('#run').click();await page.waitForFunction(()=>window.ppocrExperiment?.supplemental,{},{timeout:240000});
 const enhancedExperiment=await page.evaluate(()=>window.ppocrExperiment);
 assert.deepEqual(enhancedExperiment.rawRegions,baseline.raw);
 assert.equal(enhancedExperiment.supplemental.regions.length,3);
 assert.ok(enhancedExperiment.supplemental.regions.every(r=>r.text==='し'));
 await page.goto(root+'?ocr=ppocr');await page.locator('#image').setInputFiles(input);await page.waitForFunction(()=>window.stillLab?.lastRun||/Unable to read/.test(document.querySelector('#status').textContent),{},{timeout:240000});
 const camera=await page.evaluate(()=>window.stillLab.lastRun);assert.ok(camera);assert.deepEqual(camera.snapshot.rawRegions,baseline.raw);assert.deepEqual(camera.snapshot.classifiedRegions,baseline.classified);
 assert.deepEqual(camera.snapshot.supplemental.regions,enhancedExperiment.supplemental.regions);
 const recovered=camera.rendering.drawn.filter(l=>l.source==='し');
 assert.equal(recovered.length,3,'all three isolated shi must be painted');assert.ok(recovered.every(l=>l.output==='shi'));
 assert.equal(camera.rendering.omitted.length,0);
 await writeFile('test-results/ppocr/debug.json',JSON.stringify(camera,null,2));
 for(const [source,output] of [['京都へ','kyooto e'],['お花見を','ohanami o'],['紅茶を買いました','koocha o kaimashita'],['食堂へ','shokudoo e'],['こうべへ','koobe e'],['とうきょう','tookyoo'],['み','mi']])assert.ok(camera.rendering.drawn.some(l=>l.source===source&&l.output===output),source+' must be painted with the expected reading');
 const cover=await page.evaluate(async data=>{
  const {labelReplacesGlyph}=await import('/kana-romaji-camera-kanji/test-ruby-height.mjs');
  const {paintLabels}=await import('/kana-romaji-camera-kanji/test-paint.mjs'),run=window.stillLab.lastRun,layout=run.rendering,result=run.result;
  const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const source=document.createElement('canvas');source.width=im.width;source.height=im.height;source.getContext('2d').drawImage(im,0,0);
  const mask=document.createElement('canvas');paintLabels(mask,source,{drawn:layout.drawn.map(l=>({...l,rows:[]}))},{still:true,reveal:0});
  const width=source.width,height=source.height,src=source.getContext('2d').getImageData(0,0,width,height).data,out=mask.getContext('2d').getImageData(0,0,width,height).data;
  const inside=(x,y,b)=>x>=b.x0&&x<b.x1&&y>=b.y0&&y<b.y1;
  const preserved=result.lines.flatMap(l=>l.glyphs.filter(g=>!layout.drawn.some(label=>labelReplacesGlyph(label,g,l.id))).map(g=>({...g,regionType:l.regionType})));
  let sourceInk=0,residualInk=0,preservedChanges=0,rubyMaskErrors=0,undetectedRubyInk=0,undetectedRubyRemaining=0;
  // Ground-truth annotation た above 食べ is absent from canonical ruby regions.
  for(let y=492;y<518;y++)for(let x=793;x<818;x++){const i=(y*width+x)*4;if((src[i]+src[i+1]+src[i+2])/3<160){undetectedRubyInk++;if((out[i]+out[i+1]+out[i+2])/3<160)undetectedRubyRemaining++;}}
  const coveredRuby=new Set(layout.drawn.flatMap(l=>l.coveredRubyLineIds||[]));
  for(const id of coveredRuby){const ruby=result.lines.find(l=>l.id===id),label=layout.drawn.find(l=>l.coveredRubyLineIds?.includes(id));const b=ruby.box,patch=label.backgroundPatch,pixels=patch?.canvas.getContext('2d').getImageData(0,0,patch.canvas.width,patch.canvas.height).data;for(let y=Math.ceil(b.y0);y<Math.floor(b.y1);y++)for(let x=Math.ceil(b.x0);x<Math.floor(b.x1);x++){const i=(y*width+x)*4;const j=patch?((y-patch.y)*patch.canvas.width+x-patch.x)*4:0;if([0,1,2].some(k=>Math.abs(out[i+k]-(pixels?pixels[j+k]:label.backgroundRgb[k]))>1))rubyMaskErrors++;}}
  for(const label of layout.drawn){
   if(label.backgroundRgb.reduce((a,b)=>a+b,0)/3<160)continue;
   const b=label.bodyBox||label.box,p=Math.ceil((b.y1-b.y0)*.45);
   for(let y=Math.max(0,b.y0-p);y<Math.min(height,b.y1+p);y++)for(let x=Math.max(0,b.x0-p);x<Math.min(width,b.x1+p);x++){
    if(preserved.some(g=>{const q=g.box;return inside(x,y,g.regionType==='ルビ候補'?{x0:q.x0-6,y0:q.y0-6,x1:q.x1+6,y1:q.y1+6}:q)}))continue;
    const i=(y*width+x)*4;if((src[i]+src[i+1]+src[i+2])/3>=160)continue;
    sourceInk++;if((out[i]+out[i+1]+out[i+2])/3<160)residualInk++;
   }
  }
  for(const g of preserved){const b=g.box;for(let y=Math.max(0,Math.ceil(b.y0));y<Math.min(height,Math.floor(b.y1));y++)for(let x=Math.max(0,Math.ceil(b.x0));x<Math.min(width,Math.floor(b.x1));x++){const i=(y*width+x)*4;if([0,1,2,3].some(k=>src[i+k]!==out[i+k]))preservedChanges++;}}
  const de=layout.drawn.find(l=>l.source==='で'),tea=layout.drawn.find(l=>l.source==='紅茶を買いました');
  return {paperPatchCount:layout.drawn.filter(l=>l.backgroundPatch).length,maxDistortion:Math.max(...layout.drawn.map(l=>l.verticalScale/l.horizontalScale)),deFontRatio:de.fontSize/tea.fontSize,deScaleRatio:de.verticalScale/tea.verticalScale,sourceInk,residualInk,preservedChanges,rubyMaskErrors,undetectedRubyInk,undetectedRubyRemaining,coveredRuby:coveredRuby.size,rubyRatio:result.rubyHeightPolicy.upperRatio,fontSize:layout.drawn.find(l=>l.source==='わたしは').fontSize};
 },(await readFile(input)).toString('base64'));
 assert.equal(cover.paperPatchCount,camera.rendering.drawn.length);assert.ok(cover.maxDistortion<=1.65+1e-6);assert.equal(cover.deFontRatio,1,'de and its body row must share the same nominal size');assert.equal(cover.deScaleRatio,1,'adjacent ruby must not shrink de');assert.ok(cover.sourceInk>1000);assert.equal(cover.residualInk,0,'no body source ink may remain through the replacement masks');assert.equal(cover.preservedChanges,0,'unreplaced regions must remain pixel-identical');assert.ok(cover.fontSize>=20,'PP romaji must be larger');assert.equal(cover.coveredRuby,8,'all eight corresponding ruby regions must be covered');assert.equal(cover.rubyMaskErrors,0,'ruby must be fully covered by its parent background');assert.ok(cover.rubyRatio>0);assert.ok(cover.undetectedRubyInk>10);assert.equal(cover.undetectedRubyRemaining,0,'shared ratio also covers undetected ruby above 食べ');
 await writeFile('test-results/ppocr/cover.json',JSON.stringify(cover,null,2));
 await writeFile('test-results/ppocr/camera.json',JSON.stringify(camera,null,2));await page.screenshot({path:'test-results/ppocr/camera.png'});
 for(const mode of ['ア漢','漢','あア漢']){
  await page.locator('#kana-mode').click();await page.waitForFunction(mode=>window.stillLab.lastRun?.result.mode===mode,mode);
  const state=await page.evaluate(()=>{const r=window.stillLab.lastRun;return {raw:r.snapshot.rawRegions,covered:r.rendering.drawn.flatMap(l=>l.coveredRubyLineIds||[]),omitted:r.rendering.omitted,source:r.result.rubyHeightPolicy.source};});
  assert.deepEqual(state.raw,baseline.raw);assert.equal(new Set(state.covered).size,8,'all modes cover the eight owned ruby');assert.equal(state.omitted.length,0);assert.equal(state.source,'observed-ruby');
 }
 await page.goto(root+'?ocr=ppocr');
 await page.evaluate(async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);window.ppocrTestStream=c.captureStream(8);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>window.ppocrTestStream});},(await readFile(input)).toString('base64'));
 await page.locator('#start').click();await page.waitForFunction(()=>/^Live · \d+ labels/.test(document.querySelector('#scan-label').textContent),{},{timeout:240000});
 const live=await page.evaluate(()=>window.stillLab.lastRun);assert.deepEqual(live.snapshot.rawRegions,baseline.raw);assert.deepEqual(live.snapshot.classifiedRegions,baseline.classified);assert.deepEqual(live.snapshot.supplemental.regions,camera.snapshot.supplemental.regions);
 await writeFile('test-results/ppocr/live.json',JSON.stringify(live,null,2));
 await page.locator('#scan').click();await page.waitForFunction(()=>/^Still · \d+ shown/.test(document.querySelector('#scan-label').textContent),{},{timeout:240000});
 console.log(JSON.stringify({livePassed:true,passed:true,raw:baseline.raw.length,classified:baseline.classified.length,supplemental:camera.snapshot.supplemental.regions.length,labels:camera.rendering.drawn.length,omitted:camera.rendering.omitted.length}));
}finally{await browser.close();server.close();}
