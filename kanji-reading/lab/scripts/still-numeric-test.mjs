import{createRequire}from'node:module';import{writeFile}from'node:fs/promises';import assert from'node:assert/strict';import{server}from'./browser-server-v2.mjs';
const{chromium}=createRequire(import.meta.url)('playwright');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 const page=await b.newPage(),requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>!!window.stillLab);const init=await page.evaluate(()=>stillLab.initialize('sudachi-small'));
 const result=await page.evaluate(async()=>{
  const img=new Image();img.src='/fixtures/numeric.png';await img.decode();const source=document.createElement('canvas');source.width=img.width;source.height=img.height;source.getContext('2d').drawImage(img,0,0);const output=document.getElementById('output');
  const result=await stillLab.runStill(source,{output});const variants=[];
  for(const mode of ['あア漢','ア漢','漢'])for(const style of ['double','macron']){const r=await stillLab.analyzeSnapshot(result.snapshot,stillLab.analyze,{mode,style});variants.push({mode,style,labels:r.labels,withheld:r.withheld});}
  return{...result,variants,png:output.toDataURL('image/png')};
 });
 assert.ok(result.rawText.includes('三本'),result.rawText);assert.ok(result.result.labels.some(x=>x.source==='三本'&&x.output==='sambon'));
 const digitLabel=result.result.labels.find(x=>x.source==='本'&&x.reading==='ボン');assert.ok(digitLabel,'Arabic digit preserved, counter bon only');assert.ok(result.rendering.drawn.some(x=>x.source==='本'&&x.output==='bon'),'counter bon must actually render');
 assert.ok(result.result.labels.some(x=>x.source==='中'&&x.output==='juu'),'whole-day suffix must be juu');
 const digitGlyph=result.snapshot.lines[0].glyphs.find(g=>g.text==='3');const bon=result.rendering.drawn.find(x=>x.source==='本'&&x.output==='bon');assert.ok(digitGlyph&&bon.displayBox.x0>=digitGlyph.box[2]-1,'digit box must not be covered');
 for(const variant of result.variants){assert.ok(variant.labels.every(l=>!/[0-9０-９]/.test(l.source)));if(variant.mode==='漢')assert.ok(variant.labels.every(l=>!/[ぁ-ゖァ-ヺ]/.test(l.source)));if(variant.mode==='ア漢')assert.ok(variant.labels.every(l=>!/[ぁ-ゖ]/.test(l.source)));}
 await writeFile('../results/still-numeric.png',Buffer.from(result.png.split(',')[1],'base64'));delete result.png;
 await page.evaluate(()=>stillLab.dispose());const network={requests:requests.length,external:requests.filter(r=>!r.url.startsWith(base+'/')).length,nonGet:requests.filter(r=>r.method!=='GET').length};assert.equal(network.external,0);assert.equal(network.nonGet,0);assert.deepEqual(errors,[]);
 await writeFile('../results/numeric-still.json',JSON.stringify({browser:b.version(),environment:'Linux Chromium; generated raster, actual MeikiOCR; not physical camera',init,network,errors,...result})+'\n');console.log(result.rawText);console.log(result.result.labels.map(l=>[l.source,l.output,l.readingSource]));
}finally{await b.close();server.close()}
