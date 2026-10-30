# Pronunciation-based romaji policy (v0.2.22)

The camera retains OCR source text, measured regions, analyzer readings and
source offsets. This policy changes only the display pronunciation. Both OCR
engines, verified ruby and both vowel styles use the same display path.
It targets a standard common-Japanese reading, not the speech of a particular
speaker. Accent, devoicing and all phonetic detail are outside this policy.

| Long vowel | Double (default) | Macron |
|---|---|---|
| a | aa | ā |
| i | ii | ī |
| u | uu | ū |
| e | ee | ē |
| o | oo | ō |

## Pronunciation before spelling

1. Preserve surface-specific hiatus decisions: 毛糸 keito, 手入れ teire,
   目医者 meisha, 子牛 koushi, 小歌 kouta, 小梅 koume. 姪 remains mei
   conservatively; it is not evidence that every native word must keep ei.
2. Retain the existing tokenizer's pronunciation and inflection fields. Its
   explicit ー (e.g. ネーサン, ネー) is used as pronunciation, alongside the
   existing licensed UniDic-derived pronunciation lexicon. Reading-only lookup
   is insufficient for homophones; surface/morphology take precedence.
3. A ワ行五段 verb ending in う preserves that final vowel: 追う ou, 問う tou,
   雇う yatou, 背負う seou (the dictionary selects this reading; shou is not
   forced). The volitional auxiliary う after an o-row stem instead yields
   ikoo/ikō, nomoo/nomō; だろう yields daroo/darō.
4. Resolve lexical members before joining for display. 子+牛 must not become
   kōshi. te/de+iru remains teiru/deiru, including teimasu/deimasu.
5. A grammatical particle defines its own vowel domain, with visible spaces:
   岩手へ iwate e; 井戸を ido o; がある ga aru; はある wa aru. Do not turn
   these into iwatē, idō, gāru or wāru. The existing reviewed kana-word repair
   (e.g. とう+きょう) is lexical, not a grammatical particle boundary.
6. Unknown/unresolved ei, ou or ee sequences are preserved; no global Latin
   repeated-vowel regex or generic kanji-reading ou replacement is used.
7. Numeric+counter tokens have already passed the productive number rules;
   retain that pronunciation and ignore stale lexical pronunciation metadata.

Examples: 先生 sensee/sensē; 映画 eega/ēga; 経済 keezai/kēzai;
衛生 eesee/ēsē; お姉さん oneesan/onēsan; ねえ nee/nē;
東京 tookyoo/tōkyō; 京都 kyooto/kyōto; コーヒー koohii/kōhī.

## Nasals and geminates

The established renderer is shared, rather than introducing another transliterator:

- ん becomes m before b/m/p: shimbun, shimmai, sampo, sambon.
- Before a vowel or y within a word use n’ (U+2019): shin’an, san’in, hon’ya.
- Elsewhere and at word ends use n: denwa, hon.
- Spaces and punctuation stop lookahead: hon o, san po, n、ba.
- Resolved lexical members are joined before nasal/geminate rendering, so a
  compound boundary does not lose assimilation or an apostrophe.
- っ doubles the following consonant; before ch it yields t: kippu, matcha.

The apostrophe shape is retained from earlier releases, not silently changed.
The aa↔ā toggle changes only the rendering of already resolved long vowels.
It does not rerun OCR or turn a protected vowel sequence into a long vowel.

## Scope and licensing

No new dictionary dependency is downloaded. Existing Kuromoji/IPADIC metadata
and the already bundled modified-BSD UniDic-derived pronunciation data are used;
existing license notices remain distributed. The original kana-only controller's
default behavior and golden outputs are preserved; an explicit rendering entry
accepts resolved pronunciation for this edition.

Proper-name/ambiguous-reading withholding remains a separate policy. Thus the
formatter's 岩手へ reading test does not promise that a camera proper-name gate
will display that kanji. Kana いわてへ exercises the full camera label path.
Recognition errors such as 二十→士 remain separate from this display policy.
