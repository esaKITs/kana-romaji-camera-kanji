import assert from 'node:assert/strict';import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {chromium} from '../meikiocr-test/node_modules/playwright/index.mjs';import {createPagesServer,base} from './pages-server.mjs';
await copyFile('tests/fixtures/ppocr-experiment-21a0546.html','dist/ppocr-experiment/numeric-baseline.html');
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
await mkdir('test-results/numeric-counters',{recursive:true});
try{for(const engine of ['meiki','ppocr']){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 if(process.env.PPOCR_LOCAL_ASSETS)await context.route(/https:\/\/(cdn.jsdelivr.net|huggingface.co)\//,async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);await route.fulfill({body:await readFile('.cache/ppocr/'+name),contentType:name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')||name.endsWith('.mjs')?'text/javascript':'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*'}});});
 const origin=process.env.CAMERA_TEST_URL||'http://127.0.0.1:'+server.address().port+base;
 let baseline=null;
 if(engine==='ppocr'&&!process.env.CAMERA_TEST_URL){
  await page.goto(origin+'ppocr-experiment/numeric-baseline.html');await page.locator('#file').setInputFiles('kanji-reading/lab/generated/fixtures/numeric-counters.png');await page.locator('[value=tiles]').check();await page.locator('#run').click();
  await page.waitForFunction(()=>/比較表示|実行エラー/.test(document.querySelector('#status').textContent),{},{timeout:240000});baseline=await page.evaluate(()=>lastResults);assert.ok(baseline);await writeFile('test-results/numeric-counters/ppocr-baseline.json',JSON.stringify(baseline,null,2));
 }
 await page.goto(origin+(engine==='ppocr'?'?ocr=ppocr':''));await page.locator('#image').setInputFiles('kanji-reading/lab/generated/fixtures/numeric-counters.png');
 await page.waitForFunction(()=>/^(Still · \d+ shown|Unable to read:)/.test(document.getElementById('scan-label').textContent),{},{timeout:240000});assert.match(await page.locator('#scan-label').innerText(),/^Still · \d+ shown/);
 const first=await page.evaluate(()=>window.stillLab.lastRun);if(baseline)assert.deepEqual(first.snapshot.rawRegions,baseline,'new numeric fixture also keeps canonical raw inference identical');await writeFile('test-results/numeric-counters/'+engine+'.json',JSON.stringify(first,null,2));
 for(const mode of ['あア漢','ア漢','漢']){
  if(mode!=='あア漢'){await page.locator('#kana-mode').click();await page.waitForFunction(mode=>window.stillLab.lastRun.result.mode===mode,mode);}
  const run=await page.evaluate(()=>window.stillLab.lastRun);assert.deepEqual(run.snapshot,first.snapshot,'mode changes preserve the actual OCR snapshot');
  const output=run.rendering.drawn.map(l=>l.output).join(' ');
  // Gate reading/display against the text actually delivered by OCR. Do not
  // silently turn an OCR error (1人→入) into an invented pronunciation.
  const observed=await page.evaluate(async()=>{const out=[];for(const a of window.stillLab.lastRun.result.analysis){const d=await window.stillLab.diagnoseReading(a.text);out.push(...(d.numericDecisions||[]).filter(n=>n.status==='resolved').map(n=>({surface:n.surface.normalize('NFKC'),lineId:a.lineId})));}return out;});
  const expected=[['20歳','hatachi'],['二十歳','hatachi'],['3本','sambon'],['3時','sanji'],['1人','hitori'],['2人','futari'],['8歳','hassai'],['21歳','nijuuissai'],['20日間','hatsukakan']];
  const missing=expected.filter(([s])=>!observed.some(n=>n.surface===s)).map(([s])=>s);
  for(const surface of ['20歳','3本','3時','20日間'])assert.ok(observed.some(n=>n.surface===surface),engine+' fixture must exercise '+surface);
  for(const [surface,reading]of expected)for(const n of observed.filter(n=>n.surface===surface))assert.ok(run.rendering.drawn.filter(l=>l.lineId===n.lineId).map(l=>l.output).join(' ').includes(reading),engine+' '+mode+' recognized '+surface+' but failed to paint '+reading+' on the same line');
  await writeFile('test-results/numeric-counters/'+engine+'-'+mode+'-coverage.json',JSON.stringify({recognizedCompounds:observed,ocrMissingCompounds:missing,readingFailures:[],omitted:run.rendering.omitted.length},null,2));
  assert.ok(!run.result.withheld.some(t=>t.surface==='歳'),engine+' must not withhold the age suffix');
 }
 await page.locator('#long-vowels').click();await page.waitForFunction(()=>window.stillLab.lastRun.result.style==='macron');
 assert.ok(await page.evaluate(()=>window.stillLab.lastRun.rendering.drawn.some(l=>l.output.includes('hatachi'))));
 const diagnostics=await page.evaluate(async()=>{const r=window.stillLab.lastRun,out=[];for(const a of r.result.analysis.filter(a=>/[0-9０-９二十]+歳|[123３]本|[3３]時/.test(a.text)))out.push({ocr:a.text,...await window.stillLab.diagnoseReading(a.text)});return out;});
 assert.ok(diagnostics.some(d=>d.numericDecisions?.some(n=>n.surface.normalize('NFKC')==='20歳'&&n.reading==='ハタチ'&&n.status==='resolved')));
 assert.ok(diagnostics.every(d=>Array.isArray(d.rawTokens)));await writeFile('test-results/numeric-counters/'+engine+'-diagnosis.json',JSON.stringify(diagnostics,null,2));
 await page.screenshot({path:'test-results/numeric-counters/'+engine+'.png'});console.log(JSON.stringify({engine,passed:true,raw:first.snapshot.lines.length,labels:first.rendering.drawn.length,omitted:first.rendering.omitted.length,readingDisplayPassed:true,canonicalParity:baseline?true:null,coverage:JSON.parse(await readFile('test-results/numeric-counters/'+engine+'-あア漢-coverage.json','utf8'))}));
 await context.close();
}}finally{await browser.close();server.close();}
