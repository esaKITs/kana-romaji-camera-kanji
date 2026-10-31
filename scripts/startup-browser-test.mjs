import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{chromium,webkit}from'../meikiocr-test/node_modules/playwright/index.mjs';import{createPagesServer,base}from'./pages-server.mjs';
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const type=process.env.OCR_BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try{for(const mode of ['normal','startup-failure','pdf-failure']){
 const page=await browser.newPage();
 if(mode==='startup-failure')await page.route(/\/assets\/index-[^/]+\.js$/,r=>r.fulfill({body:'throw new Error("startup-before-handlers");',contentType:'text/javascript'}));
 if(mode==='pdf-failure')await page.route(/\/assets\/pdf-io-[^/]+\.js$/,r=>r.fulfill({body:'throw new Error("pdf-module-import-failed");',contentType:'text/javascript'}));
 await page.goto('http://127.0.0.1:'+server.address().port+base+'startup/index.html');await page.waitForFunction(()=>!document.getElementById('startup-save').disabled,{},{timeout:60000});
 const pending=page.waitForEvent('download');await page.locator('#startup-save').click();const download=await pending,report=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(report.schema,'romaji-startup-check-v1');assert.match(report.appTitle,/v0\.2\.31/);assert.ok(report.entry.includes('/assets/index-'));
 if(mode==='normal'){assert.equal(report.errors.length,0);assert.equal(report.pdf.pageDialogOpen,true);assert.equal(report.pdf.pageCount,3);assert.equal(report.handlers.file,'function');assert.ok(report.steps.some(s=>s.phase==='sample-pdf-opened'));}
 else{assert.ok(report.errors.length);assert.ok(report.errors.some(e=>e.message.includes(mode==='startup-failure'?'startup-before-handlers':'pdf-module-import-failed')));assert.equal(report.errors.at(-1).phase,mode==='startup-failure'?'app-startup':'sample-pdf-open');}
 console.log(JSON.stringify({mode,passed:true,steps:report.steps.map(s=>s.phase),errors:report.errors.map(e=>({phase:e.phase,message:e.message}))}));await page.close();
}}finally{await browser.close();server.close();}
