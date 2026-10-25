import {rubyKanjiRomaji} from '../generated/romanizer.mjs';
import {reviewReason} from './policy.mjs';
const katakana=t=>t?.normalize('NFC').replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+96));
export function evaluateCase(item,tokens){
 const start=item.text.indexOf(item.target),end=start+item.target.length;
 if(start<0)throw Error('Missing target');
 const selected=tokens.filter(t=>t.start<end&&t.end>start);
 const exact=selected[0]?.start===start&&selected.at(-1)?.end===end;
 const reading=exact&&selected.every(t=>t.reading)?selected.map(t=>t.reading).join(''):null;
 const accepted=(item.acceptedReadings||[]).map(katakana);
 const romaji=reading?{double:rubyKanjiRomaji(reading,'double'),macron:rubyKanjiRomaji(reading,'macron')}:null;
 const correct=reading!==null&&accepted.includes(katakana(reading));
 const reasons=[...new Set(selected.map(reviewReason).filter(Boolean))];
 if(!exact)reasons.push('target-boundary-unresolved');
 if(!reading)reasons.push('no-reading');
 const displayReading=reasons.length?null:reading;
 return {id:item.id,category:item.category,text:item.text,target:item.target,acceptedReadings:item.acceptedReadings,
  reading,romaji,correct,emitted:!!romaji?.double,reviewReasons:reasons,displayReading,displayEmitted:!!displayReading,displayCorrect:!!displayReading&&correct,tokens:selected};
}
export function summarize(rows){
 const n=rows.length,emitted=rows.filter(x=>x.emitted).length,correct=rows.filter(x=>x.correct).length;
 const safe=rows.filter(x=>x.displayEmitted),safeCorrect=safe.filter(x=>x.displayCorrect).length;
 return {n,raw:{correct,emitted,wrong:emitted-correct,abstained:n-emitted,accuracy:correct/n,romanizationCoverage:emitted/n,errorAmongEmitted:emitted?(emitted-correct)/emitted:null,errorAmongAll:(emitted-correct)/n},
  conservativeExperimentalGate:{correct:safeCorrect,emitted:safe.length,wrong:safe.length-safeCorrect,abstained:n-safe.length,accuracy:safeCorrect/n,romanizationCoverage:safe.length/n,errorAmongEmitted:safe.length?(safe.length-safeCorrect)/safe.length:null}};
}
