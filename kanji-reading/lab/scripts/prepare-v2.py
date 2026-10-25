"""Build pinned research assets locally. Never deploys or edits the first app."""
import subprocess,sys,os,json,hashlib,shutil,zipfile,urllib.request
from pathlib import Path
root=Path.cwd();repo=root.parent.parent;generated=root/'generated';work=generated/'build-work';work.mkdir(parents=True,exist_ok=True)
lock=json.loads((root/'assets-v2.lock.json').read_text())
def run(args,cwd=work,env=None):subprocess.run([str(x)for x in args],cwd=cwd,check=True,env=env)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def fetch(url,path,sha=None):
 if not path.exists() or sha and digest(path)!=sha:run(['curl','-fLsS','--retry','2','--max-time','180',url,'-o',path])
 if sha and digest(path)!=sha:raise ValueError('Integrity: '+str(path))
source=work/'sudachi-wasm'
if not source.exists():run(['git','clone',lock['wrapperRepository'],source])
run(['git','checkout',lock['wrapperCommit']],source);run(['git','submodule','update','--init','--recursive'],source)
cargo=Path(shutil.which('cargo') or Path.home()/'.cargo/bin/cargo');env=dict(os.environ);env['PATH']=str(cargo.parent)+os.pathsep+env.get('PATH','')
run([cargo,'build','--lib','--target','wasm32-unknown-unknown','--release','--locked'],source,env)
cli=work/'wasm-bindgen.tar.gz';fetch(lock['cliArchive']['url'],cli,lock['cliArchive']['sha256']);run(['tar','--no-same-owner','-xzf',cli,'-C',work])
output=generated/'sudachi-small';output.mkdir(exist_ok=True)
run([work/'wasm-bindgen-0.2.114-x86_64-unknown-linux-musl/wasm-bindgen',source/'target/wasm32-unknown-unknown/release/sudachi_wasm.wasm','--out-dir',output,'--target','web'])
wheel=work/'small.whl';fetch(lock['dictionaryWheel']['url'],wheel,lock['dictionaryWheel']['sha256'])
with zipfile.ZipFile(wheel)as z:(output/'system-small.dic').write_bytes(z.read('sudachidict_small/resources/system.dic'))
build_records=[]
for asset in lock['files']:
 p=output/asset['path'];actual=digest(p)
 if not asset['path'].endswith('.wasm') and (p.stat().st_size!=asset['bytes']or actual!=asset['sha256']):raise ValueError('Asset integrity differs: '+str(p))
 build_records.append({'path':asset['path'],'bytes':p.stat().st_size,'sha256':actual,'matchesMeasuredBuild':actual==asset['sha256']})
(output/'build-manifest.json').write_text(json.dumps({'sourceCommit':lock['wrapperCommit'],'rustcExpected':lock['rustc'],'note':'WASM generated from pinned source can contain path-dependent bytes; exact hashes are recorded, not assumed portable. JS and dictionary must match the measured assets.','files':build_records},indent=2)+'\n')
b=(output/'system-small.dic').read_bytes();chunks=[]
for i,start in enumerate(range(0,len(b),8*1024**2)):
 part=b[start:start+8*1024**2];name=f'dictionary-{i:02}.bin';(output/name).write_bytes(part);chunks.append({'path':name,'bytes':len(part),'sha256':hashlib.sha256(part).hexdigest()})
(output/'chunks.json').write_text(json.dumps({'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'chunks':chunks},indent=2)+'\n')
ocr=generated/'ocr-assets';ocr.mkdir(exist_ok=True);models=json.loads((repo/'meikiocr-test/models.lock.json').read_text());manifest={'modelSetId':models['modelSetId'],'onnxruntimeWeb':'1.30.0','models':[],'runtime':[]}
for model in models['models']:
 if model['role']=='recognizer-vertical':continue
 p=ocr/model['file'];fetch(model['url'],p,model['sha256']);manifest['models'].append({key:model[key]for key in ['role','sha256','byteLength']}|{'path':model['file']})
for name in ['ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs']:
 p=repo/'meikiocr-test/node_modules/onnxruntime-web/dist'/name;b=p.read_bytes();(ocr/name).write_bytes(b);manifest['runtime'].append({'path':name,'sha256':hashlib.sha256(b).hexdigest(),'byteLength':len(b)})
(ocr/'manifest.json').write_text(json.dumps(manifest)+'\n');print('Pinned local reading and OCR assets prepared. No deployment.')

fixtures=generated/'fixtures';fixtures.mkdir(exist_ok=True);fetch(lock['font']['url'],fixtures/'NotoSansJP.ttf',lock['font']['sha256'])
