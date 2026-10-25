const fs=require('node:fs'),{createCanvas,GlobalFonts}=require('../../../meikiocr-test/node_modules/@napi-rs/canvas');
const root='generated/fixtures/';GlobalFonts.registerFromPath(root+'NotoSansJP.ttf','Noto JP');
const c=createCanvas(1500,620),x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='54px "Noto JP"';
['三本のペンと3本のペン。','五月一日。一日中休みます。','二十日間休みます。','十分に注意。十分待ちます。','水が十三杯あります。'].forEach((s,i)=>x.fillText(s,70,105+i*110));fs.writeFileSync(root+'numeric.png',c.toBuffer('image/png'));
