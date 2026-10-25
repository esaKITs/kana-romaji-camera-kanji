import {isHan} from './policy.mjs';
import {romaji,rubyKanjiRomaji} from '../generated/romanizer.mjs';
// Pronunciation selection precedes the unchanged spelling engine.
// Display groups retain morphological boundaries that must not become long vowels.
export function candidateRomanization(token,style){
 if(!token.reading)return null;
 const members=token.members;
 if(members?.length){
  const chunks=[];let current='';
  for(let i=0;i<members.length;i++){
   const previous=members[i-1],member=members[i];
   const auxiliaryIru=previous&&/^[てで]$/.test(previous.surface)&&previous.pos?.includes('接続助詞')&&member.pos?.includes('動詞')&&member.pos.some(v=>v.startsWith('非自立'))&&/^い/u.test(member.surface)&&/^イ/u.test(member.reading||'');
   if(auxiliaryIru){chunks.push(current);current='';}
   current+=member.reading||'';
  }
  chunks.push(current);
  if(chunks.length>1)return chunks.map(reading=>isHan(token.surface)?rubyKanjiRomaji(reading,style):romaji(reading,style)).join('');
 }
 const particle=token.pos?.includes('助詞')?({'は':'わ','へ':'え','を':'お'}[token.surface]):null;
 return isHan(token.surface)?rubyKanjiRomaji(token.reading,style):romaji(particle||token.reading,style);
}
