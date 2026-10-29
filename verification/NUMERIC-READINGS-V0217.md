# v0.2.17 — stage 1: number/counter diagnosis and pronunciation

## Confirmed causes

The original camera photograph is unavailable: IMG_2235 is a screenshot with
romaji already overlaid at 55% source visibility. Its historical raw OCR cannot
be reconstructed. The exact visible failure is independently reproducible by
feeding `20歳未満の者の喫煙は、法律で禁じられています。` into the actual Kuromoji
and camera reading bridge. v0.2.16 emits `20 歳 miman ...` and withholds 歳 as
`number-or-date`. The numeric pattern did not include 歳.

There is also a distinct display bug: existing rules already resolve 3本 as
サンボン and 3時 as サンジ, but the camera considers Arabic digits outside the
conversion targets. It therefore paints 3bon / 3ji, and does not paint
non-segmentable 1人, 2人 or 20日間 at all.

## Changes

* Extend the existing guarded numeric rules to 歳. Twenty is ハタチ; productive
  forms include イッサイ, ハッサイ, ジュッサイ and ニジュウイッサイ. Range, decimal,
  prefix, leading-zero and unvalidated forms remain guarded.
* Convert the complete validated number/counter pronunciation in all three modes,
  in both camera OCR engines. Bare digits remain untouched. Use the existing
  measured region (PP) or exact glyph-span union (Meiki); create no new guessed
  character boxes.
* Preserve existing romaji spelling, including nasal assimilation: サンボン is
  `sambon`, not a new spelling policy. Examples: 20歳→hatachi, 3時→sanji,
  1人→hitori, 2人→futari, 20日間→hatsukakan.
* Add browser-local `stillLab.diagnoseReading(text)` returning original analyzer
  tokens, numeric decisions and corrected tokens. It does not upload or persist
  recognized text. Regular analysis requests do not include the extra raw tokens.
* Record PDF import and image/PDF download as stage 5 in DEVELOPMENT-STAGES.md;
  neither feature is represented as implemented by this release.

## Evidence and tests

`numeric-readings-v0217.json` records actual before/after analyzer and camera
reading results. Unit tests cover both styles and all modes, age contractions,
uncertain inputs, exact measured spans and immutable OCR snapshots. Existing
numeric tests are updated to assert the deliberately changed whole-pronunciation
policy, including the measured bounds; protections are not removed.

The controlled image is separate from existing fixtures. Browser tests run both
actual OCR engines, compare PP raw output with the archived canonical experiment,
then check every resolved target against labels on the same source line. They
also exercise modes, macrons and the real reading worker diagnostics. Test
artifacts distinguish `ocrMissingCompounds` from `readingFailures` and omissions.

Important limitation: the artificial thin-font image has OCR errors, including
PP 20歳→2200歳, 1人→入 and 歳→蔵, and Meiki 21歳→2歳. These are not silently fixed
or counted as successful recognition. The PP errors also occur in the original
experiment, with exactly equal raw regions. For correctly recognized number/counter
strings the reading/display regression passes. Unit tests separately exercise
all intended strings, including ones the image OCR gets wrong.

The original Practice A input still has identical canonical raw 66 / classified
63 regions, plus the same 3 supplemental し. All 44 labels fit, all 8 owned ruby
are covered, and 3時に now paints sanji ni. The nine original function bodies,
models, dictionaries, thresholds, 960px/150px tiling and image resolution are
unchanged. Existing Meiki sample/textbook browser regressions are also retained.

Local full-suite execution: 129 tests pass; the unrelated Sudachi te-iru test
cannot run without the pruned generated research assets. The existing Actions
workflow builds the pinned research assets and runs the complete 130-test suite;
release completion requires its success, not excluding that test.
