import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const results = 'results';
await mkdir(results,{recursive:true});
await writeFile('index.html','<html><body><pre id="status">Loading</pre><script type="module" src="/main.js"></script></body></html>');
await writeFile('main.js',`import { PaddleOCR } from '@paddleocr/paddleocr-js';
const el=document.getElementById('status');
try {
 el.textContent='Loading models';
 const ocr=await PaddleOCR.create({lang:'ch',ocrVersion:'PP-OCRv5',ortOptions:{backend:'wasm'}});
 el.textContent='Running OCR';
 const blob=await (await fetch('/input.jpg')).blob();
 const [result]=await ocr.predict(blob);
 window.probe={ok:true,image:result.image,items:result.items,metrics:result.metrics,runtime:result.runtime};
 el.textContent='Completed: '+result.items.length+' text lines';
} catch(e) {window.probe={ok:false,error:String(e),stack:e?.stack};el.textContent=String(e);}
`);
const server=await createServer({root:process.cwd(),server:{port:4177,host:'127.0.0.1'},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();
 page.on('console',msg=>console.log('browser:',msg.type(),msg.text()));
 page.on('pageerror',err=>console.error('page error:',err.message));
 await page.goto('http://127.0.0.1:4177/');
 await page.waitForFunction(()=>Boolean(window.probe),{},{timeout:420000});
 const result=await page.evaluate(()=>window.probe);
 await writeFile(results+'/ocr-result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({ok:result.ok,count:result.items?.length,metrics:result.metrics,error:result.error}));
 if(!result.ok || !result.items?.length)process.exitCode=1;
} finally {await browser.close();await server.close();}
