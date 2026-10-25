import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import{chromium}from'../meikiocr-test/node_modules/playwright/index.mjs';
import{createPagesServer,base}from'./pages-server.mjs';
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
const requests=[],errors=[],failedResponses=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()});});
let result;
try{
 await page.goto(origin+base);assert.equal(await page.locator('#kana-mode').innerText(),'あア漢');
 await page.locator('#sample').click();
 await page.waitForFunction(()=>/^(Still · \d+ shown|Unable to read:)/.test(document.getElementById('scan-label').textContent),{},{timeout:180000});
 assert.match(await page.locator('#scan-label').innerText(),/^Still · \d+ shown/);
 const first=await page.evaluate(()=>{const r=window.stillLab.lastRun;return{elapsedMs:r.elapsedMs,timings:r.timings,labels:r.rendering.drawn.length,rawText:r.rawText,regionDiagnostics:r.result.regionDiagnostics}});
 console.log('Sample OCR complete:',first.labels,'labels;',Math.round(first.elapsedMs),'ms');
 assert.ok(first.labels>0,'real OCR of the generated Japanese sample emits labels');assert.match(first.rawText,/[\p{Script=Han}ぁ-ゖ]/u);
 const canvas=page.locator('#output'),before=await canvas.evaluate(c=>({width:c.width,height:c.height}));
 // Real DOM Pointer Events exercise the same handlers used by touch input.
 const gestures=await page.evaluate(()=>{const layer=document.getElementById('zoom-layer'),send=(type,id,x,y)=>layer.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',bubbles:true}));
  // Dispatch down without pointer capture for synthetic events (the browser rejects capture for inactive synthetic IDs).
  const original=layer.setPointerCapture;layer.setPointerCapture=()=>{};
  send('pointerdown',1,100,420);send('pointerdown',2,200,420);send('pointermove',2,300,420);const pinch=layer.style.transform;send('pointerup',2,300,420);send('pointermove',1,130,420);const pan=layer.style.transform;send('pointerup',1,130,420);layer.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));const reset=layer.style.transform;layer.setPointerCapture=original;return{pinch,pan,reset};});
 assert.match(gestures.pinch,/scale\(2\)/);assert.notEqual(gestures.pan,gestures.pinch);assert.match(gestures.reset,/scale\(1\)/);
 assert.deepEqual(await canvas.evaluate(c=>({width:c.width,height:c.height})),before);
 for(const mode of ['ア漢','漢','あア漢']){await page.locator('#kana-mode').click();await page.waitForFunction(mode=>window.stillLab.lastRun?.result.mode===mode,mode,{timeout:60000});assert.equal(await page.locator('#kana-mode').innerText(),mode);}
 await page.locator('#long-vowels').click();await page.waitForFunction(()=>window.stillLab.lastRun?.result.style==='macron',{},{timeout:60000});assert.equal(await page.locator('#long-vowels').innerText(),'ā');
 await page.setViewportSize({width:844,height:390});assert.equal(await page.locator('#live-return').isVisible(),true);assert.equal(await page.locator('#retry').isVisible(),true);assert.equal(await page.locator('#long-vowels').isVisible(),true);
 await page.locator('#retry').click();await page.waitForFunction(()=>/^Still · \d+ shown/.test(document.getElementById('scan-label').textContent),{},{timeout:180000});
 await page.locator('#live-return').click();await page.waitForFunction(()=>!document.body.classList.contains('camera-active'));assert.equal(await page.locator('#zoom-layer').evaluate(e=>e.style.transform),'');
 console.log('Still modes, long-vowel toggle, gestures and landscape controls passed.');
 // Real video/canvas/Worker pipeline using a generated camera stream; no hardware claim.
 await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);const stream=c.captureStream(8);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>stream});},origin+base+'fixtures/numeric.png');
 await page.locator('#start').click();await page.waitForFunction(()=>/^Live · \d+ labels/.test(document.getElementById('scan-label').textContent),{},{timeout:120000});
 await page.locator('#scan').click();await page.waitForFunction(()=>/^Still · \d+ shown/.test(document.getElementById('scan-label').textContent),{},{timeout:120000});
 await page.locator('#live-return').click();await page.waitForFunction(()=>/^Live · \d+ labels/.test(document.getElementById('scan-label').textContent),{},{timeout:120000});await page.locator('#stop').click();await page.waitForFunction(()=>!document.body.classList.contains('camera-active'));
 console.log('Synthetic camera Live → Still → Live → Home passed.');
 const leaks=requests.filter(r=>r.url.startsWith('http')&&(!r.url.startsWith(origin+base)||r.method!=='GET'));assert.deepEqual(leaks,[],'no root-path requests, external image uploads or first-edition dependencies');assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);
 assert.ok(requests.some(r=>r.url.endsWith('manifest.json')));assert.ok(requests.some(r=>r.url.includes('/lab/vendor/kuromoji/dict/')));
 result={passed:true,kind:'Chromium actual on-device OCR of generated sample; DOM gesture simulation, not physical mobile',first,gestures,requests:requests.length,externalOrRootRequests:leaks,errors};
}catch(error){result={passed:false,error:String(error),status:await page.locator('#scan-label').innerText().catch(()=>null),errors,failedResponses,requests};process.exitCode=1;console.error(error);}finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/browser.json',JSON.stringify(result,null,2)+'\n');await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(result));
