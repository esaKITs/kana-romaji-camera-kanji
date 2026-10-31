import assert from 'node:assert/strict';
import {chromium,webkit} from '../meikiocr-test/node_modules/playwright/index.mjs';
import {createPagesServer,base} from './pages-server.mjs';
const server=createPagesServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const type=process.env.OCR_BROWSER==='webkit'?webkit:chromium;
const browser=await type.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
 await page.goto('http://127.0.0.1:'+server.address().port+base+'pdf-preview/index.html');
 await page.evaluate(()=>{window.reads=0;const read=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){window.reads++;if(document.getElementById('pdf-file').files[0]===this&&!document.getElementById('pdf-file').value)throw Error('Input cleared before reading');return read.call(this);};});
 await page.locator('#pdf-file').setInputFiles('dist/pdf-preview/sample.pdf');
 await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('PDF opened.'));
 assert.equal(await page.locator('#thumbnails input').count(),3);
 await page.waitForFunction(()=>document.querySelectorAll('#thumbnails canvas').length>0);
 await page.getByRole('checkbox',{name:'Page 1',exact:true}).check();await page.getByRole('checkbox',{name:'Page 3',exact:true}).check();
 assert.match(await page.locator('#selected-count').textContent(),/2 pages/);
 await page.locator('#show').click();await page.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 1 displayed'));
 assert.deepEqual(await page.locator('#page-host canvas').evaluate(c=>[c.width,c.height]),[1801,2400]);
 await page.locator('#next').click();await page.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 3 displayed'));
 assert.equal(await page.evaluate(()=>window.reads),1);
 await page.locator('#previous').click();await page.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 1 displayed'));
 await page.locator('#clear-selection').click();await page.getByRole('checkbox',{name:'Page 2',exact:true}).check();await page.locator('#show').click();
 await page.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 2 displayed'));
 assert.deepEqual(await page.locator('#page-host canvas').evaluate(c=>[c.width,c.height]),[2400,1801]);
 await page.locator('#pdf-file').setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('broken')});
 await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Unable to open PDF:'));
 assert.equal(await page.locator('#document').isVisible(),false);assert.equal(await page.locator('#page-host canvas').count(),0);
 await page.locator('#sample').click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('PDF opened.'));
 await page.locator('#clear').click();assert.equal(await page.locator('#document').isVisible(),false);
 // Read errors are visible rather than leaving a document operation pending.
 await page.evaluate(()=>{File.prototype.arrayBuffer=async()=>{throw new DOMException('Unavailable file','NotFoundError');};});
 await page.locator('#pdf-file').setInputFiles('dist/pdf-preview/sample.pdf');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Unavailable file'));
 assert.equal(await page.locator('#document').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({browser:type.name(),samplePassed:true,oneFileRead:true,selectedPages:[1,3],rotatedPage:true,replacementAndReadErrors:true}));
 if(process.env.PRIVATE_PDF){
  const privatePage=await context.newPage();privatePage.setDefaultTimeout(180000);
  await privatePage.goto('http://127.0.0.1:'+server.address().port+base+'pdf-preview/index.html');
  await privatePage.locator('#pdf-file').setInputFiles(process.env.PRIVATE_PDF);
  await privatePage.waitForFunction(()=>document.getElementById('status').textContent.startsWith('PDF opened.'),{},{timeout:180000});
  const pages=await privatePage.locator('#thumbnails input').count();assert.equal(pages,78);
  await privatePage.getByRole('checkbox',{name:'Page 1',exact:true}).check();await privatePage.locator('#show').click();
  await privatePage.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 1 displayed'),{},{timeout:180000});
  const size=await privatePage.locator('#page-host canvas').evaluate(c=>[c.width,c.height]);
  await privatePage.getByRole('checkbox',{name:'Page 78',exact:true}).check();await privatePage.locator('#next').click();
  await privatePage.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 78 displayed'),{},{timeout:180000});
  console.log(JSON.stringify({browser:type.name(),privatePdfOpened:true,pages,firstAndLastPagesDisplayed:true,size}));
  await privatePage.locator('#clear').click();await privatePage.close();
 }
}finally{await browser.close();server.close();}
