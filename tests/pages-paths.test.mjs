import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import{assetUrl}from'../kanji-reading/camera-prototype/asset-url.mjs';
test('runtime assets stay under the independent Pages path',()=>{globalThis.location={origin:'https://esakits.github.io'};for(const p of ['ocr-assets/manifest.json','lab/worker-v2.js','fixtures/numeric.png'])assert.equal(assetUrl(p),'https://esakits.github.io/kana-romaji-camera-kanji/'+p);delete globalThis.location;});
