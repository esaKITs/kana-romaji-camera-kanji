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
   // A particle's pronunciation is a separate long-vowel domain, even if a
   // caller has grouped it with neighboring words. Keep te/de verb chains,
   // whose iru boundary is handled explicitly above.
   const particle=t=>t?.pos?.includes('助詞')&&!(/^[てで]$/.test(t.surface)&&t.pos.includes('接続助詞'));
   if(auxiliaryIru||particle(previous)||particle(member)){if(current)chunks.push(current);current='';}
   const particleReading=particle(member)?({'は':'ワ','へ':'エ','を':'オ'}[member.surface]):null;
   current+=particleReading||member.reading||'';
  }
  chunks.push(current);
  if(chunks.length>1)return chunks.map(reading=>isHan(token.surface)?rubyKanjiRomaji(reading,style):romaji(reading,style)).join('');
 }
 const particle=token.pos?.includes('助詞')?({'は':'わ','へ':'え','を':'お'}[token.surface]):null;
 return isHan(token.surface)?rubyKanjiRomaji(token.reading,style):romaji(particle||token.reading,style);
}
