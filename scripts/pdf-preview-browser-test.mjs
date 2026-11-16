import assert from 'node:assert/strict';
import {chromium,webkit} from '../meikiocr-test/node_modules/playwright/index.mjs';
import {readFile,mkdir} from 'node:fs/promises';
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
 await page.waitForFunction(()=>document.querySelectorAll('#thumbnails img').length>0);
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
 // Large-document regression: phones only request the displayed four pages,
 // revisiting a group reuses its previews, and selection survives pagination.
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),gallery=await mobile.newPage();gallery.setDefaultTimeout(60000);
 const api=await readFile('dist/pdf-preview/vendor/pdf.mjs','utf8');
 await gallery.route('**/vendor/pdf.mjs',route=>route.fulfill({contentType:'text/javascript',body:api+`\nconst originalRender=PDFPageProxy.prototype.render;PDFPageProxy.prototype.render=function(options){window.previewCalls??=[];window.previewCalls.push({page:this.pageNumber,width:options.viewport.width});window.renderActive=(window.renderActive||0)+1;window.renderPeak=Math.max(window.renderPeak||0,window.renderActive);const task=originalRender.call(this,options);task.promise.then(()=>window.renderActive--,()=>window.renderActive--);return task;};`}));
 await gallery.goto('http://127.0.0.1:'+server.address().port+base+'pdf-preview/index.html');
 await gallery.locator('#pdf-file').setInputFiles({name:'78-page-selection-test.pdf',mimeType:'application/pdf',buffer:selectionPdf(78)});
 const ready=async count=>gallery.waitForFunction(n=>{const imgs=[...document.querySelectorAll('#thumbnails img')];return imgs.length===n&&imgs.every(i=>i.complete&&i.naturalWidth>0);},count);
 await ready(4);assert.equal(await gallery.locator('#thumbnails input').count(),4);assert.equal(await gallery.locator('#thumb-range').innerText(),'Pages 1–4 / 78');
 assert.deepEqual(await gallery.evaluate(()=>window.previewCalls.map(x=>x.page)),[1,2,3,4]);
 assert.equal(await gallery.locator('#thumbnails').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);
 assert.equal(await gallery.locator('#thumbnails').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
 await gallery.getByRole('checkbox',{name:'Page 1',exact:true}).check();
 await gallery.locator('#thumb-next').click();await ready(4);assert.equal(await gallery.locator('#thumb-range').innerText(),'Pages 5–8 / 78');
 await gallery.getByRole('checkbox',{name:'Page 5',exact:true}).check();await gallery.locator('#thumb-previous').click();await ready(4);
 assert.equal(await gallery.getByRole('checkbox',{name:'Page 1',exact:true}).isChecked(),true);assert.match(await gallery.locator('#selected-count').innerText(),/2 pages/);
 assert.deepEqual(await gallery.evaluate(()=>window.previewCalls.map(x=>x.page)),[1,2,3,4,5,6,7,8]);
 await gallery.locator('#show').click();await gallery.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 1 displayed'));
 await gallery.locator('#next').click();await gallery.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 5 displayed'));
 await gallery.setViewportSize({width:844,height:390});assert.equal(await gallery.locator('#thumbnails input').count(),4);
 await gallery.setViewportSize({width:390,height:844});
 // Skip quickly to the last partial group; only the current group's queue survives.
 for(let i=0;i<19;i++)await gallery.locator('#thumb-next').click();
 await ready(2);assert.equal(await gallery.locator('#thumb-range').innerText(),'Pages 77–78 / 78');assert.equal(await gallery.locator('#thumbnails input').count(),2);assert.equal(await gallery.locator('#thumb-next').isEnabled(),false);
 assert.equal(await gallery.evaluate(()=>window.renderPeak),1);
 for(let i=0;i<19;i++)await gallery.locator('#thumb-previous').click();await ready(4);
 assert.equal(await gallery.getByRole('checkbox',{name:'Page 1',exact:true}).isChecked(),true);
 const before=await gallery.evaluate(()=>window.previewCalls.filter(c=>c.width<=140.01&&c.page<=4).length);assert.equal(before,4);
 if(process.env.PDF_PREVIEW_SCREENSHOT){await mkdir('test-results/pdf-preview',{recursive:true});await gallery.screenshot({path:'test-results/pdf-preview/mobile-four-pages.png',fullPage:true});}
 await gallery.locator('#clear').click();assert.equal(await gallery.locator('#thumbnails img').count(),0);
 // Desktop retains the scrolling gallery and still benefits from cached previews.
 await gallery.setViewportSize({width:1280,height:900});await gallery.emulateMedia({media:'screen'});
 const desktop=await context.newPage();await desktop.setViewportSize({width:1280,height:900});
 await desktop.goto('http://127.0.0.1:'+server.address().port+base+'pdf-preview/index.html');await desktop.locator('#pdf-file').setInputFiles({name:'desktop.pdf',mimeType:'application/pdf',buffer:selectionPdf(10)});
 await desktop.waitForFunction(()=>document.querySelectorAll('#thumbnails input').length===10);assert.equal(await desktop.locator('#thumb-pagination').isVisible(),false);
 await mobile.close();await desktop.close();
 console.log(JSON.stringify({browser:type.name(),mobileFourPages:true,landscapeFourPages:true,sequentialRendering:true,cachedFirstGroup:true,selectionRetained:true,lastGroupTwoPages:true,desktopScrolling:true}));
 if(process.env.PRIVATE_PDF){
  const privatePage=await context.newPage();privatePage.setDefaultTimeout(180000);
  await privatePage.goto('http://127.0.0.1:'+server.address().port+base+'pdf-preview/index.html');
  await privatePage.locator('#pdf-file').setInputFiles(process.env.PRIVATE_PDF);
  await privatePage.waitForFunction(()=>document.getElementById('status').textContent.startsWith('PDF opened.'),{},{timeout:180000});
  await privatePage.waitForFunction(()=>document.getElementById('filename').textContent.includes('78 pages'));
  const pages=78;assert.equal(await privatePage.locator('#thumbnails input').count(),4);
  await privatePage.getByRole('checkbox',{name:'Page 1',exact:true}).check();await privatePage.locator('#show').click();
  await privatePage.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 1 displayed'),{},{timeout:180000});
  const size=await privatePage.locator('#page-host canvas').evaluate(c=>[c.width,c.height]);
  for(let i=0;i<19;i++)await privatePage.locator('#thumb-next').click();
  await privatePage.getByRole('checkbox',{name:'Page 78',exact:true}).check();await privatePage.locator('#next').click();
  await privatePage.waitForFunction(()=>document.getElementById('page-status').textContent.startsWith('Page 78 displayed'),{},{timeout:180000});
  console.log(JSON.stringify({browser:type.name(),privatePdfOpened:true,pages,firstAndLastPagesDisplayed:true,size}));
  await privatePage.locator('#clear').click();await privatePage.close();
 }
}finally{await browser.close();server.close();}

function selectionPdf(count){
 const objects=[],add=s=>{objects.push(Buffer.from(s));return objects.length;};
 add('<< /Type /Catalog /Pages 2 0 R >>');add('<< /Type /Pages /Count '+count+' /Kids ['+Array.from({length:count},(_,i)=>(3+i*2)+' 0 R').join(' ')+'] >>');
 for(let i=0;i<count;i++){add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 432 576] /Resources << /Font << /F1 '+(3+count*2)+' 0 R >> >> /Contents '+(4+i*2)+' 0 R >>');const text='BT /F1 28 Tf 40 500 Td (Page '+(i+1)+') Tj ET';add('<< /Length '+Buffer.byteLength(text)+' >>\nstream\n'+text+'\nendstream');}
 add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];let offset=parts[0].length;
 objects.forEach((obj,i)=>{offsets.push(offset);const b=Buffer.concat([Buffer.from((i+1)+' 0 obj\n'),obj,Buffer.from('\nendobj\n')]);parts.push(b);offset+=b.length;});
 parts.push(Buffer.from('xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+offset+'\n%%EOF\n'));return Buffer.concat(parts);
}
