export const modes=Object.freeze(['あア漢','ア漢','漢']);
const han=/[\p{Script=Han}々〆]/u;
export const isHan=text=>han.test(text);
export function isTarget(char,mode){
 if(!modes.includes(mode))throw Error('Invalid mode');
 return han.test(char)||mode==='あア漢'&&/[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(char)
  ||mode==='ア漢'&&/[\p{Script=Katakana}ー]/u.test(char);
}
// An experimental review gate, not a confidence probability or complete list.
const reviewWords=['一日','生物','人気','今日','明日','上手','下手','何'];
export function reviewReason(token){
 if(token.numericValidated&&token.reading)return null;
 if(token.lexicalValidated&&token.surface==='十分'&&token.reading==='ジュウブン'&&!token.unknown&&!token.pos?.includes('固有名詞'))return null;
 if(token.lexicalCompoundValidated&&token.surface==='万一'&&token.reading==='マンイチ'&&!token.unknown&&!token.pos?.includes('固有名詞'))return null;
 if(!isHan(token.surface))return null;
 if(token.unknown||!token.reading)return 'unknown-reading';
 if(token.pos?.includes('固有名詞'))return 'proper-name';
 if(reviewWords.some(w=>token.surface.includes(w)))return 'ambiguous-reading';
 if(/[0-9０-９一二三四五六七八九十百千万億]/u.test(token.surface)||token.pos?.includes('助数詞'))return 'number-or-date';
 return null;
}
// Pure whole-token all-Han or prefix-Han+okurigana mapping only.
// Interior/multiple Han runs are deferred: never split an idiom arbitrarily.
export function splitOkurigana(surface,reading){
 const h=reading?.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
 if(!h)return null;
 if(/^[\p{Script=Han}々〆]+$/u.test(surface))return [{surface,reading:h,start:0,end:surface.length}];
 const m=surface.match(/^([\p{Script=Han}々〆]+)([ぁ-ゖ]+)$/u);
 if(!m||!h.endsWith(m[2])||h.length<=m[2].length)return null;
 return [{surface:m[1],reading:h.slice(0,-m[2].length),start:0,end:m[1].length},
  {surface:m[2],reading:m[2],start:m[1].length,end:surface.length}];
}
