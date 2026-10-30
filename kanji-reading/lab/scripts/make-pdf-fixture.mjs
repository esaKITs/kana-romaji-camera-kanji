import {readFile,writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';const {PDFDocument,StandardFonts,degrees}=createRequire(import.meta.url)('../../../meikiocr-test/node_modules/pdf-lib');
const pdf=await PDFDocument.create();pdf.setTitle('Kana Romaji Camera - sample PDF');pdf.setCreationDate(new Date('2026-10-31T00:00:00Z'));pdf.setModificationDate(new Date('2026-10-31T00:00:00Z'));
const numeric=await pdf.embedPng(await readFile('generated/fixtures/numeric.png')),pronunciation=await pdf.embedPng(await readFile('generated/fixtures/pronunciation.png'));
pdf.addPage([360,180]).drawImage(numeric,{x:0,y:15,width:360,height:148.8});
const middle=pdf.addPage([240,360]);middle.setRotation(degrees(90));middle.drawText('Page 2 - select or skip this page.',{x:15,y:180,size:12,font:await pdf.embedFont(StandardFonts.Helvetica)});
pdf.addPage([320,400]).drawImage(pronunciation,{x:10,y:100,width:300,height:300*1100/1400});
await writeFile('generated/fixtures/document-sample.pdf',await pdf.save());
