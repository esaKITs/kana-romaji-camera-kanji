const fs=require('node:fs'),path=require('node:path');
const {createCanvas,GlobalFonts}=require('../../../meikiocr-test/node_modules/@napi-rs/canvas');
const root='generated/fixtures/';fs.mkdirSync(root,{recursive:true});GlobalFonts.registerFromPath(root+'NotoSansJP.ttf','Noto JP');
function image(name,draw){const c=createCanvas(1100,360),x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='54px "Noto JP"';draw(x);fs.writeFileSync(root+name+'.png',c.toBuffer('image/png'));}
image('plain',x=>{x.fillText('学校で本を読みます。',60,150);x.fillText('コーヒーを飲みます。',60,260)});
image('ruby-school',x=>{x.fillText('学校で本を読みます。',60,150);x.font='24px "Noto JP"';x.fillText('がっこう',60,90)});
image('ruby-food',x=>{x.fillText('生物を食べます。',60,150);x.font='24px "Noto JP"';x.fillText('なまもの',60,90)});
image('okurigana',x=>x.fillText('食べる。読みました。',60,150));
