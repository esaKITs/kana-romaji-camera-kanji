import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{createRequire}from'node:module';
import{chromium,webkit}from'../meikiocr-test/node_modules/playwright/index.mjs';import{createPagesServer,base}from'./pages-server.mjs';
const require=createRequire(import.meta.url),{PDFDocument,PDFName,rgb}=require('../meikiocr-test/node_modules/pdf-lib'),{createCanvas}=require('../meikiocr-test/node_modules/@napi-rs/canvas');
let input;
if(process.env.PRIVATE_PDF)input=process.env.PRIVATE_PDF;
else{
 const c=createCanvas(4200,4200),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,4200,4200);ctx.fillStyle='#000';ctx.fillRect(0,0,2100,2100);ctx.fillStyle='#f00';ctx.fillRect(2100,2100,2100,2100);
 const jpeg=c.toBuffer('image/jpeg');c.width=c.height=1;
 const pdf=await PDFDocument.create(),image=await pdf.embedJpg(jpeg),page=pdf.addPage([420,420]);
 page.node.set(PDFName.of('Resources'),pdf.context.obj({XObject:{Scan:image.ref}}));page.node.set(PDFName.of('Contents'),pdf.context.register(pdf.context.flateStream('q\n420 0 0 420 0 0 cm\n/Scan Do\nQ\n')));
 const overlay=pdf.addPage([420,420]);overlay.node.set(PDFName.of('Resources'),pdf.context.obj({XObject:{Scan:image.ref}}));overlay.node.set(PDFName.of('Contents'),pdf.context.register(pdf.context.flateStream('q\n420 0 0 420 0 0 cm\n/Scan Do\nQ\n')));overlay.drawRectangle({x:0,y:0,width:420,height:210,color:rgb(0,0,1)});
 input={name:'large-scan.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())};
}
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const type=process.env.OCR_BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try{
 const page=await browser.newPage();await page.addInitScript(()=>{
  const original=createImageBitmap;window.__bitmaps=[];window.createImageBitmap=async(...args)=>{const bitmap=await original(...args);window.__bitmaps.push({width:bitmap.width,height:bitmap.height,requested:args[1]});return bitmap;};
  const OriginalWorker=Worker;window.Worker=class extends OriginalWorker{constructor(url,opts){if(String(url).includes('lab/worker-v2'))throw Error('test-stop-after-pdf-render');super(url,opts);}};
  window.__pageCanvases=[];const originalContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){const ctx=originalContext.apply(this,args);if(ctx&&this.width===1751&&this.height===1751&&!window.__pageCanvases.includes(this))window.__pageCanvases.push(this);if(ctx&&args[0]==='2d'&&!ctx.__scanWrapped){ctx.__scanWrapped=true;const draw=ctx.drawImage;ctx.drawImage=function(...a){const result=draw.apply(this,a);if(a[0] instanceof ImageBitmap)window.__scanCanvas=this.canvas;return result;};}return ctx;};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+base);await page.locator('#image').setInputFiles(input);await page.locator('#pdf-dialog').waitFor({state:'visible',timeout:60000});await page.locator('#pdf-convert').click();
 await page.waitForFunction(()=>document.getElementById('pdf-failure-message').textContent.includes('test-stop-after-pdf-render'),{},{timeout:90000});
 const stats=await page.evaluate(()=>({report:JSON.parse(sessionStorage.getItem('romaji-pdf-last-operation-v1')),bitmaps:window.__bitmaps,canvas:{width:window.__scanCanvas.width,height:window.__scanCanvas.height},samples:[[.25,.25],[.75,.25],[.75,.75]].map(([x,y])=>[...window.__scanCanvas.getContext('2d').getImageData(Math.floor(x*window.__scanCanvas.width),Math.floor(y*window.__scanCanvas.height),1,1).data])}));
 assert.ok(stats.report.events.some(e=>e.phase==='page-jpeg-decode'));assert.ok(stats.report.events.some(e=>e.phase==='page-jpeg-paint'));assert.equal(stats.report.error.phase,'ocr-initialize');assert.ok(!stats.report.events.some(e=>e.phase==='page-paint'),'large scan must bypass PDF.js image expansion');assert.equal(stats.bitmaps.length,1);assert.equal(stats.bitmaps[0].width,stats.bitmaps[0].requested.resizeWidth);assert.equal(stats.bitmaps[0].height,stats.bitmaps[0].requested.resizeHeight);
 if(!process.env.PRIVATE_PDF){assert.deepEqual(stats.canvas,{width:1751,height:1751});assert.ok(stats.samples[0][0]<5,'top-left remains black');assert.ok(stats.samples[1][0]>250&&stats.samples[1][1]>250,'top-right remains white');assert.ok(stats.samples[2][0]>240&&stats.samples[2][1]<10,'bottom-right remains red');}
 console.log(JSON.stringify({browser:type.name(),private:!!process.env.PRIVATE_PDF,canvas:stats.canvas,bitmap:stats.bitmaps[0],path:stats.report.events.map(e=>e.phase)}));
 if(!process.env.PRIVATE_PDF){
  await page.locator('#pdf-failure-close').click();await page.locator('#pdf-pages').click();await page.getByRole('checkbox',{name:'Page 1',exact:true}).uncheck();await page.getByRole('checkbox',{name:'Page 2',exact:true}).check();await page.locator('#pdf-convert').click();
  await page.waitForFunction(()=>{const r=JSON.parse(sessionStorage.getItem('romaji-pdf-last-operation-v1'));return r?.error?.message==='test-stop-after-pdf-render'&&r.events.some(e=>e.phase==='page-paint');},{},{timeout:90000});
  const fallback=await page.evaluate(()=>({report:JSON.parse(sessionStorage.getItem('romaji-pdf-last-operation-v1')),sample:[...window.__pageCanvases.at(-1).getContext('2d').getImageData(1313,1313,1,1).data],canvases:window.__pageCanvases.length}));
  assert.ok(fallback.canvases>=2);assert.ok(!fallback.report.events.some(e=>e.phase==='page-jpeg-decode'),'page with overlay must retain the PDF.js path');assert.ok(fallback.sample[0]<10&&fallback.sample[1]<10&&fallback.sample[2]>240,'vector overlay must remain blue');console.log(JSON.stringify({overlayFallback:true,sample:fallback.sample}));
 }
 if(process.env.PRIVATE_PREVIEW){const data=await page.evaluate(()=>window.__scanCanvas.toDataURL('image/png'));const {writeFile}=await import('node:fs/promises');await writeFile(process.env.PRIVATE_PREVIEW,Buffer.from(data.split(',')[1],'base64'));}
}finally{await browser.close();server.close();}
