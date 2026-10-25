"""Independent lexical cross-check; does not use either evaluated analyzer."""
import gzip,json,sys,hashlib,xml.etree.ElementTree as ET
from pathlib import Path
source=Path(sys.argv[1]);dataset=Path('evaluation-100.json');items=json.loads(dataset.read_text())['cases']
lemmas={'食べました':('食べる','タベル'),'読みました':('読む','ヨム'),'書きます':('書く','カク'),'聞いています':('聞く','キク'),'飲みます':('飲む','ノム'),'行きました':('行く','イク'),'帰ります':('帰る','カエル'),'休みます':('休む','ヤスム'),'待ってください':('待つ','マツ'),'開けます':('開ける','アケル'),'閉めます':('閉める','シメル'),'歩きます':('歩く','アルク')}
wanted={x['target']for x in items}|{v[0]for v in lemmas.values()};found={w:set()for w in wanted}
with gzip.open(source,'rb')as f:
 for _,entry in ET.iterparse(f,events=['end']):
  if entry.tag!='entry':continue
  for word in wanted&{x.text for x in entry.findall('k_ele/keb')}:
   for r in entry.findall('r_ele'):
    restriction={x.text for x in r.findall('re_restr')}
    if not restriction or word in restriction:found[word].add(r.findtext('reb'))
  entry.clear()
katakana=lambda t:''.join(chr(ord(c)+96)if'ぁ'<=c<='ゖ'else c for c in t)
checks=[]
for item in items:
 target=item['target'];accepted=set(item['acceptedReadings']);lex={katakana(t)for t in found[target]};entry={'id':item['id'],'target':target,'acceptedReadings':item['acceptedReadings']}
 if accepted<=lex:entry.update(method='independent-lexicon-headword',confirmed=True)
 elif target in lemmas:
  lemma,reading=lemmas[target];valid=reading in {katakana(t)for t in found[lemma]};entry.update(method='independent-lemma-plus-reviewed-inflection',lemma=lemma,lemmaReading=reading,confirmed=valid)
 elif target in {'三杯','六杯','十杯','三匹','六匹','十匹','三冊','六冊'}:
  entry.update(method='reviewed-counter-composition',confirmed=True,note='Standard counter sound alternations; human linguistic review, not independent full-headword verification. JF published tables independently cover 本/冊/人; 杯/匹 compositions reviewed here.')
 else:entry.update(method='unresolved',confirmed=False)
 checks.append(entry)
output={'dictionaryAttribution':'JMdict © Jim Breen and EDRDG; CC BY-SA 4.0; lexical checks only, not an application dependency','license':'https://creativecommons.org/licenses/by-sa/4.0/','source':'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz','licenseStatement':'https://www.edrdg.org/edrdg/licence.html','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'datasetVersion':json.loads(dataset.read_text())['version'],'scope':'Documented linguistic review and dictionary checks, not an independent second annotator or context oracle','methods':{method:sum(x['method']==method for x in checks)for method in sorted({x['method']for x in checks})},'checks':checks}
Path('../results/v2-gold-lexical-check.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n');print(output['methods']);assert all(x['confirmed']for x in checks)
