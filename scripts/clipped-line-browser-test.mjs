import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium,webkit} from '../meikiocr-test/node_modules/playwright/index.mjs';import {createPagesServer,base} from './pages-server.mjs';
const engine=process.env.OCR_BROWSER||'chromium';
await mkdir('test-results/clipped-line',{recursive:true});
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await (engine==='webkit'?webkit:chromium).launch({...(engine==='webkit'?{}:{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
if(process.env.PPOCR_LOCAL_ASSETS)await page.context().route(/https:\/\/(cdn.jsdelivr.net|huggingface.co)\//,async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);await route.fulfill({body:await readFile('.cache/ppocr/'+name),contentType:name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')||name.endsWith('.mjs')?'text/javascript':'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*'}});});
try{
 await page.goto('http://127.0.0.1:'+server.address().port+base+'?ocr=ppocr');await page.locator('#sample').click();
 await page.waitForFunction(()=>/^(Still · \d+ shown|Unable to read:)/.test(document.querySelector('#scan-label').textContent),{},{timeout:240000});
 assert.match(await page.locator('#scan-label').innerText(),/^Still · \d+ shown/);
 const run=await page.evaluate(()=>window.stillLab.lastRun);await writeFile('test-results/clipped-line/'+engine+'.json',JSON.stringify(run,null,2));await page.screenshot({path:'test-results/clipped-line/'+engine+'.png'});
 console.log(JSON.stringify({engine,raw:run.rawText,effective:run.effectiveText,labels:run.rendering.drawn.map(l=>l.output),verification:run.snapshot.geometryVerification}));
 assert.ok(run.snapshot.lines.some(l=>l.text==='二十日間休みます。'),'same source image must recover 二十日間休みます。');
 assert.ok(run.rendering.drawn.some(l=>l.output==='hatsukakan yasumimasu.'),'complete label must include the correct day count and verb');
}finally{await browser.close();server.close();}
