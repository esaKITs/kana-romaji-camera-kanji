"""Build the existing pinned Sudachi comparison assets; never used by camera build."""
import pathlib, os, json, hashlib, urllib.request, subprocess, tarfile, zipfile, shutil
root = pathlib.Path(__file__).resolve().parents[1]
lock = json.loads((root/'kanji-reading/lab/assets-v2.lock.json').read_text())
cache = root/'.cache'; cache.mkdir(exist_ok=True)
source = cache/'sudachi-wasm'
def run(args, cwd=root, env=None):
    subprocess.run([str(a) for a in args], cwd=cwd, env=env, check=True)
def fetch(spec, name):
    path=cache/name
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=spec['sha256']:
        with urllib.request.urlopen(spec['url'],timeout=180) as r:path.write_bytes(r.read())
    if hashlib.sha256(path.read_bytes()).hexdigest()!=spec['sha256']:raise ValueError('Integrity: '+name)
    return path
if not source.exists():run(['git','clone',lock['wrapperRepository'],source])
run(['git','checkout',lock['wrapperCommit']],source)
run(['git','submodule','update','--init','--recursive'],source)
env=os.environ.copy()
cargo=shutil.which('cargo')
if not cargo:
    cargo=str(cache/'cargo/bin/cargo');env['CARGO_HOME']=str(cache/'cargo');env['RUSTUP_HOME']=str(cache/'rustup')
env['PATH']=str(pathlib.Path(cargo).parent)+os.pathsep+env.get('PATH','')
env['CARGO_TARGET_DIR']=str(cache/'research-target')
version=subprocess.check_output([str(pathlib.Path(cargo).parent/'rustc'),'--version'],env=env,text=True).strip()
if not version.startswith('rustc '+lock['rustc']+' '):raise ValueError('Use pinned rustc '+lock['rustc']+'; got '+version)
run([cargo,'build','--lib','--target','wasm32-unknown-unknown','--release','--locked'],source,env)
cli=fetch(lock['cliArchive'],'wasm-bindgen.tar.gz')
with tarfile.open(cli) as t:t.extractall(cache,filter='data')
output=root/'kanji-reading/lab/generated/sudachi-small';output.mkdir(parents=True,exist_ok=True)
run([cache/'wasm-bindgen-0.2.114-x86_64-unknown-linux-musl/wasm-bindgen',cache/'research-target/wasm32-unknown-unknown/release/sudachi_wasm.wasm','--out-dir',output,'--target','web'])
wheel=fetch(lock['dictionaryWheel'],'sudachidict-small.whl')
with zipfile.ZipFile(wheel)as z:(output/'system-small.dic').write_bytes(z.read('sudachidict_small/resources/system.dic'))
files=[]
for entry in lock['files']:
    data=(output/entry['path']).read_bytes();digest=hashlib.sha256(data).hexdigest()
    if not entry['path'].endswith('.wasm') and (digest!=entry['sha256'] or len(data)!=entry['bytes']):raise ValueError('Generated asset differs: '+entry['path'])
    files.append({'path':entry['path'],'bytes':len(data),'sha256':digest,'matchesMeasuredBuild':digest==entry['sha256']})
(output/'build-manifest.json').write_text(json.dumps({'sourceCommit':lock['wrapperCommit'],'rustc':version,'files':files},indent=2)+'\n')
print('Existing Sudachi comparison assets prepared; current Kuromoji camera is unchanged.')
