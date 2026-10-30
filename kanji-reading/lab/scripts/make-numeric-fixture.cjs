const fs=require('node:fs'),{createCanvas,GlobalFonts}=require('../../../meikiocr-test/node_modules/@napi-rs/canvas');
const root='generated/fixtures/';GlobalFonts.registerFromPath(root+'NotoSansJP.ttf','Noto JP');
const c=createCanvas(1500,620),x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='54px "Noto JP"';
['三本のペンと3本のペン。','五月一日。一日中休みます。','二十日間休みます。','十分に注意。十分待ちます。','水が十三杯あります。'].forEach((s,i)=>x.fillText(s,70,105+i*110));fs.writeFileSync(root+'numeric.png',c.toBuffer('image/png'));
// Separate controlled OCR input for numeric pronunciation/display regressions.
const counters=createCanvas(2100,1000),cx=counters.getContext('2d');cx.fillStyle='white';cx.fillRect(0,0,counters.width,counters.height);cx.fillStyle='black';cx.font='50px "Noto JP"';
['20歳未満','二十歳未満','3本のペン','3時に会います','1人と2人','８歳と21歳','20日間','20歳未満の者の喫煙は、法律で禁じられています。'].forEach((s,i)=>cx.fillText(s,70,100+i*115));fs.writeFileSync(root+'numeric-counters.png',counters.toBuffer('image/png'));
// Additional fixture; the original five-line sample above stays byte-identical.
const cases=JSON.parse(fs.readFileSync('../../tests/fixtures/counter-readings.json','utf8'));
const variantCanvas=createCanvas(1900,cases.length*90+60),vx=variantCanvas.getContext('2d');vx.fillStyle='white';vx.fillRect(0,0,variantCanvas.width,variantCanvas.height);vx.fillStyle='black';vx.font='600 48px "Noto JP"';
cases.forEach(([n,kanji,unit],i)=>vx.fillText([kanji+unit,String(n)+unit,String(n).replace(/[0-9]/g,c=>String.fromCharCode(c.charCodeAt(0)+0xfee0))+unit].join('　　'),70,80+i*90));fs.writeFileSync(root+'counter-variants.png',variantCanvas.toBuffer('image/png'));
