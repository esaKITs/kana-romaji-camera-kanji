import {test} from 'node:test';import assert from 'node:assert/strict';
import {withOffsets,sudachiTokens,checkSudachiSchema,cachedAnalyzer} from '../src/adapters.mjs';
import {isTarget,modes,splitOkurigana,reviewReason} from '../src/policy.mjs';
import {romaji,rubyKanjiRomaji} from '../generated/romanizer.mjs';
test('only the three fixed modes, including Han extension characters',()=>{
 assert.deepEqual(modes,['あア漢','ア漢','漢']);
 for(const mode of modes){assert.ok(isTarget('𠮷',mode));assert.equal(isTarget('あ',mode),mode==='あア漢');assert.equal(isTarget('ア',mode),mode!=='漢');assert.equal(isTarget('A',mode),false);assert.equal(isTarget('1',mode),false);}
 assert.throws(()=>isTarget('あ','あア'));
});
test('source offsets survive spaces and astral Han; mismatches never get fake boxes',()=>{
 const t=withOffsets('𠮷野 家',[{surface:'𠮷野'},{surface:'家'}]);assert.deepEqual(t.map(x=>[x.start,x.end]),[[0,3],[4,5]]);
 assert.throws(()=>withOffsets('学校です',[{surface:'学'},{surface:'です'}]));assert.throws(()=>withOffsets('学校',[]));assert.throws(()=>withOffsets('学校へ',[{surface:'学校'}]));
});
test('okurigana stays kana in Han-only alignment; opaque mixed words defer',()=>{
 assert.deepEqual(splitOkurigana('食べる','タベル').map(x=>[x.surface,x.reading]),[['食','た'],['べる','べる']]);
 assert.deepEqual(splitOkurigana('読み','ヨミ').map(x=>[x.surface,x.reading]),[['読','よ'],['み','み']]);
 assert.equal(splitOkurigana('申し込む','モウシコム'),null);assert.equal(splitOkurigana('食べる','クウ'),null);
});
test('unknown, named and ambiguous kanji remain review candidates',()=>{
 assert.equal(reviewReason({surface:'龘',unknown:true}),'unknown-reading');assert.equal(reviewReason({surface:'江崎',reading:'エザキ',pos:['固有名詞']}),'proper-name');assert.equal(reviewReason({surface:'人気',reading:'ニンキ'}),'ambiguous-reading');
});
test('cache is bounded, copies results, rejects excessive lines and clears',()=>{
 let calls=0;const c=cachedAnalyzer(text=>{calls++;return [{text}]},{limit:2,maxCharacters:5});let a=c.analyze('a');a[0].text='wrong';assert.equal(c.analyze('a')[0].text,'a');assert.equal(calls,1);c.analyze('b');c.analyze('c');assert.equal(c.size,2);c.analyze('a');assert.equal(calls,4);assert.throws(()=>c.analyze('123456'));c.clear();assert.equal(c.size,0);
});
test('Sudachi package schema refuses unrecognized ABI',()=>{
 assert.throws(()=>checkSudachiSchema({TokenizeMode:{C:2},tokenize:()=>JSON.stringify([{dictionary_form:'読む',reading_form:'ヨミ'}])}));
 assert.equal(sudachiTokens('読み',[{surface:'読み',dictionary_form:'ヨミ',poses:['動詞']}])[0].reading,'ヨミ');
});
for(const [k,d,m] of [['がっこう','gakkoo','gakkō'],['としょかん','toshokan','toshokan'],['しんぶん','shimbun','shimbun'],['れんあい','ren’ai','ren’ai'],['せんせい','sensee','sensē']])test('existing kanji ruby romanization: '+k,()=>{assert.equal(rubyKanjiRomaji(k,'double'),d);assert.equal(rubyKanjiRomaji(k,'macron'),m)});
test('existing kana exceptions preserved',()=>{assert.equal(romaji('おもう'),'omou');assert.equal(romaji('テイクアウト'),'teikuauto');assert.equal(romaji('パーティー','macron'),'pātī')});

const {candidateRomanization}=await import('../src/format.mjs');
test('particle pronunciation selection remains separate from spelling',()=>{assert.equal(candidateRomanization({surface:'は',reading:'ハ',pos:['助詞']},'double'),'wa');assert.equal(candidateRomanization({surface:'へ',reading:'ヘ',pos:['助詞']},'double'),'e');assert.equal(candidateRomanization({surface:'は',reading:'ハ',pos:['名詞']},'double'),'ha')});

import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('all existing golden kana spellings agree in both vowel styles',()=>{
 const source=readFileSync(new URL('../../../meikiocr-test/tests/controller/romanization.test.cjs',import.meta.url),'utf8');
 const literal=source.match(/const cases=(\[[\s\S]*?\n\]);/)[1];
 const cases=vm.runInNewContext('('+literal+')');
 for(const[input,double,macron]of cases){assert.equal(romaji(input,'double'),double,input);assert.equal(romaji(input,'macron'),macron,input);}
});
