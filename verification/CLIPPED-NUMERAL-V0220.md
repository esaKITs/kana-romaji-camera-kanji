# v0.2.20 — obtain the actual iPhone failure, not another assumed fix

Status: the user's iPhone failure is **not resolved or reproduced**. No OCR
adoption threshold, inference algorithm, dictionary spelling or label size is
changed by this release. Do not report this diagnostic build as a recognition fix.

The baseline still clips the original sample's third line to
`[85,293,501,317]` and recognizes `士日間みます`. The existing measured-crop
verification uses `[71,281,515,328]` and recovers the full correct source text.
This before/after holds in Chromium, Linux WebKit and Apple Silicon macOS
WebKit, with the exact same original image bytes. Test artifact JSON contains
raw output, measured reference glyphs, both PP crop scores and final labels.

The tracked `tests/fixtures/thin-numeric-original.png` has SHA-256
`be7033034b1005ba3173c91a511ff8cde5caca3e7bac92b18885e3d77e6266cf`.
Its decoded Chromium RGBA fingerprint is
`a0de7921387c908d31a58a3f01504a0e2af9cf776d1ab4fab5fe141ad55f77bb`.
WebKit CI now includes Linux and native macOS arm64, a mobile viewport, the
same fixed image, and a real report download through the UI. Desktop WebKit
is not a physical iPhone; passing it does not establish iPhone success.

## Concrete diagnostic addition

After reproducing the failure on the phone, return from Still, open
**About this preview**, and select **Download last OCR report**. The local
JSON contains app version, browser/OS user agent, source kind, decoded pixel
hash/dimensions, original detections, actual Meiki reference glyph boxes,
whole-line PP rechecks and scores, acceptance/rejection decisions, reading
analysis and displayed labels. It preserves raw text and measured coordinates.
The report contains no image or background patch pixels and makes no upload.

The built-in sample and external helper/reading worker URLs are refreshed
for v0.2.20 to avoid mixing old cached input/helper versions during this check.
The unchanged canonical core and models are still shared with the experiment.

The next recognition change must be based on the report from the failing
iPhone. Possible differences in input pixels, reference OCR, candidate geometry,
crop votes or cached resources are hypotheses, not established causes.
