// Actual user-provided JPEG -> actual models -> analyzer -> final composited pixels.
// No mocked OCR or dictionary and no application-specific coordinate/word fixes.
import assert from'node:assert/strict';import{readFile,mkdir,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{chromium}from'../meikiocr-test/node_modules/playwright/index.mjs';import{createPagesServer,base}from'./pages-server.mjs';
const file='tests/fixtures/textbook-original.jpg',bytes=await readFile(file);assert.equal(createHash('sha256').update(bytes).digest('hex'),'2a4ad9f8f6fd719680b534f14366f7ac25fe8206a4b5122d931e268d76020e37');
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const page=await browser.newPage({viewport:{width:590,height:1280},hasTouch:true,isMobile:true});
const output='test-results/textbook';await mkdir(output,{recursive:true});const cases=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const expected=[['この','kono'],['町','machi'],['は','wa'],['きれい','kiree'],['です','desu'],['にぎやか','nigiyaka'],['おもしろい','omoshiroi'],['いい','ii'],['どう','doo'],['か','ka']];
function verify(run,{style='double'}={}){
 assert.ok(run,'Actual scan completed');assert.deepEqual(run.result.withheld,[]);assert.deepEqual(run.rendering.omitted,[]);
 const macron={'いい':'ī','どう':'dō','きれい':'kirē'};
 for(const [source,text]of expected){const labels=run.rendering.drawn.filter(l=>l.source===source);assert.equal(labels.length,1,source+' has exactly one visible label');assert.equal(labels[0].output,style==='macron'?(macron[source]||text):text,source);}
 assert.equal(run.rendering.drawn.length,10);assert.equal(run.result.pairs.length,1);assert.equal(run.result.pairs[0].reading,'まち');
 const label=run.rendering.drawn.find(l=>l.source==='町'),pair=run.result.pairs[0];assert.equal(label.coversRuby,true);for(const b of [pair.box,pair.rubyBox])assert.ok(label.box.x0<=b.x0&&label.box.x1>=b.x1&&label.box.y0<=b.y0&&label.box.y1>=b.y1);
 assert.ok(label.displayBox.y0>=pair.box.y0,'machi remains on the body baseline');assert.ok(run.recovery.regions.length<=6);
}
try{
 await page.goto('http://127.0.0.1:'+server.address().port+base);await page.locator('#image').setInputFiles(file);await page.waitForFunction(()=>/^Still · \d+ shown/.test(document.getElementById('scan-label').textContent),{},{timeout:180000});
 const run=await page.evaluate(()=>window.stillLab.lastRun);verify(run);
 // Count the source ruby's actual ink and prove no dark Japanese pixels remain
 // there after the real paint path. The romaji is anchored below this rectangle.
 const pixels=await page.evaluate(async data=>{const image=await createImageBitmap(await(await fetch('data:image/jpeg;base64,'+data)).blob()),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);image.close();const output=document.getElementById('output'),r=window.stillLab.lastRun,b=r.result.pairs[0].rubyBox;const dark=(ctx,b)=>{const p=ctx.getImageData(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0).data;let n=0;for(let i=0;i<p.length;i+=4)if((p[i]+p[i+1]+p[i+2])/3<140)n++;return n;};return{sourceRubyInk:dark(x,b),remainingRubyInk:dark(output.getContext('2d'),b),canvasWidth:output.width,canvasHeight:output.height};},bytes.toString('base64'));
 assert.ok(pixels.sourceRubyInk>20);assert.equal(pixels.remainingRubyInk,0);assert.deepEqual([pixels.canvasWidth,pixels.canvasHeight],[1179,620]);
 await page.screenshot({path:output+'/screen.png'});const png=await page.locator('#output').evaluate(c=>c.toDataURL('image/png').split(',')[1]);await writeFile(output+'/rendered.png',Buffer.from(png,'base64'));await writeFile(output+'/trace.json',JSON.stringify(run,null,2));cases.push({name:'original JPEG through actual UI',passed:true,timings:run.timings,elapsedMs:run.elapsedMs,pixels});
 await page.locator('#long-vowels').click();await page.waitForFunction(()=>window.stillLab.lastRun?.result.style==='macron');verify(await page.evaluate(()=>window.stillLab.lastRun),{style:'macron'});cases.push({name:'same JPEG / macron UI toggle',passed:true});
 for(const mode of ['ア漢','漢','あア漢']){await page.locator('#kana-mode').click();await page.waitForFunction(mode=>window.stillLab.lastRun?.result.mode===mode,mode);const r=await page.evaluate(()=>window.stillLab.lastRun);if(mode==='あア漢')verify(r,{style:'macron'});else{assert.equal(r.rendering.drawn.length,1);assert.equal(r.rendering.drawn[0].output,'machi');assert.equal(r.rendering.drawn[0].coversRuby,true);}cases.push({name:'same JPEG / '+mode,passed:true});}
 await page.locator('#long-vowels').click();await page.waitForFunction(()=>window.stillLab.lastRun?.result.style==='double');verify(await page.evaluate(()=>window.stillLab.lastRun));
 // Re-sampling the same image changes detector boundary scores, as mobile decode
 // can. Expected readings are fixed; neither these scales nor words reach app code.
 for(const scale of [.5,1.5]){
  const next=await page.evaluate(async({data,scale})=>{const image=await createImageBitmap(await(await fetch('data:image/jpeg;base64,'+data)).blob()),source=document.createElement('canvas');source.width=Math.round(image.width*scale);source.height=Math.round(image.height*scale);source.getContext('2d').drawImage(image,0,0,source.width,source.height);image.close();const output=document.createElement('canvas');return await window.stillLab.runStill(source,{output});},{data:bytes.toString('base64'),scale});verify(next);await writeFile(output+'/trace-scale-'+scale+'.json',JSON.stringify(next,null,2));cases.push({name:'same JPEG resampled '+scale,passed:true,timings:next.timings,elapsedMs:next.elapsedMs});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,cases,errors}));
}catch(error){console.error(error);process.exitCode=1;cases.push({passed:false,error:String(error)});}finally{await writeFile(output+'/summary.json',JSON.stringify({passed:!process.exitCode,cases,errors},null,2));await browser.close();await new Promise(r=>server.close(r));}
