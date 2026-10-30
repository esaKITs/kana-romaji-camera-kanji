"""Prepare the current Kuromoji camera's assets; does not publish anything."""
import hashlib, json, pathlib, shutil, subprocess, urllib.request
root = pathlib.Path(__file__).resolve().parents[1]
cache = root / '.cache' / 'pages-assets'
cache.mkdir(parents=True, exist_ok=True)
def fetch(url, name, sha, size=None):
    path = cache / name
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != sha:
        request = urllib.request.Request(url, headers={'User-Agent': 'kana-romaji-camera-kanji-build'})
        with urllib.request.urlopen(request, timeout=120) as response:
            path.write_bytes(response.read())
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != sha or size is not None and len(data) != size:
        raise ValueError('Asset integrity: ' + name)
    return path
models = json.loads((root/'meikiocr-test/models.lock.json').read_text())
for model in models['models']:
    if model['role'] != 'recognizer-vertical':
        fetch(model['url'], model['file'], model['sha256'], model['byteLength'])
source = next(a for a in json.loads((root/'meikiocr-test/assets.lock.json').read_text()) if '/source/' in a['path'])
fetch(source['url'], pathlib.Path(source['path']).name, source['sha256'], source['byteLength'])
lock = json.loads((root/'kanji-reading/lab/assets-v2.lock.json').read_text())
font = fetch(lock['font']['url'], 'NotoSansJP.ttf', lock['font']['sha256'])
fixtures = root/'kanji-reading/lab/generated/fixtures'
fixtures.mkdir(parents=True, exist_ok=True)
shutil.copyfile(font, fixtures/'NotoSansJP.ttf')
subprocess.run(['node', 'scripts/make-numeric-fixture.cjs'], cwd=root/'kanji-reading/lab', check=True)
subprocess.run(['node', 'scripts/make-pronunciation-fixture.cjs'], cwd=root/'kanji-reading/lab', check=True)
subprocess.run(['node', 'scripts/make-fixtures.cjs'], cwd=root/'kanji-reading/lab', check=True)
subprocess.run(['node', 'scripts/make-pdf-fixture.mjs'], cwd=root/'kanji-reading/lab', check=True)
print('Verified pinned OCR models, source, font and generated samples; no deployment.')
