# v0.2.21 — iPhone crop confidence and particle vowel boundaries

## Evidence from the user's v0.2.20 report

The report says `origin: built-in-sample`, 1500×620, decoded RGBA SHA-256
`a0de7921387c908d31a58a3f01504a0e2af9cf776d1ab4fab5fe141ad55f77bb`.
It is the exact input already tested in CI, not an unknown saved-image variant.
The pasted Japanese strings are mojibake; numeric evidence and prior screenshots
identify the rejected third line without treating the mojibake as model output.

Canonical PP region: `[85,293,501,317]`, clipped to `士日間みます`.
Meiki measured region: `[71,281,515,328]`, full `二十日間休みます。`.
Both PP crop texts agree with that reference. First crop minimum probability:
0.9914557337760925. Second (.12 margin): 0.5346751809120178. The .85 gate
therefore rejects the repair. Other four line repairs pass.
The report does not identify the individual low-confidence character or explain
why iPhone inference differs. Do not claim a particular character/backend cause.

## Change

Keep the canonical experiment core, models, preprocessing, thresholds and all
primary detections unchanged. Keep both existing crop reads. Only if both texts
agree with the reference and exactly one crop passes .85, make one extra PP read
at the intermediate .06 margin. All three texts must agree, and at least two PP
reads must independently pass .85. Any textual disagreement or low retry keeps
original PP output. Never substitute Meiki text by itself. Raw coordinates and
text remain in the report. Record the extra read and per-character PP scores.

This adds a bounded retry outside the canonical OCR, not a lower threshold.
It may add one recognition call per affected line. It does not guarantee the
extra crop will pass on a physical iPhone; that remains to be verified there.

## Validation

Unit regression replays the exact iPhone scores and verifies raw preservation,
measured box adoption, and rejection of contrary text, both-low scores, and
low/invalid retry scores. Existing rejection cases remain tested.

`scripts/ios-crop-retry-browser-test.mjs` runs real OCR on the byte-exact sample,
then injects only the reported .534675 minimum score for the second crop to
exercise the rejection path. The extra crop executes the real unchanged PP
model and must produce the full expected text above .85. This is a fault replay,
not a claim to reproduce iOS inference. Local Chromium extra crop: .9977145,
output `hatsukakan yasumimasu.`. CI runs Chromium and Linux/macOS WebKit.

## Particle boundaries

`format.mjs` keeps a particle and each neighboring word in separate long-vowel
conversion domains even if a caller has supplied a grouped token. Correct は/へ/を
pronunciations remain wa/e/o. Existing te/de + iru behavior is retained.
Tests use the actual Kuromoji dictionary, both display styles and measured PP
region labels: 学校へ `gakkoo e` / `gakkō e`, 本を `hon o`, 絵へ `e e`,
井戸を `ido o`, 水がある `mizu ga aru`, 水はある `mizu wa aru`.
This is boundary protection, not the full new long-vowel specification.
