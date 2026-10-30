let engine=null;
self.onmessage=async({data})=>{
 try{
  if(data.command==='init'){
   engine?.dispose();const {loadEngine}=await import('./src/engines.mjs?v=0.2.21');engine=await loadEngine(data.engine);
   self.postMessage({id:data.id,ready:true,initMs:engine.initMs,wasmMemoryBytes:engine.wasmMemory?.()??null});return;
  }
  if(data.command==='dispose'){engine?.dispose();engine=null;self.postMessage({id:data.id,disposed:true});return;}
  if(!engine)throw Error('Engine not initialized');
  const t=performance.now();let tokens=engine.analyze(data.text),rawTokens=data.diagnostics?tokens:null,numericDecisions=null;
  if(data.numeric){const {applyNumericReadings}=await import('./src/numeric-reading.mjs?v=0.2.21');const corrected=applyNumericReadings(data.text,tokens);tokens=corrected.tokens;numericDecisions=corrected.decisions;}
  self.postMessage({id:data.id,tokens,numericDecisions,...(data.diagnostics?{rawTokens}:{}),analysisMs:performance.now()-t,wasmMemoryBytes:engine.wasmMemory?.()??null});
 }catch(e){self.postMessage({id:data.id,error:e.message||String(e)})}
};
