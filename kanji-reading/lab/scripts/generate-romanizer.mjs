import {readFile,writeFile,mkdir} from 'node:fs/promises';
// Extract the exact existing rules; no alternative romanizer or new spelling.
const source=await readFile('../../meikiocr-test/app.html','utf8');
const names=['map','pairs','textbookFixedExpressions','textbookReadings','katakanaLexicon'];
let out='// GENERATED from stable application; do not edit.\n';
for(const name of names){
 const start=source.indexOf('const '+name+'=');if(start<0)throw Error('Missing '+name);
 const end=source.indexOf(';',start);out+=source.slice(start,end+1)+'\n';
}
out+=source.match(/Object\.assign\(pairs,[^;]+;/)[0]+'\n';
out+='map["ぶ"]="bu";\nconst pronunciationLexicon='+await readFile('../../meikiocr-test/data/kana-pronunciations.json','utf8')+';\n';
const rules=await readFile('../../meikiocr-test/src/romanization-controller.js','utf8');
out+="let longVowelMode='double';\n"+rules.slice(rules.indexOf('const toHiragana='),rules.indexOf('function renderLongVowelToggle'));
out+='\nexport {romaji,rubyKanjiRomaji,romanizeUnits};\n';
await mkdir('generated',{recursive:true});await writeFile('generated/romanizer.mjs',out);
