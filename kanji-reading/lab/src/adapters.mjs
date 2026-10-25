const kana = /^[ぁ-ゖァ-ヺー]+$/u;
// All offsets are UTF-16, like JS strings. Never derive coordinates here.
export function withOffsets(text, tokens) {
 if(!tokens.length && text.trim())throw Error("Empty analysis for nonempty source");
 let cursor=0;
 return tokens.map(t=>{
  const start=text.indexOf(t.surface,cursor);
  if(start<0 || text.slice(cursor,start).trim()) throw Error('Analyzer/source alignment failed');
  cursor=start+t.surface.length;
  return {...t,start,end:cursor,reading:kana.test(t.reading||'')?t.reading:null};
 }).map((t,i,all)=>{
  if(i===all.length-1 && text.slice(cursor).trim())throw Error('Unconsumed source text');
  return t;
 });
}
export function kuromojiTokens(text, raw) {
 return withOffsets(text,raw.map(t=>({surface:t.surface_form,reading:t.reading,
  pos:[t.pos,t.pos_detail_1,t.pos_detail_2,t.pos_detail_3],unknown:t.word_type==='UNKNOWN'})));
}
// Package-specific schema shim for sudachi@0.1.5, NOT upstream SudachiPy.
// Its dictionary_form contains inflected kana readings; reading_form is lemma.
// Probe at initialization; refuse other schemas rather than silently swap them.
export function checkSudachiSchema(api) {
 const t=JSON.parse(api.tokenize('読みました',api.TokenizeMode.C));
 if(t[0]?.dictionary_form!=='ヨミ'||t[0]?.reading_form!=='読む')throw Error('Unexpected sudachi@0.1.5 schema');
}
export function sudachiTokens(text, raw) {
 return withOffsets(text,raw.map(t=>({surface:t.surface,reading:t.dictionary_form,
  pos:t.poses,unknown:!kana.test(t.dictionary_form||'')})));
}
export function cachedAnalyzer(analyze,{limit=128,maxCharacters=4096}={}) {
 const cache=new Map();
 return {analyze(text){
  if(text.length>maxCharacters)throw Error('Split source into lines before analysis');
  if(cache.has(text)){const v=cache.get(text);cache.delete(text);cache.set(text,v);return structuredClone(v);}
  const result=analyze(text);cache.set(text,structuredClone(result));
  if(cache.size>limit)cache.delete(cache.keys().next().value);
  return result;
 },clear(){cache.clear()},get size(){return cache.size}};
}

export function separatedSudachiTokens(text,raw){
 const normalized=withOffsets(text,raw.map(t=>({surface:t.surface,reading:t.readingForm,pos:t.partOfSpeech,unknown:t.isOov})));
 // Upstream exposes code-point offsets. Verify those against the source; JS uses UTF-16.
 for(let i=0;i<raw.length;i++){
  if(!Number.isInteger(raw[i].begin)||!Number.isInteger(raw[i].end)||raw[i].begin<0||raw[i].end<raw[i].begin||raw[i].end>[...text].length)throw Error('Invalid Sudachi source offset');
  const start=[...text].slice(0,raw[i].begin).join('').length,end=[...text].slice(0,raw[i].end).join('').length;
  if(normalized[i].start!==start||normalized[i].end!==end)throw Error('Sudachi source-offset mismatch');
 }
 return normalized;
}
