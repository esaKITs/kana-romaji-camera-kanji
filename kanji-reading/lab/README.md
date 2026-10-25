> Current evaluation and Still prototype: [V2 instructions](V2-README.md). The original lab and benchmark below are historical Phase 1/2 tools.

# Local reading comparison lab

A research harness, not the proposed camera UI. No changes to first-version source, workflow or spelling rules. Both analyzers execute locally; only local static files are fetched by browser workers.

```sh
cd kanji-reading/lab
npm ci --ignore-scripts
npm run generate
npm test
npm run benchmark
npm run serve
# Open http://127.0.0.1:8765
```

- `kuromoji@0.1.2` with bundled IPADIC; `sudachi@0.1.5` WASM with embedded dictionary. These are exact experimental artifacts, not endorsements of all versions of either family.
- Sudachi's `dictionary_form`/`reading_form` schema is inconsistent with the standard API. A package-specific initialization probe guards the adapter.
- `scripts/generate-romanizer.mjs` extracts existing tables, pronunciation data and functions without changing the app. Generated files are excluded from git.
- `cases.json`: 30 hand-authored probes, not a representative corpus. Expected reading is an intended interpretation, not necessarily the sole valid reading. In particular 日本語/ニッポンゴ and 明日/アス are valid variants; the strict score counts them as canonical mismatches.
- Raw candidates are shown for diagnosis, never claimed as verified. `src/policy.mjs` provides review reasons for a limited set, not comprehensive ambiguity detection. No confidence percentage is invented.
- `splitOkurigana` handles a contiguous Han prefix and kana suffix only, with a matching reading suffix. Interior alternating scripts defer. This is a string-level probe, not validated image alignment.
- UTF-16 offsets must later map to actual OCR glyph boxes; no equal-width synthesized boxes.
- Browser memory and combined OCR memory are not established by Node RSS measurements.

Optional automated Chromium test (Playwright needed in the developer environment; no production dependency):

```sh
node scripts/browser-test.mjs
# Or CHROMIUM_EXECUTABLE=/absolute/path/to/chromium node scripts/browser-test.mjs
```

The test starts a loopback static server, runs both browser Workers against all cases, checks UI analyze/release, and rejects external or non-GET requests. It does not test Safari, physical phones, image OCR, ruby geometry, Live, or camera overlays. Standard Playwright browser downloads failed in the current environment; a temporary external developer runtime provided Chromium. That runtime is not distributed with the app.

Serve through localhost (secure context), not file://. First initialization downloads static analyzer assets from the local host. Offline inference after assets are present is distinct from installing/caching an offline app. No Service Worker or offline reload guarantee is included. The server accepts GET only. Do not expose node_modules as a production deployment without a distribution manifest and full notices.
