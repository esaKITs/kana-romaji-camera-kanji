// Numeric pronunciation only. Existing kana-to-romaji spelling is unchanged.
// Rules are productive number/counter rules, not an evaluation-sentence lookup.
const digits={零:0,〇:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
const names=['ゼロ','イチ','ニ','サン','ヨン','ゴ','ロク','ナナ','ハチ','キュウ'];
const numberChars='0-9０-９零〇一二三四五六七八九十百千';
const pattern=new RegExp(`[${numberChars}]+(?:時間|日間|日目|本|杯|匹|人|階|冊|分|時|月|日|歳)`,'gu');
export function parseNumber(source){
 const s=source.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
 if(/^\d+$/.test(s)){if(s.length>4||s.length>1&&s[0]==='0')return null;return Number(s);}
 if(!/^[零〇一二三四五六七八九十百千]+$/.test(s))return null;
 if(s.length===1&&s in digits)return digits[s];
 // Multiple kanji digits without 十/百/千 can mean an estimate, ID, or positional year.
 if(!/[十百千]/.test(s))return null;
 let total=0,pending=null,previousUnit=10000;
 for(const c of s){
  if(c in digits){if(pending!==null||digits[c]===0)return null;pending=digits[c];continue;}
  const unit={十:10,百:100,千:1000}[c];
  if(unit>=previousUnit)return null;
  total+=(pending??1)*unit;pending=null;previousUnit=unit;
 }
 return total+(pending??0);
}
export function numberKana(n){
 if(!Number.isInteger(n)||n<0||n>9999)return null;
 if(n<10)return names[n];
 if(n<100)return (n<20?'ジュウ':names[Math.floor(n/10)]+'ジュウ')+(n%10?names[n%10]:'');
 if(n<1000){const h=Math.floor(n/100);return ({1:'ヒャク',3:'サンビャク',6:'ロッピャク',8:'ハッピャク'}[h]??names[h]+'ヒャク')+(n%100?numberKana(n%100):'');}
 const th=Math.floor(n/1000);return ({1:'セン',3:'サンゼン',8:'ハッセン'}[th]??names[th]+'セン')+(n%1000?numberKana(n%1000):'');
}
const result=(number,counter,kind='counter')=>({reading:number+counter,numberReading:number,counterReading:counter,kind,segmentable:true});
function counted(n,unit){
 const kana=numberKana(n);if(n<1||!kana)return null;
 const last=n%10;
 if(unit==='歳'){
  if(n===20)return {reading:'ハタチ',kind:'age-irregular',segmentable:false};
  const contracted=last===1?kana.replace(/イチ$/,'イッ'):last===8?kana.replace(/ハチ$/,'ハッ'):/ジュウ$/.test(kana)?kana.replace(/ジュウ$/,'ジュッ'):kana;
  return result(contracted,'サイ','age');
 }
 if(unit==='人'){
  if(n===1)return {reading:'ヒトリ',kind:'person-irregular',segmentable:false};
  if(n===2)return {reading:'フタリ',kind:'person-irregular',segmentable:false};
  return result(last===4?kana.replace(/ヨン$/,'ヨ'):kana,'ニン');
 }
 if(unit==='冊')return result(last===1?kana.replace(/イチ$/,'イッ'):last===8?kana.replace(/ハチ$/,'ハッ'):n%10===0&&n%100!==0?kana.replace(/ジュウ$/,'ジュッ'):kana,'サツ');
 if(unit==='階'&&n>99)return null; // High-floor variants are outside this first rule set.
 if(unit==='分'){
  if(last===1)return result(kana.replace(/イチ$/,'イッ'),'プン');
  if(last===6)return result(kana.replace(/ロク$/,'ロッ'),'プン');
  if(last===8)return result(kana.replace(/ハチ$/,'ハッ'),'プン');
  if(n%10===0&&/ジュウ$/.test(kana))return result(kana.replace(/ジュウ$/,'ジュッ'),'プン');
  if(n%100===0&&/ク$/.test(kana))return result(kana.replace(/ク$/,'ッ'),'プン');
  return result(kana,/[ン]$/.test(kana)?'プン':'フン');
 }
 const initial={本:['ホン','ポン','ボン'],杯:['ハイ','パイ','バイ'],匹:['ヒキ','ピキ','ビキ'],階:['カイ','カイ','ガイ']}[unit];
 if(!initial)return null;
 if(last===1)return result(kana.replace(/イチ$/,'イッ'),initial[1]);
 if(last===6)return result(kana.replace(/ロク$/,'ロッ'),initial[1]);
 if(last===8)return result(kana.replace(/ハチ$/,'ハッ'),initial[1]);
 if(n%10===0&&/ジュウ$/.test(kana))return result(kana.replace(/ジュウ$/,'ジュッ'),initial[1]);
 if(n%100===0&&/ク$/.test(kana))return result(kana.replace(/ク$/,'ッ'),initial[1]);
 if(last===3||n%1000===0)return result(kana,initial[2]);
 return result(kana,initial[0]);
}
function context(text,start,end){
 const before=text.slice(0,start).split(/[。！？\n]/).at(-1),after=text.slice(end).split(/[。！？\n]/)[0];
 return {before,after};
}
const dayNames={2:'フツカ',3:'ミッカ',4:'ヨッカ',5:'イツカ',6:'ムイカ',7:'ナノカ',8:'ヨウカ',9:'ココノカ',10:'トオカ',14:'ジュウヨッカ',20:'ハツカ',24:'ニジュウヨッカ'};
function day(n,suffix,ctx){
 const {before,after}=ctx;
 const inCalendar=/[0-9０-９一二三四五六七八九十]+月\s*$/.test(before)||/(?:日付|月日|誕生日)(?:は|が|：|:)?\s*$/.test(before)||/今日は\s*$/.test(before)&&/^(?:です|になります)/.test(after);
 if(n<1||inCalendar&&n>31)return null;
 const dateMonth=before.match(/([0-9０-９一二三四五六七八九十]+)月\s*$/);
 if(dateMonth){const month=parseNumber(dateMonth[1]);if(month===null||month<1||month>12)return null;
  const dateYear=before.slice(0,dateMonth.index).match(/(?:^|西暦)([0-9０-９]{4})年$/);const year=dateYear?parseNumber(dateYear[1]):null;
  const feb=year===null?29:year%4===0&&(year%100!==0||year%400===0)?29:28;
  if(n>({2:feb,4:30,6:30,9:30,11:30}[month]??31))return null;
 }
 const duration=suffix.length>1||/^(?:中|で(?!す|ある|ございます)|だけ|ほど|ぐらい|程度|以内|以上|以下|かか|掛か|休|待|働|滞在)/.test(after)||/(?:期間は|まる|丸|所要)\s*$/.test(before);
 if(n===1){
  if(inCalendar&&duration)return null;
  if(inCalendar)return {reading:'ツイタチ',kind:'calendar-day',segmentable:false};
  if(duration)return {...result('イチ','ニチ'+(suffix==='日間'?'カン':suffix==='日目'?'メ':''),'duration-day')};
  return null;
 }
 const tail=suffix==='日間'?'カン':suffix==='日目'?'メ':'';
 if(dayNames[n])return {reading:dayNames[n]+tail,kind:inCalendar?'calendar-day':'day-count',segmentable:false};
 // Conventional 17/19/27/29 readings; larger durations use productive cardinal forms.
 const cardinal=n<=31&&n%10===7?numberKana(n).replace(/ナナ$/,'シチ'):n<=31&&n%10===9?numberKana(n).replace(/キュウ$/,'ク'):numberKana(n);
 return result(cardinal,'ニチ'+tail,inCalendar?'calendar-day':'duration-day');
}
export function numericSpans(text){
 const spans=[];
 for(const m of text.matchAll(pattern)){
  const surface=m[0],start=m.index,end=start+surface.length;
  const pieces=surface.match(new RegExp(`^([${numberChars}]+)(.+)$`,'u')),number=pieces[1],unit=pieces[2],n=parseNumber(number),ctx=context(text,start,end);
  let pronunciation=null,reason=null;
  const prior=text[start-1]||'',following=text[end]||'';
  if(/[A-Za-z0-9０-９零〇一二三四五六七八九十百千万億兆.,．・/／:：+＋−－\-〜～]/u.test(prior)||prior==='第')reason='numeric-prefix-or-range';
  else if(n===null||n>9999||n===0)reason='unsupported-number';
  else if(/[A-Za-z]/.test(following))reason='identifier-suffix';
  else if(unit==='分'&&(/^の[0-9０-９一二三四五六七八九十]/.test(ctx.after)||/^(?:割|裂|配|率|比|岐|類|法|する|した|され)/.test(ctx.after)))reason='fraction-or-lexeme';
  else if(unit==='分'&&number==='十'&&!/^(?:間|後|前|待|休|歩|かか|掛か|ほど|以内|以上|以下|だけ)/.test(ctx.after)&&!/(?:時間|所要|あと|残り)\s*(?:は|が)?\s*$/.test(ctx.before))reason='ambiguous-jubun';
  else if(unit==='日'||unit==='日間'||unit==='日目')pronunciation=day(n,unit,ctx);
  else if(unit==='月'){
   if(n>12||/^(?:間|ほど|ぐらい|程度|かか|掛か|待|経)/.test(ctx.after))reason='ambiguous-or-invalid-month';
   else if(n<=3&&!/[0-9０-９]/.test(number)&&!/(?:年|誕生日は|開催は|入学は)\s*$/.test(ctx.before)&&!/^([0-9０-９一二三四五六七八九十]+日|に(?:入学|卒業|帰|行|始|開|生ま)|です|末|初旬|中旬|下旬)/.test(ctx.after))reason='ambiguous-month-duration';
   else pronunciation=result(({4:'シ',7:'シチ',9:'ク'}[n]??numberKana(n)),'ガツ','calendar-month');
  }else if(unit==='時'||unit==='時間'){
   if(n>24)reason='unsupported-hour';
   else pronunciation=result(({4:'ヨ',7:'シチ',9:'ク',14:'ジュウヨ',17:'ジュウシチ',19:'ジュウク',24:'ニジュウヨ'}[n]??numberKana(n)),unit==='時'?'ジ':'ジカン','time');
  }else pronunciation=counted(n,unit);
  if(!pronunciation&&!reason)reason='context-or-scope-unresolved';
  const parts=pronunciation?.segmentable?[
   {surface:number,reading:pronunciation.numberReading,start:0,end:number.length},
   {surface:unit,reading:pronunciation.counterReading,start:number.length,end:surface.length}
  ]:null;
  spans.push({surface,start,end,number:n,unit,reading:pronunciation?.reading??null,kind:pronunciation?.kind??null,parts,reason});
 }
 return spans;
}
export function applyNumericReadings(text,tokens){
 const decisions=[],replacements=[];
 for(const span of numericSpans(text)){
  const touched=tokens.filter(t=>t.start<span.end&&t.end>span.start);
  if(!touched.length||touched[0].start!==span.start||touched.at(-1).end!==span.end||touched.map(t=>t.surface).join('')!==span.surface){decisions.push({...span,status:'preserved',reason:'token-boundary-or-lexeme'});continue;}
  if(touched.some(t=>t.pos?.includes('固有名詞'))){decisions.push({...span,status:'preserved',reason:'proper-name'});continue;}
  if(span.number===1&&span.unit==='日'&&text[span.end]==='中'&&tokens.find(t=>t.start===span.end)?.surface!=='中'){span.reading=null;span.reason='unresolved-day-following-lexeme';}
  // Sufficient/adequate 十分 is a lexical word, not a forced ten-minute reading.
  if(span.reason==='ambiguous-jubun'&&/^(?:に|な|だ|です|である)/.test(text.slice(span.end))){decisions.push({...span,status:'preserved',reason:'lexical-jubun'});continue;}
  const token={surface:span.surface,start:span.start,end:span.end,reading:span.reading,pos:['数詞助数詞'],unknown:!span.reading,
   numericValidated:!!span.reading,numericParts:span.parts,readingSource:'numeric-rule-v1',numericReason:span.reason};
  replacements.push(token);decisions.push({...span,status:span.reading?'resolved':'withheld'});
 }
 // 一日中 is ichinichi-juu, not an independent chuu suffix. Keep the
 // original day boundary so source-span evaluation and glyph mapping survive.
 for(const decision of decisions){
  if(decision.status!=='resolved'||decision.number!==1||decision.unit!=='日'||text[decision.end]!=='中')continue;
  const next=tokens.find(t=>t.start===decision.end&&t.surface==='中');
  if(next){replacements.push({...next,reading:'ジュウ',unknown:false,numericValidated:true,readingSource:'numeric-rule-v1',numericParts:null});}
 }
 const output=[];
 for(const token of tokens){
  const replacement=replacements.find(r=>r.start<token.end&&r.end>token.start);
  if(!replacement){output.push({...token});continue;}
  if(replacement.start===token.start)output.push(replacement);
 }
 return {tokens:output,decisions};
}
