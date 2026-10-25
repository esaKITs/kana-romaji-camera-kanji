import {createRequire} from 'node:module';import {writeFile,mkdir} from 'node:fs/promises';import {server} from './browser-server-v2.mjs';import {workerMemory} from './cdp-worker-memory.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 const page=await browser.newPage(),requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>!!window.stillLab);
 const init=await page.evaluate(()=>stillLab.initialize('sudachi-small'));console.log('initialized',init);
 const results=[];
 for(const fixture of ['plain','ruby-school','ruby-food','okurigana']){
  const result=await page.evaluate(async name=>{const image=new Image();image.src='/fixtures/'+name+'.png';await image.decode();const source=document.createElement('canvas');source.width=image.width;source.height=image.height;source.getContext('2d').drawImage(image,0,0);const result=await stillLab.runStill(source,{mode:'あア漢',output:document.getElementById('output')});const modes=[];for(const mode of ['あア漢','ア漢','漢']){const r=await stillLab.analyzeSnapshot(result.snapshot,stillLab.analyze,{mode,verifyRuby:async c=>result.rubyChecks.find(x=>x.first===c.reading)?.second??null});modes.push({mode,result:r});}return {...result,modes,png:document.getElementById('output').toDataURL('image/png')};},fixture);
  await writeFile('../results/still-'+fixture+'.png',Buffer.from(result.png.split(',')[1],'base64'));delete result.png;
  if(fixture==='ruby-school'&&(!result.result.pairs.length||result.result.labels.some(x=>x.source==='がっこう')||!result.rendering.drawn.some(x=>x.source==='学校')))throw Error('Ruby duplication/verification');
  if(fixture==='ruby-food'&&!result.rendering.drawn.some(x=>x.output==='namamono'&&x.readingSource==='verified-ruby'))throw Error('Ruby priority across tokens');
  for(const m of result.modes){if(m.mode==='漢'&&m.result.labels.some(x=>/[ぁ-ゖァ-ヺ]/.test(x.source)))throw Error('Han-only mode covered kana');if(m.mode==='ア漢'&&m.result.labels.some(x=>/[ぁ-ゖ]/.test(x.source)))throw Error('Katakana/Han mode covered hiragana');}
  results.push({fixture,...result});console.log(fixture,result.rawText,JSON.stringify(result.result.pairs.map(x=>[x.source,x.reading])),JSON.stringify(result.result.labels.map(x=>[x.source,x.output])));
 }
 const session=await browser.newBrowserCDPSession();const targets=(await session.send('Target.getTargets')).targetInfos.filter(t=>t.type==='worker');await session.detach();const memory=[];for(const target of targets)memory.push({target:target.url,measurement:await workerMemory(browser,target.url)});
 await page.evaluate(()=>stillLab.dispose());
 const network={requests:requests.length,external:requests.filter(r=>!r.url.startsWith(base+'/')).length,nonGet:requests.filter(r=>r.method!=='GET').length};
 await writeFile('../results/v2-still.json',JSON.stringify({browser:browser.version(),environment:'Linux Chromium; generated horizontal printed-text images; not physical phone/camera',init,memory,network,errors,results},null,2)+'\n');
 if(network.external||network.nonGet||errors.length)throw Error('Network/page errors');
}finally{await browser.close();server.close()}
