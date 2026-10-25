import assert from 'node:assert/strict';
import {mergeRecovery} from '../kanji-reading/still-prototype/recovery.mjs';

// A regional reread must not erase an adjacent, already-confident word.
// Detector proposal covers part of the confident word, but the reread box
// spans only a fraction of that word.
const primary={lines:[{text:'この',box:[10,10,60,30],glyphs:[{text:'こ',confidence:.96},{text:'の',confidence:.96}]}]};
const recovered={lines:[{text:'か',box:[45,10,65,30],glyphs:[{text:'か',confidence:.99}]}]};
const regions=[{box:[40,5,70,35],originalBox:[45,10,65,30]}];
const result=mergeRecovery(primary,recovered,regions);
assert.deepEqual(result.snapshot.lines.map(l=>l.text),['この']);
assert.equal(result.decisions[0].reason,'would-erase-confident-neighbor');

// A reread of substantially the same region may replace an uncertain line.
const uncertain={lines:[{text:'しい',box:[10,10,60,30],glyphs:[{text:'し',confidence:.5},{text:'い',confidence:.6}]}]};
const corrected={lines:[{text:'いい',box:[10,10,60,30],glyphs:[{text:'い',confidence:.96},{text:'い',confidence:.95}]}]};
const replacement=mergeRecovery(uncertain,corrected,[{box:[8,8,62,32],originalBox:[10,10,60,30]}]);
assert.deepEqual(replacement.snapshot.lines.map(l=>l.text),['いい']);
assert.equal(replacement.decisions[0].accepted,true);
console.log('OCR recovery neighbor-preservation regression passed');
