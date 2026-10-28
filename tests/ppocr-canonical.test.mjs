import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mergeRecognizedRegions,classifyLocal,dedupeBoxes,boxesFromMap} from '../kanji-reading/still-prototype/ppocr-core.mjs';
const baseline=readFileSync('tests/fixtures/ppocr-experiment-21a0546.html','utf8'),core=readFileSync('kanji-reading/still-prototype/ppocr-core.mjs','utf8');
function extract(s,name){const start=s.search(new RegExp('(?:async )?function '+name+'\\('));let i=s.indexOf('{',start),depth=1,end=i+1;while(depth){if(s[end]==='{')depth++;if(s[end]==='}')depth--;end++;}return s.slice(start,end);}
test('canonical baseline blob and all nine function bodies remain byte-identical',()=>{
 const bytes=Buffer.from(baseline);assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),'21a0546f93031e81b20b74fd2eee8c39af868e7d');
 for(const n of ['tensor','resized','runModel','boxesFromMap','intersectionOverUnion','dedupeBoxes','mergeRecognizedRegions','classifyRegions','classifyLocal'])assert.equal(extract(core,n),extract(baseline,n),n);
});
test('tile-coordinate duplicates merge and ruby candidates retain parent text',()=>{
 assert.deepEqual(dedupeBoxes([[810,20,900,60],[812,21,899,60]]),[[810,20,900,60]]);
 const regions=[{text:'京都へ',box:[810,45,910,80]},{text:'京都',box:[812,45,900,80]},{text:'きょうと',box:[812,26,897,40]}];
 const merged=mergeRecognizedRegions(regions);assert.equal(merged.length,2);assert.equal(classifyLocal(merged).find(r=>r.text==='きょうと').type,'ルビ候補');
});
test('probability map scales coordinates to source pixels',()=>{
 const data=new Float32Array(32*32);for(let y=10;y<14;y++)for(let x=12;x<20;x++)data[y*32+x]=.9;
 assert.deepEqual(boxesFromMap({dims:[1,1,32,32],data},960,480),[[300,120,660,240]]);
});
