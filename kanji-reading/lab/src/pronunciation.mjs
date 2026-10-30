import {pronunciationKana,rubyPronunciationKana,romajiPronunciation} from '../generated/romanizer.mjs';
const hira=s=>String(s||'').normalize('NFC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
const kana=/^[ぁ-ゖァ-ヺー]+$/u;
const particle=t=>t?.pos?.includes('助詞');
const connective=t=>particle(t)&&/^[てで]$/.test(t.surface)&&t.pos.includes('接続助詞');
// The reading-only lexicon cannot distinguish compound 目+医者 from homophones.
const protectedWords=new Map([
 ['毛糸','けいと'],['手入れ','ていれ'],['目医者','めいしゃ'],['姪','めい'],
 ['小歌','こうた'],['小梅','こうめ'],['子牛','こうし'],
]);
function tokenKana(token){
 const literal=kana.test(token.surface)&&!particle(token)&&!token.numericValidated;
 const reading=hira(literal?token.surface:token.reading);
 if(!reading)return '';
 if(particle(token))return ({は:'わ',へ:'え',を:'お'}[token.surface])||reading;
 if(protectedWords.has(token.surface)&&hira(token.reading)===protectedWords.get(token.surface))return reading;
 // Productive numeric pronunciation is resolved separately; never reuse stale
 // analyzer pronunciation after a numerical replacement.
 if(token.numericValidated)return rubyPronunciationKana(reading);
 // The final う of a ワ行五段 verb is not a length mark.
 if(token.pos?.includes('動詞')&&token.conjugationType?.startsWith('五段・ワ行')&&/う$/.test(token.surface)&&/う$/.test(reading))return pronunciationKana(reading.slice(0,-1))+'う';
 const p=(!literal||hira(token.reading)===reading)&&kana.test(token.pronunciation||'')?hira(token.pronunciation):reading;
 // Existing licensed pronunciation lexicon, without a generic ei/ou fallback.
 return pronunciationKana(p);
}
export function pronunciationDomains(token){
 // The existing kana-word repair (e.g. とう+きょう, こう+べ) has already
 // identified one lexical word; it is not a grammatical particle group.
 if(token.lexicalKanaGroup)return [{kana:pronunciationKana(token.surface),separator:''}];
 const members=token.members?.length?token.members:[token],domains=[];let current='',separator='';
 for(let i=0;i<members.length;i++){
  const member=members[i],previous=members[i-1];
  const separates=t=>particle(t)&&!connective(t)&&!(token.lexicalKanaGroup&&t.pos.includes('終助詞'));
  const boundary=previous&&(separates(previous)||separates(member));
  if(boundary){if(current)domains.push({kana:current,separator});current='';separator=' ';}
  let next=tokenKana(member);
  // Only the grammatical volitional auxiliary joins an o-row stem as long o.
  const volitional=previous&&member.pos?.[0]==='助動詞'&&member.surface==='う'&&
   (previous.conjugationForm==='未然ウ接続'||previous.pos?.[0]==='助動詞'&&previous.conjugationForm==='未然形');
  if(volitional&&/[おこそとのほもよろごぞどぼぽょ]$/.test(current)&&next==='う')next='ー';
  // Resolve long vowels first, then join kana for sokuon/nasal context. There
  // is no second lexical lookup that could collapse 子+牛, te+iru or particles.
  current+=next;
 }
 if(current)domains.push({kana:current,separator});
 return domains;
}
export function readingRomanization(reading,style,{surface='',...metadata}={}){
 return pronunciationDomains({surface,reading,...metadata}).map(d=>d.separator+romajiPronunciation(d.kana,style)).join('');
}
export function tokenRomanization(token,style){
 if(!token.reading)return null;
 return pronunciationDomains(token).map(d=>d.separator+romajiPronunciation(d.kana,style)).join('');
}
