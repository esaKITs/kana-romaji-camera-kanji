import {chromium} from '../meikiocr-test/node_modules/playwright/index.mjs';
import {createPagesServer,base} from './pages-server.mjs';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const input=process.env.PPOCR_IMAGE;assert.ok(input,'Set PPOCR_IMAGE to actual textbook');
await mkdir('test-results/ppocr',{recursive:true});
await copyFile('tests/fixtures/ppocr-experiment-21a0546.html','dist/ppocr-experiment/baseline.html');
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
 await page.goto(root+'?ocr=ppocr');await page.locator('#image').setInputFiles(input);await page.waitForFunction(()=>window.stillLab?.lastRun||/Unable to read/.test(document.querySelector('#status').textContent),{},{timeout:240000});
 const camera=await page.evaluate(()=>window.stillLab.lastRun);assert.ok(camera);assert.deepEqual(camera.snapshot.rawRegions,baseline.raw);assert.deepEqual(camera.snapshot.classifiedRegions,baseline.classified);
 await writeFile('test-results/ppocr/camera.json',JSON.stringify(camera,null,2));await page.screenshot({path:'test-results/ppocr/camera.png'});
 console.log(JSON.stringify({passed:true,raw:baseline.raw.length,classified:baseline.classified.length,labels:camera.rendering.drawn.length,omitted:camera.rendering.omitted.length}));
}finally{await browser.close();server.close();}
