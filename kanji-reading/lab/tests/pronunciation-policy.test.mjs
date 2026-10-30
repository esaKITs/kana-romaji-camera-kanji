import test from 'node:test';import assert from 'node:assert/strict';
import {loadEngine} from '../src/engines.mjs';import {kuromojiTokens} from '../src/adapters.mjs';
import {candidateRomanization,readingRomanization,pronunciationDomains} from '../src/format.mjs';
import {displayTokens} from '../../still-prototype/display-tokens.mjs';
import {groupPPOCRTokens} from '../../still-prototype/ppocr-reading.mjs';
import {analyzeSnapshot} from '../../still-prototype/pipeline.mjs';
import {applyNumericReadings} from '../src/numeric-reading.mjs';
const cases=[
 ['先生','sensee','sensē'],['映画','eega','ēga'],['経済','keezai','kēzai'],['衛生','eesee','ēsē'],
 ['時計','tokee','tokē'],['お姉さん','oneesan','onēsan'],['ええ','ee','ē'],['ねえ','nee','nē'],
 ['東京','tookyoo','tōkyō'],['京都','kyooto','kyōto'],['労働','roodoo','rōdō'],['応答','ootoo','ōtō'],
 ['扇','oogi','ōgi'],['狼','ookami','ōkami'],['行こう','ikoo','ikō'],['飲もう','nomoo','nomō'],['だろう','daroo','darō'],
 ['毛糸','keito','keito'],['手入れ','teire','teire'],['目医者','meisha','meisha'],['姪','mei','mei'],
 ['追う','ou','ou'],['問う','tou','tou'],['雇う','yatou','yatou'],['背負う','seou','seou'],
 ['子牛','koushi','koushi'],['小歌','kouta','kouta'],['小梅','koume','koume'],
 ['見えている','mieteiru','mieteiru'],['見ています','miteimasu','miteimasu'],
 ['新聞','shimbun','shimbun'],['散歩','sampo','sampo'],['新米','shimmai','shimmai'],
 ['新案','shin’an','shin’an'],['山陰','san’in','san’in'],['本屋','hon’ya','hon’ya'],
 ['切符','kippu','kippu'],['抹茶','matcha','matcha'],['コーヒー','koohii','kōhī'],
];
test('dictionary morphology resolves long vowels, hiatus, nasals and geminates before style conversion',async()=>{
 const e=await loadEngine('kuromoji',{node:true});try{for(const [text,double,macron]of cases){
  const raw=e.analyze(text),before=structuredClone(raw),ts=groupPPOCRTokens(displayTokens(text,raw,'あア漢'));
  for(const [style,expected]of [['double',double],['macron',macron]])assert.equal(ts.map(t=>candidateRomanization(t,style)).join(''),expected,text+' '+style);
  assert.deepEqual(raw,before,'raw readings and offsets must survive');
 }}finally{e.dispose();}
});
test('both PP region and measured-glyph display paths use the same pronunciation policy',async()=>{
 const e=await loadEngine('kuromoji',{node:true});try{for(const [text,double,macron]of cases.filter(([s])=>!['東京','京都','山陰'].includes(s))){
  const raw=e.analyze(text);if(raw.some(t=>t.pos.includes('固有名詞')))continue;
  // A whole word is represented by one measured region in these bridge tests;
  // no character coordinates are synthesized by production code.
  const box=[10,30,650,80],base={width:700,height:150,lines:[{id:0,text,box,orientation:'horizontal',regionType:'本文候補',glyphs:[{text,box}]}]};
  for(const [style,expected]of [['double',double],['macron',macron]]){
   const pp=await analyzeSnapshot({...base,engine:'ppocrv6-manga'},async()=>raw,{mode:'あア漢',style});
   const meiki=await analyzeSnapshot(base,async()=>raw,{mode:'あア漢',style});
   assert.equal(pp.labels.map(l=>l.output).join(''),expected,'PP '+text+' '+style);
   // Glyph-level path cannot place subword labels from a single whole-word
   // region. Complete single-group words must match; groups are tested above.
   if(displayTokens(text,raw,'あア漢').length===1)assert.equal(meiki.labels.map(l=>l.output).join(''),expected,'Meiki '+text+' '+style);
  }
 }}finally{e.dispose();}
});
test('the reading adapter retains pronunciation and inflection without changing reading or offsets',()=>{
 const [t]=kuromojiTokens('問う',[{surface_form:'問う',reading:'トウ',pronunciation:'トウ',pos:'動詞',pos_detail_1:'自立',conjugated_type:'五段・ワ行促音便',conjugated_form:'基本形',basic_form:'問う',word_type:'KNOWN'}]);
 assert.equal(t.reading,'トウ');assert.equal(t.pronunciation,'トウ');assert.equal(t.conjugationType,'五段・ワ行促音便');assert.deepEqual([t.start,t.end],[0,2]);
});
test('nasal and sokuon context survives member boundaries, while spaces and punctuation stop assimilation',()=>{
 for(const [members,expected]of [
  [[{surface:'新',reading:'シン'},{surface:'米',reading:'マイ'}],'shimmai'],
  [[{surface:'新',reading:'シン'},{surface:'案',reading:'アン'}],'shin’an'],
  [[{surface:'まっ',reading:'マッ'},{surface:'茶',reading:'チャ'}],'matcha'],
 ])for(const style of ['double','macron'])assert.equal(candidateRomanization({surface:members.map(t=>t.surface).join(''),reading:members.map(t=>t.reading).join(''),members},style),expected);
 for(const style of ['double','macron']){
  assert.equal(readingRomanization('さん ぽ',style),'san po');assert.equal(readingRomanization('ん、ば',style),'n、ba');
  assert.equal(readingRomanization('にほんばし',style),'nihombashi');
 }
});
test('particle boundaries survive both styles before e/o and after ga/wa',async()=>{
 const e=await loadEngine('kuromoji',{node:true});try{for(const [text,expected]of [['岩手へ','iwate e'],['井戸を','ido o'],['水がある','mizu ga aru'],['水はある','mizu wa aru']]){
  const ts=displayTokens(text,e.analyze(text),'あア漢');for(const style of ['double','macron'])assert.equal(ts.map(t=>candidateRomanization(t,style)).join(' '),expected);
 }}finally{e.dispose();}
});
test('unresolved readings do not receive generic ei/ou/ee rewriting; ruby uses the same conservative rule',()=>{
 for(const style of ['double','macron']){
  assert.equal(readingRomanization('ぬえいぽう',style),'nueipou');assert.equal(readingRomanization('ぬええ',style),'nuee');
  for(const [surface,reading,expected]of [['追う','おう','ou'],['目医者','めいしゃ','meisha'],['子牛','こうし','koushi']])assert.equal(readingRomanization(reading,style,{surface}),expected);
 }
});
test('numeric pronunciation remains authoritative and does not inherit stale lexical pronunciation',async()=>{
 const e=await loadEngine('kuromoji',{node:true});try{for(const text of ['二十歳','20歳','２０歳','三本','3本','３本','十三杯']){
  const ts=applyNumericReadings(text,e.analyze(text)).tokens;assert.equal(ts.length,1);
  const t={...ts[0],pronunciation:'チガウ'};for(const style of ['double','macron']){
   const expected=text.endsWith('歳')?'hatachi':text.endsWith('本')?'sambon':style==='double'?'juusambai':'jūsambai';assert.equal(candidateRomanization(t,style),expected,text+' '+style);
  }
 }}finally{e.dispose();}
});
test('verified ruby follows the same surface-aware hiatus decision without altering OCR',async()=>{
 const e=await loadEngine('kuromoji',{node:true});try{
  const box=[30,90,200,130],rubyBox=[30,60,200,80],lines=[{id:0,text:'目医者',box,regionType:'本文候補',orientation:'horizontal',glyphs:[{text:'目医者',box,confidence:.99}]},{id:1,text:'めいしゃ',box:rubyBox,regionType:'ルビ候補',parentText:'目医者',orientation:'horizontal',glyphs:[{text:'めいしゃ',box:rubyBox,confidence:.99}]}],snapshot={width:300,height:160,lines},before=structuredClone(snapshot);
  for(const engine of ['ppocrv6-manga','meiki'])for(const style of ['double','macron']){
   const result=await analyzeSnapshot({...snapshot,engine},e.analyze,{mode:'あア漢',style,verifyRuby:async c=>({reading:c.reading,method:'test-independent-reread'})});
   assert.ok(result.pairs.some(p=>p.verified));assert.ok(result.labels.some(l=>l.output==='meisha'&&l.readingSource===(engine==='ppocrv6-manga'?'dictionary-region':'verified-ruby')),'verified ruby '+engine+' '+style);assert.deepEqual(snapshot,before);
  }
 }finally{e.dispose();}
});
