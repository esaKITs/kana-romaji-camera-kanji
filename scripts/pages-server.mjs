import http from'node:http';import{readFile}from'node:fs/promises';import path from'node:path';
export const base='/kana-romaji-camera-kanji/';
export function createPagesServer(){const root=path.resolve('dist');const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.css':'text/css','.md':'text/plain'};
 return http.createServer(async(req,res)=>{try{if(req.method!=='GET')throw Error('method');const url=new URL(req.url,'http://local');if(!url.pathname.startsWith(base))throw Error('prefix');const file=path.resolve(root,decodeURIComponent(url.pathname.slice(base.length)||'index.html'));if(!file.startsWith(root+path.sep))throw Error('path');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
}
