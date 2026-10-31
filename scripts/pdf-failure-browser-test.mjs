import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{chromium,webkit}from'../meikiocr-test/node_modules/playwright/index.mjs';import{createPagesServer,base}from'./pages-server.mjs';
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const type=process.env.OCR_BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try{for(const mode of ['render','ocr-initialize','parse']){
 const page=await browser.newPage();
 await page.addInitScript(mode=>{
  if(mode==='render'){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){if(this.width>=1000)throw Error('injected-page-render-failure');return original.apply(this,args);};}
  if(mode==='ocr-initialize'){const Original=Worker;window.Worker=class extends Original{constructor(url,options){if(String(url).includes('lab/worker-v2'))throw Error('injected-ocr-init-failure');super(url,options);}};}
 },mode);
 await page.goto('http://127.0.0.1:'+server.address().port+base);
 if(mode==='parse')await page.locator('#image').setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
 else{await page.locator('#sample-pdf').click();await page.locator('#pdf-dialog').waitFor({state:'visible',timeout:60000});await page.locator('#pdf-convert').click();}
 await page.waitForFunction(()=>document.getElementById('pdf-failure-tools')?.hidden===false,{},{timeout:60000});
 const report=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('romaji-pdf-last-operation-v1')));
 assert.equal(report.error.phase,mode==='render'?'page-render':mode==='parse'?'pdf-parse':'ocr-initialize');assert.equal(report.complete,false);
 if(mode!=='parse')assert.match(report.error.message,/injected-/);
 assert.ok(!(await page.locator('#document-status').innerText()).includes('Please retry'));
 await page.reload();await page.locator('#pdf-failure-tools').waitFor({state:'visible'});assert.ok((await page.locator('#pdf-failure-tools').innerText()).includes(report.error.message));
 const pending=page.waitForEvent('download');await page.locator('#pdf-failure-tools button').first().click();const saved=await pending;assert.deepEqual(JSON.parse(await readFile(await saved.path(),'utf8')),report);
 console.log(JSON.stringify({mode,phase:report.error.phase,persisted:true,downloaded:true}));await page.close();
}}finally{await browser.close();server.close();}
