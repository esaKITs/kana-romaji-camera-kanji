# Phase 2 continuation / minimal Still research harness

This is development-only work. It never deploys or modifies the first application. The camera product UI and analyzer selection remain unapproved. The Still harness is an image-input diagnostic page, not an adopted UI design.

## Reproduce on Linux

Prerequisites: Node/npm, Python 3, git, curl, tar, Rust 1.99.1 with the wasm32-unknown-unknown target. Install the Rust target explicitly with `rustup target add wasm32-unknown-unknown`. Browser tests need Playwright and a Chromium binary; these are developer tools, not application dependencies.

From the repository root:

```sh
npm ci --ignore-scripts --prefix meikiocr-test
npm ci --ignore-scripts --prefix kanji-reading/lab
cd kanji-reading/lab
npm run generate
python3 scripts/prepare-v2.py
node scripts/make-fixtures.cjs
npm test
npm run evaluate:v2
npm run build:still
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium node scripts/browser-evaluate-v2.mjs
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium node scripts/still-browser-test.mjs
```

`prepare-v2.py` fetches a pinned wrapper and submodule, builds a dictionary-separated WASM module, verifies a fixed dictionary wheel, verifies OCR model checksums, and creates dictionary chunks for local serving. It downloads compiler tooling/inputs for the developer setup only. It does not upload images or OCR results. Exact WASM bytes can include build-path-dependent data; actual hashes are recorded in the generated build manifest. JS and dictionary bytes must match their checksums. Large generated assets and binaries are excluded from git.

- Wrapper: f3liz-casa/sudachi-wasm `20ccaedee7459d2c5be9366efabfe407ec48ca5e`.
- Rust engine submodule: `7003268361c654ff94277f9912172b4609168a8a`.
- Dictionary: SudachiDict-small 20250129. The newest 20261015 dictionary failed the header compatibility check with this wrapper. The npm @f3liz/sudachi-wasm 0.1.7 package expects another `.xdic` format and is not the measured engine. It is not an application dependency.
- The former `sudachi@0.1.5` dependency remains solely to reproduce Phase 1/2's historical benchmark, not to run the new Still prototype. The new comparison explicitly uses `sudachi-small`.
- Dictionary chunks are 8 MiB with per-chunk hashes. The raw dictionary exceeds GitHub's per-file size limit, so it must not be committed/uploaded as a single production asset. Chunking solves transport size only; it does not remove runtime memory costs.

To inspect the local Still diagnostic page, run `node --input-type=module -e "import {server} from './scripts/browser-server-v2.mjs'; server.listen(8765,'127.0.0.1')"`, then open http://127.0.0.1:8765. Automated tests start and stop their own loopback server.

## Evaluation

- `original-30-reviewed.json`: normal evaluation excludes original No.17 and 30; ambiguous ordinary probes accept plausible alternate readings. This raises scores without demonstrating semantic disambiguation, so it is reported separately.
- `evaluation-100.json`: 100 authored ordinary probes, including 24 counters and 10 date/time phrases. `special-cases.json`: separate identity-dependent name / dictionary-coverage probes.
- Gold validation: 80 direct JMdict headword checks, 12 independent lemma checks plus reviewed inflection, 8 reviewed counter compositions. This is not an independent second annotator or a representative random corpus.
- `scripts/check-gold.py /path/to/JMdict_e.gz` reproduces lexical validation. The source checksum is retained in results; get the current dictionary from https://www.edrdg.org/pub/Nihongo/JMdict_e.gz and note its version when rerunning. Dataset/validation attribution and license: `../licenses/EVALUATION-DATA-NOTICE.md`.
- Raw accuracy = correct / 100. Coverage = emitted candidates / 100. Error rate = incorrect candidates / emitted candidates. Safe experimental coverage uses the unchanged conservative review gate, separately from raw analyzer output. No fixes trained on this set are injected into either raw engine.
- Node RSS, Chromium Worker JS heap/backing storage, and WASM linear memory are different measurements; do not add them into an invented total or interpret them as Safari memory. Host `/proc` memory lookup was unavailable and is recorded as null.

## Still scope

Actual MeikiOCR inference on generated horizontal printed-text PNGs → positional ruby matching → independent enlarged-crop OCR recheck → common reading engine → existing romanizer → canvas labels. Three fixed modes are exercised on the OCR snapshots. Whole-ruby spans override analyzer token boundaries; uncertain candidate ruby lines do not get independent duplicate labels. Simple okurigana splits use exact OCR glyph boxes.

The renderer is for white test pages only. It can use horizontal whitespace, then bounded horizontal compression, and withholds labels that would collide or be too narrow. General line allocation, adaptive palette reuse, partial/interleaved ruby, sloped images, physical prints/phones, Live integration, long sessions and recovery remain unvalidated. Raw OCR can misrecognize 生 as 牛; ruby priority does not prove correct character recognition.

## Numeric continuation

See [the numeric report](../NUMERIC-READING-REPORT.md). Run `npm run evaluate:numeric`, then `node scripts/make-numeric-fixture.cjs` and the browser/Still scripts `browser-numeric.mjs` / `still-numeric-test.mjs`. Numeric reading is opt-in per Worker message and enabled in the Still research harness. Original raw analyzers and historical evaluation remain reproducible.
