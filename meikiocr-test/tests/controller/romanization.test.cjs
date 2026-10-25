const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,reading,data,deferred}=require('./harness.cjs');
const json=x=>JSON.parse(JSON.stringify(x));
const cases=[
 ['おばあさん','obaasan','obāsan'],['おじいさん','ojiisan','ojīsan'],
 ['すうじ','suuji','sūji'],['せんせい','sensee','sensē'],['こうこう','kookoo','kōkō'],
 ['コーヒー','koohii','kōhī'],['パーティー','paatii','pātī'],
 ['おもう','omou','omou'],['おもいます','omoimasu','omoimasu'],
 ['テイクアウト','teikuauto','teikuauto'],['おうかがいします','oukagaishimasu','oukagaishimasu'],
 ['たいいく','taiiku','taiiku'],['しんぶん','shimbun','shimbun'],['さんぽ','sampo','sampo'],
 ['ぐんま','gumma','gumma'],['れんあい','ren’ai','ren’ai'],['ほんや','hon’ya','hon’ya'],
 ['でんわ','denwa','denwa'],['ほん','hon','hon'],['んば','mba','mba'],
 ['んあ','n’a','n’a'],['んや','n’ya','n’ya'],['んわ','nwa','nwa'],
 ['ティ ディ ファ','ti di fa','ti di fa'],['ねこ いぬ','neko inu','neko inu'],
 ['せんせいです','senseedesu','sensēdesu'],['がくせい','gakusee','gakusē'],
 ['せんせいとがくせい','senseetogakusee','sensētogakusē'],
 ['おもうとせんせい','omoutosensee','omoutosensē'],
 ['せんせいにあいます','senseeniaimasu','sensēniaimasu'],
 ['こおり','koori','kōri'],['ぎんこう','ginkoo','ginkō'],
 ['さん ぽ','san po','san po'],['ん、ば','n、ba','n、ba'],
 ['とぅ','tu','tu'],['ぶ','bu','bu'],['きゃ','kya','kya'],['まっちゃ','matcha','matcha']
];
for(const [input,double,macron] of cases)test('romanization and long-vowel toggle: '+input,()=>{
 const h=load();h.put('input',input);
 assert.equal(h.run('romaji(input)'),double);
 h.run('setLongVowelMode("macron")');assert.equal(h.run('romaji(input)'),macron);
 h.run('setLongVowelMode("double")');assert.equal(h.run('romaji(input)'),double);
});
test('reviewed expressions retain pronunciation and nasal assimilation in both modes',()=>{
 const h=load();assert.equal(h.run('contextualRomaji("ぜんぶで")'),'zembude');
 assert.equal(h.run('contextualRomaji("ありがとうございます")'),'arigatoogozaimasu');
 h.run('setLongVowelMode("macron")');assert.equal(h.run('contextualRomaji("ありがとうございます")'),'arigatōgozaimasu');
 assert.equal(h.run('contextualRomaji("は")'),'wa');
});
test('unknown and ambiguous readings are not globally rewritten',()=>{
 const h=load();for(const mode of ['double','macron']){
  h.put('mode',mode);h.run('setLongVowelMode(mode)');
  for(const [input,out] of [['ぬえいぽう','nueipou'],['えい','ei'],['ぬももう','numomou'],['お う','o u'],['aaiiou','aaiiou']]){
   h.put('text',input);assert.equal(h.run('romaji(text)'),out);
  }
 }
});
test('saved preference is restored; invalid values and blocked storage are safe',()=>{
 const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const h=load(undefined,{window:{localStorage:storage}});assert.equal(h.run('longVowelMode'),'double');
 h.emit('long-vowels','click');assert.equal(saved.get('esakits.kana-romaji.long-vowels.v1'),'macron');
 const restored=load(undefined,{window:{localStorage:storage}});assert.equal(restored.run('romaji("パーティー")'),'pātī');
 saved.set('esakits.kana-romaji.long-vowels.v1','invalid');assert.equal(load(undefined,{window:{localStorage:storage}}).run('longVowelMode'),'double');
 const blocked={};Object.defineProperty(blocked,'localStorage',{get(){throw Error('blocked')}});
 const fallback=load(undefined,{window:blocked});fallback.emit('long-vowels','click');assert.equal(fallback.run('longVowelMode'),'macron');
});
test('Live and Still repaint immediately without changing recognition, coordinates, palette or generation',()=>{
 const h=load();h.put('items',[reading('パーティー',90,undefined,{state:'confirmed',votes:3})]);
 h.run('active=true;work.width=640;work.height=360;wc.fillStyle="white";wc.fillRect(0,0,640,360);tracks=items;paint(tracks)');
 const before=json(h.run('({items:tracks,palette:documentLabelPalette,runId,objectEpoch})'));
 h.drawn.length=0;h.emit('long-vowels','click');assert.ok(h.drawn.includes('pātī'));
 assert.deepEqual(json(h.run('({items:tracks,palette:documentLabelPalette,runId,objectEpoch})')),before);
 h.run('stillMode=true;stillSource=work;stillItems=tracks.map(cloneRecognitionItem)');
 h.drawn.length=0;h.emit('long-vowels','click');assert.ok(h.drawn.includes('paatii'));
 assert.equal(h.run('stillItems[0].text'),'パーティー');
 h.run('stillMode=false');h.drawn.length=0;h.run('paint(tracks)');assert.ok(h.drawn.includes('paatii'));
});
test('curly nasal separator actually reaches the canvas',()=>{
 const h=load();h.put('items',[reading('れんあい')]);h.run('wc.fillStyle="white";wc.fillRect(0,0,640,360);paint(items)');assert.ok(h.drawn.includes('ren’ai'));
});
test('explicit OCR fragments share pronunciation context without changing their boxes or text',()=>{
 const h=load();const items=[reading('せん',90,{x0:100,y0:100,x1:160,y1:130},{joinGroup:'r1'}),reading('せい',90,{x0:160,y0:100,x1:220,y1:130},{joinGroup:'r1'})];
 h.put('items',items);const before=structuredClone(items);
 assert.equal(h.run('Array.from(labelRomaji(items).values()).join("")'),'sensee');
 h.run('setLongVowelMode("macron")');assert.equal(h.run('Array.from(labelRomaji(items).values()).join("")'),'sensē');
 assert.deepEqual(items,before);
});
test('OCR join context does not bridge real spaces, different regions or different lines',()=>{
 const h=load();for(const extra of [{joinGroup:'r2'},{joinGroup:'r1',box:{x0:185,y0:100,x1:215,y1:130}},{joinGroup:'r1',box:{x0:160,y0:150,x1:190,y1:180}}]){
  h.put('items',[reading('ん',90,{x0:130,y0:100,x1:160,y1:130},{joinGroup:'r1'}),reading('ば',90,{x0:160,y0:100,x1:190,y1:130},extra)]);
  assert.equal(h.run('Array.from(labelRomaji(items).values()).join("")'),'nba');
 }
});
test('late OCR completion uses the new preference without restarting OCR',async()=>{
 const h=load(),d=deferred();let calls=0;
 h.put('mockWorker',{meiki:true,setParameters:async()=>{},recognize:()=>{calls++;return d.promise}});
 h.run('active=true;work.width=640;work.height=360;wc.fillStyle="white";wc.fillRect(0,0,640,360);video.getContext("2d").drawImage(work,0,0);worker=mockWorker;kleeUnavailable=true;referenceItems=[]');
 const p=h.run('scan()');await Promise.resolve();h.emit('long-vowels','click');
 d.resolve({data:data([reading('パーティー')])});await p;
 assert.equal(calls,1);assert.equal(h.run('longVowelMode'),'macron');assert.ok(h.drawn.includes('pātī'));
});
test('object reset cannot restore old recognition details when toggling',()=>{
 const h=load();h.run('lastRecognitionDetails={text:"old",items:[],diagnosis:"old"};resetObjectState()');
 assert.equal(h.run('lastRecognitionDetails'),null);h.emit('long-vowels','click');assert.equal(h.get('recognized').textContent,'');
});
