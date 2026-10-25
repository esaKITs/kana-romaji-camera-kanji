import {kuromojiTokens,separatedSudachiTokens,cachedAnalyzer} from './adapters.mjs';
export async function loadEngine(engine,{node=false}={}){
 const t=performance.now();let analyze,dispose=()=>{},wasmMemory=null;
 if(engine==='kuromoji'){
  let k;
  if(node){const {createRequire}=await import('node:module');k=createRequire(import.meta.url)('kuromoji');}
  else{importScripts(new URL('./vendor/kuromoji/build/kuromoji.js',self.location.href).href);k=self.kuromoji;}
  // Kuromoji passes dicPath through path.join, which corrupts full http(s) URLs.
  const dicPath=node?(await import('node:url')).fileURLToPath(new URL('../node_modules/kuromoji/dict/',import.meta.url)):new URL('./vendor/kuromoji/dict/',self.location.href).pathname;
  const tokenizer=await new Promise((resolve,reject)=>k.builder({dicPath}).build((e,v)=>e?reject(e):resolve(v)));
  analyze=text=>kuromojiTokens(text,tokenizer.tokenize(text));
 }else if(engine==='sudachi-small'){
  const s=await import('../generated/sudachi-small/sudachi_wasm.js');let dictionary,exports;
  if(node){const fs=await import('node:fs/promises');exports=s.initSync({module:await fs.readFile(new URL('../generated/sudachi-small/sudachi_wasm_bg.wasm',import.meta.url))});dictionary=await fs.readFile(new URL('../generated/sudachi-small/system-small.dic',import.meta.url));}
  else{
   exports=await s.default(new URL('../generated/sudachi-small/sudachi_wasm_bg.wasm',import.meta.url));
   const manifest=await(await fetch('./generated/sudachi-small/chunks.json')).json();
   dictionary=new Uint8Array(manifest.bytes);let offset=0;
   for(const chunk of manifest.chunks){const bytes=new Uint8Array(await(await fetch('./generated/sudachi-small/'+chunk.path)).arrayBuffer());
    if(bytes.length!==chunk.bytes)throw Error('Dictionary chunk length');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==chunk.sha256)throw Error('Dictionary chunk integrity');dictionary.set(bytes,offset);offset+=bytes.length;}
   if(offset!==dictionary.length)throw Error('Dictionary assembly');
  }
  const tokenizer=new s.Tokenizer(dictionary);dictionary=null;wasmMemory=()=>exports.memory.buffer.byteLength;
  analyze=text=>separatedSudachiTokens(text,tokenizer.tokenize(text,'C'));dispose=()=>tokenizer.free();
 }else throw Error('Unknown engine');
 return {engine,analyze,dispose,wasmMemory,initMs:performance.now()-t};
}
