import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from '../meikiocr-test/node_modules/playwright/index.mjs';
import {createPagesServer,base} from './pages-server.mjs';
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage(),url='http://127.0.0.1:'+server.address().port+base+'diagnostics/index.html';
 const crashes=[];page.on('pageerror',e=>crashes.push(e.message));
 await page.route('**/ocr-assets/manifest.json',route=>route.fulfill({json:{invalid:true}}));
 await page.goto(url);const app=page.frameLocator('#app');
 await app.locator('#sample-pdf').click();await app.locator('#pdf-dialog').waitFor({state:'visible'});await app.locator('#pdf-convert').click();
 await page.waitForFunction(()=>document.getElementById('trace-details').open,{},{timeout:60000});
 async function save(id){const pending=page.waitForEvent('download');await page.locator('#'+id).click();return JSON.parse(await readFile(await(await pending).path(),'utf8'));}
 const failed=await save('save-trace');assert.equal(failed.schema,'romaji-pdf-diagnostic-v1');assert.match(failed.loads.at(-1).title,/v0\.2\.29/);assert.ok(failed.loads.at(-1).scripts.some(s=>s.includes('/assets/index-')));assert.ok(failed.errors.length);assert.ok(failed.errors.some(e=>e.message.includes('Unable to read:')));assert.equal(failed.complete,false);assert.equal(failed.current.dpi,'600');assert.ok(failed.current.canvas.width>0);assert.equal(failed.rawText,undefined);assert.equal(failed.image,undefined);
 await page.reload();await page.locator('#save-previous').waitFor({state:'visible'});const previous=await save('save-previous');assert.deepEqual(previous.errors,failed.errors,'a reload must retain the failed report');assert.deepEqual(crashes,[]);
 console.log(JSON.stringify({passed:true,version:failed.loads.at(-1).title,failureCaptured:true,reloadRetained:true}));
}finally{await browser.close();server.close();}
