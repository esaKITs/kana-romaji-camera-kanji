import{isTarget,reviewReason}from'../lab/src/policy.mjs';
// Display grouping only: raw analyzer/evaluation tokens remain unchanged.
export function openingBullet(line){
 if(!/^〇万一(?:[^0-9０-９〇一二三四五六七八九十百千万億兆]|$)/u.test(line.text))return null;
 const g=line.glyphs[0],h=g?.box.y1-g?.box.y0,w=g?.box.x1-g?.box.x0,lh=line.box.y1-line.box.y0;
 return g?.text==='〇'&&w/h>=.7&&w/h<=1.3&&h/lh>=.5&&h/lh<=1.5?{start:0,end:1,box:g.box,source:'〇',reason:'list-marker-before-lexical-phrase'}:null;
}
export function lexicalTokens(text,tokens,pairs=[],bulletEnd=null){
 const replacements=[];
 for(const match of text.matchAll(/万一/gu)){
  const start=match.index,end=start+2,numeric=/[0-9０-９〇一二三四五六七八九十百千万億兆]/u;
  if((start>0&&start!==bulletEnd&&numeric.test(text[start-1]))||numeric.test(text[end]||''))continue;
  if(pairs.some(p=>start<p.end&&end>p.start))continue;
  const touched=tokens.filter(t=>t.start<end&&t.end>start);
  if(!touched.length||touched[0].start!==start||touched.at(-1).end!==end||touched.map(t=>t.surface).join('')!=='万一'||touched.some(t=>t.pos?.includes('固有名詞')))continue;
  replacements.push({surface:'万一',start,end,reading:'マンイチ',pos:['副詞'],unknown:false,lexicalCompoundValidated:true,readingSource:'authored-lexical-reading-v1'});
 }
 return tokens.flatMap(t=>{const r=replacements.find(r=>r.start<t.end&&r.end>t.start);return r?(t.start===r.start?[r]:[]):[{...t}];});
}
export function displayTokens(text,tokens,mode,pairs=[],{bulletEnd=null}={}){
 tokens=lexicalTokens(text,tokens.map(t=>!t.reading&&/^[ぁ-ゖァ-ヺー]+$/u.test(t.surface)?{...t,reading:t.surface,readingSource:'literal-kana'}:t),pairs,bulletEnd);
 const output=[];
 for(const original of tokens){
  let token={...original};
  if(token.surface==='十分'&&token.reading==='ジュウブン'&&!token.unknown&&!token.pos?.includes('固有名詞')&&/^(?:に|な|だ|です|である)/.test(text.slice(token.end)))token.lexicalValidated=true;
  const previous=output.at(-1),members=previous?.members||[previous],last=members.at(-1);
  const eligible=t=>t&&t.reading&&!t.numericValidated&&!reviewReason(t)&&[...t.surface].every(c=>isTarget(c,mode))&&!pairs.some(p=>t.start<p.end&&t.end>p.start);
  const p=last?.pos||[],q=token.pos||[];
  const verbChain=members.some(t=>t?.pos?.some(x=>x==='動詞'||x==='形容詞'));
  const attach=(p[0]==='接頭詞'&&q[0]!=='助詞')||
   (p.includes('接続助詞')&&/^[てで]$/.test(last.surface)&&q.includes('動詞')&&q.some(v=>v.startsWith('非自立'))&&/^い/u.test(token.surface)&&/^イ/u.test(token.reading||''))||
   (verbChain&&(q[0]==='助動詞'||q[0]==='動詞'&&(q.includes('接尾')||q.includes('非自立'))||q.includes('接続助詞')&&/^[てで]$/.test(token.surface)))||
   (p[0]==='名詞'&&q[0]==='名詞'&&q.includes('接尾'))||
   (p.includes('サ変接続')&&q[0]==='動詞'&&/^(し|する|すれ|せ)$/.test(token.surface));
  if(previous&&previous.end===token.start&&eligible(previous)&&eligible(token)&&attach){
   output[output.length-1]={...previous,surface:previous.surface+token.surface,reading:previous.reading+token.reading,end:token.end,members:[...members,token],readingSource:'dictionary-display-group'};
  }else output.push(token);
 }
 return output;
}
