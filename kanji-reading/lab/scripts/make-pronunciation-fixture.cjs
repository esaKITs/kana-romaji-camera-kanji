const fs=require('node:fs'),{createCanvas,GlobalFonts}=require('../../../meikiocr-test/node_modules/@napi-rs/canvas');
const root='generated/fixtures/';GlobalFonts.registerFromPath(root+'NotoSansJP.ttf','Noto JP');
const c=createCanvas(1400,1100),x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='54px "Noto JP"';
['先生と映画。','追う。問う。雇う。','毛糸と目医者。','子牛と小梅。','新聞と散歩。','新案と本屋。','いわてへ。井戸を。','水がある。水はある。','行こう。飲もう。','ねえ。ええ、そうです。'].forEach((s,i)=>x.fillText(s,70,90+i*100));
fs.writeFileSync(root+'pronunciation.png',c.toBuffer('image/png'));
