import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inkComponents,uncoveredSingleBoxes,overlapCoverage} from '../kanji-reading/still-prototype/ppocr-single.mjs';
test('supplemental proposals measure ink pixels, including narrow one-character strokes',()=>{
 const w=60,h=60,rgba=new Uint8ClampedArray(w*h*4).fill(255);
 for(let y=10;y<40;y++)for(let x=15;x<21;x++)for(let k=0;k<3;k++)rgba[(y*w+x)*4+k]=50;
 assert.deepEqual(inkComponents(rgba,w,h),[[15,10,21,40]]);
});
test('already recognized body and ruby regions are protected from replacement',()=>{
 const existing=[{text:'本文',box:[0,0,100,30]},{text:'ほんぶん',box:[0,40,100,60]}];
 const boxes=[[10,2,26,28],[10,41,25,59],[120,0,140,30],[150,0,151,30],[180,0,280,30]];
 assert.deepEqual(uncoveredSingleBoxes(boxes,existing),[[120,0,140,30]]);
 assert.equal(overlapCoverage([5,5,10,10],[0,0,20,20]),1);
});
