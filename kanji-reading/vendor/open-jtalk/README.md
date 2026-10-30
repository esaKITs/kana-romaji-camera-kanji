# Open JTalk counter tables (1.11)

The original `njd_set_digit.c`, UTF-8 rule header and `COPYING` are archived
unchanged from https://github.com/r9y9/open_jtalk/tree/1.11/src.
`provenance.json` records their Git blob identifiers. The header's SHA-256 is
`b176ec4d0e28ae06ce927756a371dc39c7466be429e48bc39e8d07944b63f9c9`.

`scripts/generate-openjtalk-counters.mjs` extracts all 50 tables verbatim and
obtains counter base readings from the application's existing pinned Kuromoji
IPADIC. Unchanged counters such as 枚/台/羽 come from that same dictionary;
they need no Open JTalk sound-change class. 558 dictionary-verified counter
surfaces are available to the browser adapter. This is vocabulary coverage,
not a claim of 558 counters having been exhaustively pronunciation-tested.

`lab/src/openjtalk-counters.mjs` adapts numeric terminal-node replacements,
voicing/semivoicing and native 一/二 classes to the existing JS number reader.
Native 一/二 selection precedes Sino-Japanese phonology: 一箱 becomes
ヒトハコ, not ヒトパコ. This is an explicit adapter correction, not a claim
of byte-identical C execution. The full speech engine, NAIST dictionary,
MeCab and voice assets are **not** bundled by this addition.

The existing app retains calendar context, age/person exceptions, token and
name guards, source offsets, validated whole-span placement and ruby priority.
The supported integer scope remains 1–9999; decimals, signs, ranges, ambiguous
identifiers and insufficiently resolved lexical contexts are not guessed.
Long-vowel/nasal romanization policy is unchanged. In particular, inherited
nasal assimilation still renders サンボン as `sambon` and ヨンマイ as `yommai`.

BSD-3-Clause notices are retained in the original files, generated module and
public `licenses/LICENSE.open-jtalk-BSD.txt`. Existing Kuromoji/IPADIC notices
remain in the public license page. Regenerate with:

```
node scripts/generate-openjtalk-counters.mjs
node scripts/generate-openjtalk-counters.mjs --check
```
