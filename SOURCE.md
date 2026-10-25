# Kana漢 → Romaji Camera: source and rebuild

Independent second-edition repository: https://github.com/esaKITs/kana-romaji-camera-kanji

Derived from PR #26 in https://github.com/esaKITs/kana-romaji-camera, head e3ae1bf64d9f341f1be69ca26bc3df2df135a47e (tree bdb11a0271976d831b212130fe4287e6010695bb). The original first-edition repository and Pages site are not modified by this project. `meikiocr-test/` contains fixed copies of shared dependencies, pronunciation rules and generator inputs, not a second first-edition deployment.

This combined distribution is GPL-3.0-only. Original application files retain their MIT license. See `licenses/NOTICE.html` for models, runtime, Kuromoji/IPADIC and UniDic notices.

Download `source/app-source.tar.gz` relative to this page for the exact application source, tests, scripts and dependency/model locks. The pinned MeikiOCR upstream source is served under `source/meikiocr-web-0431493cfc59534bdf9e48be95a9e43c21a206be.tar.gz`.

Rebuild with Node 22.12+ or 24, Python 3 and tar: `npm run deps`, `npm run prepare:assets`, `npm run build`, `npm test`, `npm run verify:dist`. No paid APIs or keys are needed. The default camera uses Kuromoji; optional Sudachi research tests additionally need the generated assets described in `kanji-reading/lab/assets-v2.lock.json` and its preparation script.

Serve `dist/` at `/kana-romaji-camera-kanji/` over HTTPS (localhost is sufficient for development). Models, WASM and dictionaries are downloaded during the build and served with the static site. Images and recognized text are processed in browser memory and are not uploaded. Preferences are stored locally. Mobile camera, OCR accuracy and memory limitations still require real-device testing.
