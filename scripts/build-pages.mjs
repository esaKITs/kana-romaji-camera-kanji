import {readFile,writeFile,mkdir,cp,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from '../meikiocr-test/node_modules/vite/dist/node/index.js';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(args,options={}){const r=spawnSync(args[0],args.slice(1),{stdio:'inherit',...options});if(r.error)throw r.error;if(r.status!==0)throw Error('Command failed: '+args.join(' '));}
run(['node','scripts/generate-openjtalk-counters.mjs','--check']);
process.chdir('kanji-reading/lab');try{await import('../kanji-reading/lab/scripts/generate-romanizer.mjs');}finally{process.chdir(root);}
await build({configFile:'kanji-reading/camera-prototype/vite.config.mjs'});
const out='dist';
const copy=async(a,b)=>{await mkdir(b.slice(0,b.lastIndexOf('/')),{recursive:true});await cp(a,b,{recursive:true});};
await copy('kanji-reading/lab/worker-v2.js',out+'/lab/worker-v2.js');
await copy('kanji-reading/lab/src',out+'/lab/src');
await copy('kanji-reading/lab/generated/romanizer.mjs',out+'/lab/generated/romanizer.mjs');
for(const dir of ['build','dict'])await copy('kanji-reading/lab/node_modules/kuromoji/'+dir,out+'/lab/vendor/kuromoji/'+dir);
await copy('kanji-reading/lab/generated/fixtures',out+'/fixtures');
// Only generated PNG samples are served; the build font is not needed at runtime.
const {unlink}=await import('node:fs/promises');await unlink(out+'/fixtures/NotoSansJP.ttf');
await copy('meikiocr-test/public/apple-touch-icon.png',out+'/apple-touch-icon.png');
await copy('meikiocr-test/public/licenses',out+'/licenses');
for(const [file,name]of [['LICENSE-2.0.txt','LICENSE.kuromoji-Apache-2.0.txt'],['NOTICE.md','NOTICE.kuromoji-IPADIC.md']])await copy('kanji-reading/lab/node_modules/kuromoji/'+file,out+'/licenses/'+name);
await copy('pages/NOTICE.onnxruntime.txt',out+'/licenses/NOTICE.onnxruntime.txt');
await copy('pages/NOTICE.html',out+'/licenses/NOTICE.html');
// PDF assets are same-origin; uploaded documents never need a CDN or upload.
for(const dir of ['cmaps','standard_fonts','wasm','iccs'])await copy('meikiocr-test/node_modules/pdfjs-dist/'+dir,out+'/pdf-assets/'+dir);
for(const [file,name]of [['pdfjs-dist/LICENSE','LICENSE.pdfjs-Apache-2.0.txt'],['pdf-lib/LICENSE.md','LICENSE.pdf-lib-MIT.txt'],['@pdf-lib/standard-fonts/LICENSE.md','LICENSE.pdf-standard-fonts-MIT.txt'],['@pdf-lib/upng/LICENSE','LICENSE.pdf-upng-MIT.txt'],['pako/LICENSE','LICENSE.pako.txt'],['tslib/LICENSE.txt','LICENSE.tslib.txt']])await copy('meikiocr-test/node_modules/'+file,out+'/licenses/'+name);
await copy('kanji-reading/vendor/open-jtalk/COPYING',out+'/licenses/LICENSE.open-jtalk-BSD.txt');
// Both entry points use the exact same inference module.
await copy('pages/ppocr-experiment/index.html',out+'/ppocr-experiment/index.html');
await copy('kanji-reading/still-prototype/ppocr-core.mjs',out+'/ppocr-core.mjs');
await copy('kanji-reading/still-prototype/ppocr-single.mjs',out+'/ppocr-single.mjs');
await copy('SOURCE.md',out+'/SOURCE.md');
await mkdir(out+'/ocr-assets',{recursive:true});
const lock=JSON.parse(await readFile('meikiocr-test/models.lock.json')),manifest={modelSetId:lock.modelSetId,onnxruntimeWeb:'1.30.0',models:[],runtime:[]};
for(const model of lock.models.filter(m=>m.role!=='recognizer-vertical')){
 const bytes=await readFile('.cache/pages-assets/'+model.file);
 if(bytes.length!==model.byteLength||sha(bytes)!==model.sha256)throw Error('Model integrity: '+model.file);
 await writeFile(out+'/ocr-assets/'+model.file,bytes);manifest.models.push({role:model.role,path:model.file,byteLength:bytes.length,sha256:sha(bytes)});
}
const runtimeLock=JSON.parse(await readFile('pages/runtime.lock.json'));
for(const entry of runtimeLock.files){
 const bytes=await readFile('meikiocr-test/node_modules/onnxruntime-web/dist/'+entry.path);
 if(bytes.length!==entry.byteLength||sha(bytes)!==entry.sha256)throw Error('Runtime integrity: '+entry.path);
 await writeFile(out+'/ocr-assets/'+entry.path,bytes);manifest.runtime.push(entry);
}
await writeFile(out+'/ocr-assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const upstream=JSON.parse(await readFile('meikiocr-test/assets.lock.json')).find(a=>a.path.includes('/source/'));
const sourceBytes=await readFile('.cache/pages-assets/'+upstream.path.split('/').at(-1));
if(sha(sourceBytes)!==upstream.sha256)throw Error('Upstream source integrity');
await copy('.cache/pages-assets/'+upstream.path.split('/').at(-1),out+'/source/'+upstream.path.split('/').at(-1));
// The complete checked-out source, build scripts and exact locks accompany each build.
// Exclude generated binaries, dependencies, Git metadata and user-local test outputs.
run(['tar','--exclude=./dist','--exclude=./.git','--exclude=./.cache','--exclude=./test-results','--exclude=*/node_modules','--exclude=./kanji-reading/lab/generated','-czf','dist/source/app-source.tar.gz','.']);
await writeFile(out+'/.nojekyll','');
let commit='local-uncommitted';const git=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});if(git.status===0)commit=git.stdout.trim();
await writeFile(out+'/deployment.json',JSON.stringify({commit,base:'/kana-romaji-camera-kanji/',engine:'MeikiOCR Web',readingEngine:'kuromoji',upstreamPr:26})+'\n');
const inventory=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())await walk(path);else if(e.isFile()){const bytes=await readFile(path);inventory.push({path:path.slice(out.length+1),bytes:bytes.length,sha256:sha(bytes)});}else throw Error('Unsupported build entry '+path);}}
await walk(out);const total=inventory.reduce((n,f)=>n+f.bytes,0);if(total>1024**3)throw Error('Pages output exceeds 1 GiB');
await writeFile(out+'/asset-inventory.json',JSON.stringify({totalBytes:total,files:inventory},null,2)+'\n');
console.log('Prepared Pages output:',inventory.length,'files,',total,'bytes. No deployment.');
