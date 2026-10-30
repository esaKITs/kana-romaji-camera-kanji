// Included in the camera controller by build.mjs. Pure conversion stays
// synchronous: delayed OCR always paints using the currently selected mode.
const longVowelStorageKey='esakits.kana-romaji.long-vowels.v1';
let longVowelMode='double';
try{if(window.localStorage?.getItem(longVowelStorageKey)==='macron')longVowelMode='macron'}catch{}
const toHiragana=text=>String(text).normalize('NFC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
const vowelMacrons={a:'ā',i:'ī',u:'ū',e:'ē',o:'ō'};
// Explicit classroom conventions. UniDic has alternatives for some readings,
// and テイクアウト is intentionally kept as teikuauto, matching Irodori.
const pronunciationOverrides=new Map(Object.entries({
 'おばあさん':'おばーさん','おじいさん':'おじーさん','おねえさん':'おねーさん',
 'こおり':'こーり','いい':'いー','いいえ':'いーえ','おもう':'おもう',
 'おもいます':'おもいます','おもいました':'おもいました','おもって':'おもって',
 'ていくあうと':'ていくあうと','おうかがいします':'おうかがいします',
 'おうかがい':'おうかがい','たいいく':'たいいく'
}));
const pronunciationTails=['ではありませんでした','ではありません','じゃありません','ませんでした','ございました','ございます','でした','でしょう','ですね','ですよ','ですか','です','でしたか','ました','ません','ます','ください','します','しました','して','する','しない','ね','よ','か','も','に','の','が','を','と','は','へ'];
const pronunciationCache=new Map();
let invariantPronunciationWords=null;
function invariantWords(){
 if(!invariantPronunciationWords){
  // Existing, reviewed kana vocabulary supplies boundaries without importing
  // kanji readings into OCR. No guesses for unmatched characters are allowed.
  invariantPronunciationWords=new Set([...textbookReadings.values(),...katakanaLexicon,...textbookFixedExpressions.keys(),...pronunciationTails,
   'ている','ています','ていました','ない','なかった','から','まで','より','けれど','けど','おねがいします'].map(toHiragana).filter(t=>/^[ぁ-ゖー]+$/.test(t)));
 }
 return invariantPronunciationWords;
}
function knownPronunciation(kana){
 if(pronunciationOverrides.has(kana))return pronunciationOverrides.get(kana);
 if(Object.hasOwn(pronunciationLexicon,kana))return pronunciationLexicon[kana];
 return null;
}
function pronounceKanaRun(kana){
 if(pronunciationCache.has(kana))return pronunciationCache.get(kana);
 // Match a complete lexical reading first. Never replace ei/ou substrings.
 let result=knownPronunciation(kana);
 if(result===null&&kana.length<=128){
  for(const tail of pronunciationTails){
   if(kana.length<=tail.length||!kana.endsWith(tail))continue;
   const head=kana.slice(0,-tail.length),pron=knownPronunciation(head);
   if(pron!==null){result=pron+(knownPronunciation(tail)??tail);break}
  }
  if(result===null){
   // Conservative complete-coverage segmentation. A partial dictionary hit
   // never changes an otherwise unknown word. Prefer complete longer words;
   // conflicting best segmentations retain the original vowel sequence.
   const dp=Array(kana.length+1).fill(null);dp[0]={score:0,text:'',ambiguous:false};
   const invariant=invariantWords();
   for(let end=1;end<=kana.length;end++)for(let start=0;start<end;start++){
    if(!dp[start])continue;
    const word=kana.slice(start,end),pron=knownPronunciation(word)??(invariant.has(word)?word:null);
    if(pron===null)continue;
    const score=dp[start].score+word.length*word.length,text=dp[start].text+pron;
    if(!dp[end]||score>dp[end].score)dp[end]={score,text,ambiguous:dp[start].ambiguous};
    else if(score===dp[end].score&&(text!==dp[end].text||dp[start].ambiguous))dp[end].ambiguous=true;
   }
   const best=dp[kana.length];if(best&&!best.ambiguous)result=best.text;
  }
 }
 result??=kana; // Uncertain readings, including unknown names, keep their vowels.
 if(pronunciationCache.size>=512)pronunciationCache.clear();
 pronunciationCache.set(kana,result);return result;
}
function pronunciationKana(text){
 return toHiragana(text).replace(/[ぁ-ゖー]+/g,pronounceKanaRun);
}
function romanizeUnits(text,mode=longVowelMode,{pronounced=false}={}){
 const kana=pronounced?toHiragana(text):pronunciationKana(text),units=[];
 for(let i=0;i<kana.length;i++){
  const c=kana[i],pair=kana.slice(i,i+2),next=pairs[kana.slice(i+1,i+3)]||map[kana[i+1]]||'';
  if(c==='ー'){
   const last=units[units.length-1],v=last?.text.match(/[aeiou]$/)?.[0];
   if(v){if(mode==='macron')last.text=last.text.slice(0,-1)+vowelMacrons[v];else units.push({start:i,end:i+1,text:v})}
   continue;
  }
  if(c==='っ'){units.push({start:i,end:i+1,text:next.startsWith('ch')?'t':/^[bcdfghjklmpqrstvwxyz]/.test(next)?next[0]:''});continue}
  if(c==='ん'){units.push({start:i,end:i+1,text:/^[bmp]/.test(next)?'m':/^[aeiouy]/.test(next)?'n’':'n'});continue}
  if(pairs[pair]){units.push({start:i,end:i+2,text:pairs[pair]});i++;continue}
  units.push({start:i,end:i+1,text:map[c]??({'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ゔ':'vu'}[c]??c)});
 }
 return units;
}
function romaji(text,mode=longVowelMode){return romanizeUnits(text,mode).map(x=>x.text).join('')}
// Render an already resolved pronunciation without looking up its spelling again.
function romajiPronunciation(text,mode=longVowelMode){return romanizeUnits(text,mode,{pronounced:true}).map(x=>x.text).join('')}
function rubyPronunciationKana(text){
 const kana=pronunciationKana(text);
 // Only verified kanji ruby gets this orthographic long-vowel conversion.
 // The ordinary kana path retains its lexical safeguards (e.g. おもう).
 return kana.replace(/([おこそとのほもよろごぞどぼぽょぉ])う/g,'$1ー')
            .replace(/([うくすつぬふむゆるぐずづぶぷゅぅ])う/g,'$1ー')
            .replace(/([おこそとのほもよろごぞどぼぽょぉ])お/g,'$1ー');
}
function rubyKanjiRomaji(text,mode=longVowelMode){
 const kana=toHiragana(text);
 // Respect reviewed exceptions rather than turning an arbitrary ou into ō.
 if(pronunciationOverrides.has(kana)&&pronunciationOverrides.get(kana)===kana)return romaji(kana,mode);
 return romanizeUnits(rubyPronunciationKana(text),mode).map(x=>x.text).join('');
}

function verifiedExpressionRomaji(text){
 // These existing fixed expressions are reviewed pronunciation strings, not
 // arbitrary Latin input. Respect word boundaries before removing label spaces.
 return text.split(/\s+/).map(word=>{
  word=word.replace(/n(?=[bmp])/g,'m');
  return longVowelMode==='macron'?word.replace(/([aeiou])\1/g,(_,v)=>vowelMacrons[v]):word;
 }).join('');
}
function renderLongVowelToggle(){
 const b=$('long-vowels');b.textContent=longVowelMode==='macron'?'ā':'aa';
 b.setAttribute('aria-pressed',String(longVowelMode==='macron'));
 b.setAttribute('aria-label','Long vowels: '+(longVowelMode==='macron'?'macron (ā). Switch to double vowels (aa)':'double vowels (aa). Switch to macron (ā)'));
 b.title='Long vowels: '+(longVowelMode==='macron'?'ā → aa':'aa → ā');
}
function setLongVowelMode(mode){
 if(!['double','macron'].includes(mode))return;
 longVowelMode=mode;
 try{window.localStorage?.setItem(longVowelStorageKey,mode)}catch{}
 renderLongVowelToggle();
 // Preserve captures, tracking, palette and OCR generation; only repaint text.
 paint(stillMode?stillItems:tracks);
 if(lastRecognitionDetails)renderRecognitionDetails();
}
$('long-vowels').addEventListener('click',()=>setLongVowelMode(longVowelMode==='double'?'macron':'double'));
renderLongVowelToggle();

let lastRecognitionDetails=null;
function renderRecognitionDetails(){
 if(!lastRecognitionDetails)return;
 const d=lastRecognitionDetails,items=stillMode?stillItems:d.items;
 $('recognized').textContent='OCR text:\n'+(d.text||'(none)')+'\n\nKana:\n'+(items.map(x=>x.text+' → '+contextualRomaji(x.text)).join('\n')||'(none)')+'\n\n'+d.diagnosis;
}

// Only explicit OCR join groups may supply context across label fragments.
// Coordinates, images and recognition items are never modified here.
function labelRomaji(items){
 const output=new Map(items.map(it=>[it,it.rubyKanji?rubyKanjiRomaji(it.text):contextualRomaji(it.text)])),groups=new Map();
 for(const it of items){
  if(!it.joinGroup||!kanaOnly.test(it.text)||/\s/.test(it.text))continue;
  const group=groups.get(it.joinGroup)||[];group.push(it);groups.set(it.joinGroup,group);
 }
 for(const group of groups.values()){
  group.sort((a,b)=>a.box.x0-b.box.x0);let run=[];
  const flush=()=>{
   if(run.length<2)return;
   const text=run.map(it=>it.text).join(''),units=romanizeUnits(text);let start=0;
   for(const it of run){const end=start+toHiragana(it.text).length;output.set(it,units.filter(u=>u.start>=start&&u.start<end).map(u=>u.text).join(''));start=end}
  };
  for(const it of group){
   const prev=run.at(-1);
   if(prev){const h=Math.min(prev.box.y1-prev.box.y0,it.box.y1-it.box.y0),gap=it.box.x0-prev.box.x1;
    if(Math.abs(prev.box.y1-it.box.y1)>h*.16||gap<0||gap>h*.1){flush();run=[]}}
   run.push(it);
  }
  flush();
 }
 return output;
}
