import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evaluateCase,summarize} from '../src/evaluation.mjs';import {separatedSudachiTokens} from '../src/adapters.mjs';
import {analyzeSnapshot,rubyCandidates,sourceLines} from '../../still-prototype/pipeline.mjs';
const set=JSON.parse(readFileSync(new URL('../evaluation-100.json',import.meta.url),'utf8'));
test('100 reviewed ordinary probes exclude identity and dictionary-coverage probes',()=>{assert.equal(set.cases.length,100);assert.equal(new Set(set.cases.map(c=>c.id)).size,100);assert.ok(set.cases.every(c=>c.target!=='江崎'&&c.target!=='龘'&&c.acceptedReadings.length));assert.equal(set.cases.filter(c=>c.category==='counter').length,24)});
const token=(surface,reading,start=0,pos=['名詞'])=>({surface,reading,start,end:start+surface.length,pos,unknown:false});
test('multiple valid readings and metric denominators are distinct',()=>{
 const a=evaluateCase({id:'a',text:'明日',target:'明日',acceptedReadings:['アシタ','アス','ミョウニチ']},[token('明日','アス')]);assert.ok(a.correct);
 const b=evaluateCase({id:'b',text:'三本',target:'三本',acceptedReadings:['サンボン']},[token('三本','サンホン')]);assert.ok(!b.correct&&b.emitted&&!b.displayEmitted);
 const c=evaluateCase({id:'c',text:'未知',target:'未知',acceptedReadings:['ミチ']},[token('未知',null)]);const s=summarize([a,b,c]);assert.equal(s.raw.accuracy,1/3);assert.equal(s.raw.romanizationCoverage,2/3);assert.equal(s.raw.errorAmongEmitted,1/2);
});
test('modern Sudachi code-point offsets are checked against UTF-16 source',()=>{
 const t=separatedSudachiTokens('𠮷野',[{surface:'𠮷',readingForm:'ヨシ',partOfSpeech:['名詞'],isOov:false,begin:0,end:1},{surface:'野',readingForm:'ノ',partOfSpeech:['名詞'],isOov:false,begin:1,end:2}]);assert.equal(t[1].start,2);
 assert.throws(()=>separatedSudachiTokens('𠮷野',[{surface:'𠮷野',readingForm:'ヨシノ',begin:0,end:2+1}]));
});
function line(text,y,h,x=30,unit=30){return {text,orientation:'horizontal',box:[x,y,x+unit*text.length,y+h],glyphs:[...text].map((c,i)=>({text:c,box:[x+i*unit,y,x+(i+1)*unit,y+h],confidence:.95}))}}
const snapshot={lines:[line('なまもの',10,12,30,15),line('生物',30,40)]};
test('verified grouped ruby overrides different analyzer boundaries without duplicates',async()=>{
 const r=await analyzeSnapshot(snapshot,async t=>t==='生物'?[token('生','セイ'),token('物','ブツ',1)]:[token(t,t)],{verifyRuby:async()=> 'なまもの'});
 assert.equal(r.pairs.length,1);assert.equal(r.labels.length,1);assert.equal(r.labels[0].output,'namamono');assert.equal(r.labels[0].source,'生物');
});
test('uncertain candidate ruby stays unconverted and does not create duplicate labels',async()=>{
 const r=await analyzeSnapshot(snapshot,async t=>[token(t,t==='生物'?'セイブツ':t)],{verifyRuby:async()=>null});assert.equal(r.pairs.length,0);assert.equal(r.labels.length,0);assert.equal(r.withheld[0].reason,'ambiguous-reading');
});
test('Han-only and katakana/Han preserve okurigana; all-script mode can cover the word',async()=>{
 const s={lines:[line('食べる',50,40)]};for(const mode of ['漢','ア漢']){const r=await analyzeSnapshot(s,async()=>[token('食べる','タベル')],{mode});assert.deepEqual(r.labels.map(l=>[l.source,l.output]),[['食','ta']]);}
 const r=await analyzeSnapshot(s,async()=>[token('食べる','タベル')]);assert.equal(r.labels[0].output,'taberu');
});
test('partial ruby, competing bodies and invalid glyph boxes do not fabricate a match',()=>{
 assert.equal(rubyCandidates(sourceLines({lines:[line('な',10,12,30,15),line('生物',30,40)]})).length,0);
 assert.equal(rubyCandidates(sourceLines({lines:[...snapshot.lines,line('生物',30,40)]})).length,0);
 const invalid={lines:[line('生物',30,40)]};invalid.lines[0].glyphs[0].box[0]=NaN;assert.equal(sourceLines(invalid).length,0);
});
