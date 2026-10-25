import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';
const root=process.cwd(),dist=path.join(root,'generated/still-dist');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
export const server=http.createServer(async(req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 try{
  const url=decodeURIComponent(new URL(req.url,'http://local').pathname);let file;
  if(url.startsWith('/lab/'))file=path.resolve(root,'.'+url.slice(4));
  else if(url.startsWith('/ocr-assets/'))file=path.resolve(root,'generated/ocr-assets',url.slice(12));
  else if(url.startsWith('/fixtures/'))file=path.resolve(root,'generated/fixtures',url.slice(10));
  else file=path.resolve(dist,'.'+(url==='/'?'/index.html':url));
  if(!file.startsWith(root+path.sep))throw Error('Path');
  const b=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);
 }catch{res.writeHead(404);res.end('Not found');}
});
