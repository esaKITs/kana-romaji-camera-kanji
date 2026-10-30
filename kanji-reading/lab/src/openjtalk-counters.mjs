// Browser adaptation of Open JTalk 1.11's convert_digit_pron,
// convert_numerative_pron and class3 handling. Upstream tables retain BSD
// notices in openjtalk-counter-data.mjs; original C and COPYING are archived.
import {tables,counterBases} from './openjtalk-counter-data.mjs';
export const additionalCounterUnits=Object.keys(counterBases).sort((a,b)=>b.length-a.length);
const pairs=(table,stride=2)=>Object.fromEntries(Array.from({length:table.length/stride},(_,i)=>[table[i*stride],table[i*stride+1]]));
const classes1=['1b','1c1','1c2','1d','1e','1f','1g','1h','1i','1j','1k'].map(c=>({units:new Set(tables['numerative_class'+c]),map:pairs(tables['conv_table'+c],4)}));
const classes2=['2b','2c','2d','2e','2f'].map(c=>({units:new Set(tables['numerative_class'+c]),map:pairs(tables['conv_table'+c])}));
const native=Array.from({length:tables.numerative_class3.length/2},(_,i)=>tables.numerative_class3.slice(i*2,i*2+2));
const nativeNumbers=pairs(tables.conv_table3,4),voiced=pairs(tables.voiced_sound_symbol_list),semivoiced=pairs(tables.semivoiced_sound_symbol_list);
const digitNames=['〇','一','二','三','四','五','六','七','八','九'];
const terminalKana={一:'イチ',二:'ニ',三:'サン',四:'ヨン',五:'ゴ',六:'ロク',七:'ナナ',八:'ハチ',九:'キュウ',十:'ジュウ'};
export function openJTalkCounter(n,unit,kana){
 const base=counterBases[unit];if(!base||!kana||n<1)return null;
 const terminal=n%10?digitNames[n%10]:n%100?'十':n%1000?'百':'千';
 let numberReading=kana,counterReading=base;
 // Native forms take priority: 一箱 is ヒトハコ, never ヒトパコ.
 // This adapter deliberately avoids applying Sino-Japanese sound changes
 // to the native 一/二 form selected by the upstream class3 table.
 if(n<=2&&native.some(([u,r])=>u===unit&&r===base))return {reading:nativeNumbers[digitNames[n]]+base,numberReading:nativeNumbers[digitNames[n]],counterReading:base,kind:'openjtalk-native-counter',segmentable:true,readingSource:'openjtalk-1.11'};
 const c1=classes1.find(c=>c.units.has(unit)),replacement=c1?.map[terminal];
 if(replacement){
  // 百 can already be voiced after 三 or contracted after 六/八. The C
  // routine replaces that entire final numeric node, not a guessed substring.
  const suffix=terminal==='百'?/(?:ヒャク|ビャク|ピャク)$/:new RegExp(terminalKana[terminal]+'$');
  numberReading=numberReading.replace(suffix,replacement);
 }
 const c2=classes2.find(c=>c.units.has(unit)),type=c2?.map[terminal],changes=type==='1'?voiced:type==='2'?semivoiced:null;
 if(changes?.[counterReading[0]])counterReading=changes[counterReading[0]]+counterReading.slice(1);
 return {reading:numberReading+counterReading,numberReading,counterReading,kind:'openjtalk-counter',segmentable:true,readingSource:'openjtalk-1.11'};
}
