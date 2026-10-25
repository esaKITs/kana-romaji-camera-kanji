import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRegions} from '../kanji-reading/still-prototype/regions.mjs';

function fragment(text,x,y=10,unit=20,height=24){
 return {text,orientation:'horizontal',glyphs:[...text].map((c,i)=>({text:c,confidence:.98,box:[x+i*unit,y,x+(i+1)*unit,y+height]}))};
}
test('adjacent kana OCR fragments join into one word without changing characters',()=>{
 const result=normalizeRegions({lines:[fragment('こう',10),fragment('べ',54),fragment('へ',78)]});
 assert.deepEqual(result.lines.map(l=>l.text),['こうべへ']);
 assert.equal(result.regionDiagnostics.joinedFragments,2);
});
test('separate multi-character choices are not joined',()=>{
 const result=normalizeRegions({lines:[fragment('あの',10),fragment('みせ',54)]});
 assert.deepEqual(result.lines.map(l=>l.text),['あの','みせ']);
});
test('far apart single kana are not joined',()=>{
 const result=normalizeRegions({lines:[fragment('し',10),fragment('み',100)]});
 assert.deepEqual(result.lines.map(l=>l.text),['し','み']);
});
test('a kanji ruby must not be joined to its parent',()=>{
 const result=normalizeRegions({lines:[fragment('きょう',10,5,10,10),fragment('京都',10,25,20,24)]});
 assert.deepEqual(result.lines.map(l=>l.text),['きょう','京都']);
});
