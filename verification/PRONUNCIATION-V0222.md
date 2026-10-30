# v0.2.22 validation

Policy: `docs/ROMAJI-PRONUNCIATION.md`.

- Resolve lexical pronunciation and grammatical boundaries before the shared
  renderer chooses double vowels or macrons. No new transliterator/dataset.
- Preserve raw OCR, coordinates, analyzer reading and source offsets. Retain
  tokenizer pronunciation/inflection metadata instead of discarding it.
- Remove the blanket kanji-reading ou/uu/oo fallback from ordinary words and
  ruby. Keep it confined to already validated productive numeric pronunciation.
- Preserve ワ行五段 final う, compound hiatus, particles and te/de+iru. A
  grammatical volitional う after an o-row stem is a long vowel instead.
- Existing m before b/m/p, n’ before vowels/y, and ch gemination are applied
  after resolved members join; spaces/punctuation stop lookahead.
- Keep the existing kana-word repair for とう+きょう and こう+べ. These are
  lexical repairs, distinct from particle grouping.

## Tests

`pronunciation-policy.test.mjs`: 39 declared lexical examples in both styles,
bridge tests for PP regions and single-group Meiki words, metadata preservation,
member-boundary nasals/geminates, particle boundaries, unresolved readings/ruby,
and authoritative numeric pronunciation.

The new real-image browser fixture has 17 required targets. Both actual OCR
modes pass both styles; all targets must be recognized, none may be silently
skipped. Examples include 先生, 映画, 追う, 問う, 目医者, 子牛, 新案,
本屋, 行こう, 飲もう, ねえ and ええ. Four particle boundary phrases are
also required. Toggling styles must preserve the exact OCR snapshot.

The first fixture's isolated ええ was recognized as えス by Meiki. The final
fixture uses the natural phrase ええ、そうです。 without changing model settings,
recognition thresholds or any expected target. This is a display-policy test;
OCR mistakes remain separately visible in its saved raw/effective evidence.
PP's raw fixture still includes misrecognitions; the existing measured-crop
verification recovers the target words. No OCR inference change is claimed.

Local Chromium passed both OCR engines and both styles. On this executor the
full suite has a missing generated Sudachi research module; GitHub Actions
builds the pinned research assets and must pass the unchanged full suite before
publication. The old standalone kana controller harness is not checked out;
its complete golden conversion table is exercised by the existing contracts
suite in both styles. No existing test expectation has been relaxed.

Physical iPhone validation remains separate from Chromium/macOS/Linux WebKit.
The v0.2.21 crop-confidence fallback is retained unchanged.
