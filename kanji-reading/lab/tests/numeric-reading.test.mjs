import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseNumber,numberKana,numericSpans,applyNumericReadings} from '../src/numeric-reading.mjs';
import {analyzeSnapshot} from '../../still-prototype/pipeline.mjs';
const token=(surface,reading,start=0,pos=['名詞'])=>({surface,reading,start,end:start+surface.length,pos,unknown:false});
test('kanji/ASCII/fullwidth parsing rejects malformed and ambiguous digit strings',()=>{
 for(const[s,n]of [['二千三百四十五',2345],['２０',20],['110',110],['百八',108]])assert.equal(parseNumber(s),n);
 for(const s of ['百百','十千','一二','03','1.2','2十'])assert.equal(parseNumber(s),null,s);
 assert.equal(numberKana(3608),'サンゼンロッピャクハチ');
});
for(const [s,k]of [['三本','サンボン'],['二十六本','ニジュウロッポン'],['百八杯','ヒャクハッパイ'],['三千匹','サンゼンビキ'],['二十四人','ニジュウヨニン'],['十八冊','ジュウハッサツ'],['十三階','ジュウサンガイ'],['三分待つ','サンプン']])test('productive pronunciation '+s,()=>assert.equal(numericSpans(s)[0].reading,k));
test('calendar first day and one-day durations differ; twenty days does not switch to nijuu-nichi',()=>{
 for(const[s,k]of [['5月1日です','ツイタチ'],['1日間休む','イチニチカン'],['一日中働く','イチニチ'],['1日で完成','イチニチ'],['二十日間休む','ハツカカン'],['5月20日です','ハツカ']])assert.equal(numericSpans(s).at(-1).reading,k,s);
 assert.equal(numericSpans('一日')[0].reading,null);
});
test('calendar limits, leap years and ambiguous lexical/minute uses are guarded',()=>{
 for(const s of ['13月','4月31日','2025年2月29日','十分です','3分の1','-3本','3.5本','01本','10000本'])assert.equal(numericSpans(s).at(-1).reading,null,s);
 assert.equal(numericSpans('2024年2月29日').at(-1).reading,'ニジュウクニチ');assert.equal(numericSpans('十分待つ')[0].reading,'ジュップン');
});
test('merges actual token spans, preserves offsets and leaves input untouched',()=>{
 const t=[token('三','サン',0),token('本','ホン',1)];const original=structuredClone(t),r=applyNumericReadings('三本',t);
 assert.deepEqual(t,original);assert.deepEqual([r.tokens[0].start,r.tokens[0].end,r.tokens[0].reading],[0,2,'サンボン']);
});
test('proper names and overlapping lexical words never get split to fit a numeric rule',()=>{
 for(const[s,pos]of [['三本松',['固有名詞']],['一本気',['名詞']],['二本松',['固有名詞']]]){const t=[token(s,'X',0,pos)],r=applyNumericReadings(s,t);assert.deepEqual(r.tokens,t);assert.ok(!r.tokens.some(t=>t.numericValidated));}
 const t=[token('十分','ジュウブン')];assert.deepEqual(applyNumericReadings('十分に',t).tokens,t);
});
const line=text=>({text,orientation:'horizontal',box:[10,30,10+40*text.length,70],glyphs:[...text].map((c,i)=>({text:c,box:[10+i*40,30,50+i*40,70],confidence:.98}))});
test('Still replaces a validated Arabic number and counter as one measured span in every mode',async()=>{
 const input={lines:[line('3本')]};for(const mode of ['あア漢','ア漢','漢']){
  const r=await analyzeSnapshot(input,async text=>applyNumericReadings(text,[token('3','サン'),token('本','ホン',1)]).tokens,{mode});
  assert.deepEqual(r.labels.map(l=>[l.source,l.output,l.box.x0]),[['3本','sambon',10]]);
 }
 const r=await analyzeSnapshot({lines:[line('20日')]},async text=>applyNumericReadings(text,[token('20日','ニジュウニチ')]).tokens);
 assert.equal(r.labels.length,1);assert.equal(r.labels[0].source,'20日');assert.equal(r.labels[0].output,'hatsuka');assert.deepEqual(r.labels[0].box,{x0:10,y0:30,x1:130,y1:70});
});
test('verified ruby retains priority over the numeric rule',async()=>{
 const main=line('三本'),ruby={...line('さんぼん'),box:[10,10,80,22],glyphs:[...'さんぼん'].map((c,i)=>({text:c,box:[10+i*18,10,28+i*18,22],confidence:.98}))};
 const r=await analyzeSnapshot({lines:[ruby,main]},async text=>text==='三本'?applyNumericReadings(text,[token('三本','サンホン')]).tokens:[token(text,text)],{verifyRuby:async()=> 'さんぼん'});
 assert.equal(r.labels.length,1);assert.equal(r.labels[0].readingSource,'verified-ruby');assert.equal(r.labels[0].output,'sambon');
});

test('whole-day duration supplies the juu suffix without rewriting a following word',()=>{
 const r=applyNumericReadings('一日中',[token('一日','イチニチ'),token('中','チュウ',2)]);assert.deepEqual(r.tokens.map(t=>t.reading),['イチニチ','ジュウ']);
 const t=[token('一日','イチニチ'),token('中国','チュウゴク',2)];const v=applyNumericReadings('一日中国へ',t).tokens;assert.deepEqual(v[1],t[1]);assert.equal(v[0].reading,null);
});
