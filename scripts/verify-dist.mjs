import {readFile,stat} from 'node:fs/promises';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex');
const inventory=JSON.parse(await readFile('dist/asset-inventory.json'));let total=0;
for(const f of inventory.files){assert.ok(!f.path.startsWith('/')&&!f.path.split('/').includes('..'));const b=await readFile('dist/'+f.path);assert.equal(b.length,f.bytes,f.path);assert.equal(sha(b),f.sha256,f.path);total+=b.length;}
assert.equal(total,inventory.totalBytes);assert.ok(total<1024**3);
for(const path of ['lab/worker-v2.js','lab/src/engines.mjs','lab/src/adapters.mjs','lab/src/numeric-reading.mjs','lab/generated/romanizer.mjs','lab/vendor/kuromoji/build/kuromoji.js','lab/vendor/kuromoji/dict/tid.dat.gz','fixtures/numeric.png','licenses/NOTICE.kuromoji-IPADIC.md','licenses/UniDic-LICENSE.txt','source/app-source.tar.gz'])assert.ok((await stat('dist/'+path)).size>0,path);
const html=await readFile('dist/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="(\/[^"\s]*)"/g))assert.ok(match[1].startsWith('/kana-romaji-camera-kanji/'),match[1]);
const manifest=JSON.parse(await readFile('dist/ocr-assets/manifest.json'));assert.equal(manifest.models.length,2);assert.equal(manifest.runtime.length,2);
for(const e of [...manifest.models,...manifest.runtime]){const b=await readFile('dist/ocr-assets/'+e.path);assert.equal(b.length,e.byteLength);assert.equal(sha(b),e.sha256);}
console.log(JSON.stringify({verifiedFiles:inventory.files.length,totalBytes:total,models:manifest.models.length,runtime:manifest.runtime.length,base:'/kana-romaji-camera-kanji/'}));
