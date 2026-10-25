// Node-only local verification bridge. Not part of the browser app.
import{parentPort}from'node:worker_threads';import{readFile}from'node:fs/promises';
globalThis.self=globalThis;globalThis.fetch=async(input,init)=>{const url=String(input);if(url.startsWith('file:'))return new Response(await readFile(new URL(url)),{status:200});throw Error('Local OCR harness blocks network');};
globalThis.postMessage=data=>parentPort.postMessage(data);globalThis.close=()=>parentPort.close();
await import('../../../meikiocr-test/vendor/meikiocr-web/worker.js');parentPort.on('message',data=>globalThis.onmessage({data}));
