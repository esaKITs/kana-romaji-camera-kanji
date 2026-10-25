let analyze=null,cache=null;
self.onmessage=async({data})=>{
 const {id,engine,text}=data;
 try{
  if(!analyze){
   const {kuromojiTokens,sudachiTokens,checkSudachiSchema,cachedAnalyzer}=await import('./src/adapters.mjs');
   const t=performance.now();
   if(engine==='kuromoji'){
    importScripts('./node_modules/kuromoji/build/kuromoji.js');
    const tokenizer=await new Promise((resolve,reject)=>self.kuromoji.builder({dicPath:'./node_modules/kuromoji/dict/'}).build((e,t)=>e?reject(e):resolve(t)));
    analyze=text=>kuromojiTokens(text,tokenizer.tokenize(text));
   }else if(engine==='sudachi'){
    const s=await import('./node_modules/sudachi/sudachi.js');checkSudachiSchema(s);
    analyze=text=>sudachiTokens(text,JSON.parse(s.tokenize(text,s.TokenizeMode.C)));
   }else throw Error('Unknown engine');
   cache=cachedAnalyzer(analyze);self.postMessage({id,ready:true,initMs:performance.now()-t});
  }
  const t=performance.now(),tokens=cache.analyze(text);
  const {reviewReason}=await import('./src/policy.mjs');
  const {candidateRomanization}=await import('./src/format.mjs');
  self.postMessage({id,tokens:tokens.map(token=>({...token,review:reviewReason(token),
   candidateRomaji:token.reading?{double:candidateRomanization(token,'double'),macron:candidateRomanization(token,'macron')}:null})),analysisAndFormattingMs:performance.now()-t});
 }catch(error){self.postMessage({id,error:error.message});}
};
