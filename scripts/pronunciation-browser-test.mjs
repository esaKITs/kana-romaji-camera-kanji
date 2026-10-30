import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '../meikiocr-test/node_modules/playwright/index.mjs';import {createPagesServer,base} from './pages-server.mjs';
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
await mkdir('test-results/pronunciation',{recursive:true});
const expected=[['先生','sensee','sensē'],['映画','eega','ēga'],['追う','ou','ou'],['問う','tou','tou'],['雇う','yatou','yatou'],['毛糸','keito','keito'],['目医者','meisha','meisha'],['子牛','koushi','koushi'],['小梅','koume','koume'],['新聞','shimbun','shimbun'],['散歩','sampo','sampo'],['新案','shin’an','shin’an'],['本屋','hon’ya','hon’ya'],['行こう','ikoo','ikō'],['飲もう','nomoo','nomō'],['ねえ','nee','nē'],['ええ','ee','ē']];
try{for(const engine of ['meiki','ppocr']){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 if(process.env.PPOCR_LOCAL_ASSETS)await context.route(/https:\/\/(cdn.jsdelivr.net|huggingface.co)\//,async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);await route.fulfill({body:await readFile('.cache/ppocr/'+name),contentType:name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')||name.endsWith('.mjs')?'text/javascript':'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*'}});});
 await page.goto('http://127.0.0.1:'+server.address().port+base+(engine==='ppocr'?'?ocr=ppocr':''));await page.locator('#image').setInputFiles('kanji-reading/lab/generated/fixtures/pronunciation.png');
 await page.waitForFunction(()=>/^(Still · \d+ shown|Unable to read:)/.test(document.getElementById('scan-label').textContent),{},{timeout:240000});assert.match(await page.locator('#scan-label').innerText(),/^Still · \d+ shown/);
 const first=await page.evaluate(()=>window.stillLab.lastRun),observed=first.result.analysis.map(a=>a.text).join('\n');
 await writeFile('test-results/pronunciation/'+engine+'-initial.json',JSON.stringify(first,null,2));
 // Real OCR recognition and romanization are evaluated separately. Require the
 // fixture to exercise all target spellings, rather than skipping missed words.
 for(const [surface]of expected)assert.ok(observed.includes(surface),engine+' OCR fixture missed '+surface+' in '+observed);
 for(const style of ['double','macron']){
  if(style==='macron'){await page.locator('#long-vowels').click();await page.waitForFunction(()=>window.stillLab.lastRun.result.style==='macron');}
  const run=await page.evaluate(()=>window.stillLab.lastRun);assert.deepEqual(run.snapshot,first.snapshot,'style toggle must not rescan or change raw OCR');
  const output=run.rendering.drawn.map(l=>l.output).join(' ');
  for(const [surface,double,macron]of expected){const word=style==='double'?double:macron;assert.match(output,new RegExp('(?:^|[\\s.,])'+word+'(?=[\\s.,]|$)'),engine+' '+style+' '+surface);}
  for(const phrase of ['iwate e','ido o','ga aru','wa aru'])assert.ok(output.includes(phrase),engine+' '+style+' lost particle boundary '+phrase);
  await writeFile('test-results/pronunciation/'+engine+'-'+style+'.json',JSON.stringify({engine,style,observed,output,run},null,2));await page.screenshot({path:'test-results/pronunciation/'+engine+'-'+style+'.png'});
 }
 console.log(JSON.stringify({engine,passed:true,recognizedTargets:expected.length,styles:2,raw:first.rawText,timings:first.timings}));await context.close();
}}finally{await browser.close();server.close();}
