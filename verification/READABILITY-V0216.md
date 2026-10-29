# v0.2.16: PP-OCR label readability

The Practice A image supplied again as IMG_2112(6).png is byte-identical to
`tests/fixtures/practice-a.png` (SHA-256
41665ef0a68c31e831e1cb1a94a20bdc51d3cd1bf381da83d6bb8cfdd33fd49c).

## Changes

* Keep the existing ruby headroom and full source-erasure bounds. Limit Latin
  vertical/horizontal distortion to 1.65 rather than filling every mask vertically
  (typically 2.7 in v0.2.15). Keep text near the body bottom. Do not stretch width.
* Use a shared nominal font for similar-height regions on the same baseline;
  constrain adjustments to avoid borrowing an unrelated heading's size.
* A neighboring word's ruby touching only erase padding must not limit this
  label's text height. Ruby touching the actual text remains a blocker. Erasure
  still clips against every unconverted region; previous body rows remain protected.
* `de`: v0.2.15 used font 20.4, vertical scale 1.474 and top 1279.2 because
  the neighboring 紅茶 ruby touched the padded mask. It now uses font 22.525,
  scale 1.65 and top 1258, sharing the nominal font and scale with 紅茶… .
* Repair replacement paper locally from the original image using morphological
  closing for light paper / opening for dark paper, with a bounded nearby-paper
  fallback for broad ink. This retains local color panels instead of overlaying
  palette-colored rectangles. Apply only to PP labels with the ruby-height policy.
  This is a display operation; neither the repaired image nor its pixels enter OCR.
* Display Japanese periods/commas as Latin punctuation inside romaji labels.
  OCR text and measured regions are retained intact.

## Verification

126 tests pass, including real pixel tests for two-color panel boundaries, dark
paper, previous-row protection, neighboring unowned ruby, and preview/camera
pixel equality. The detector, dictionary, inference resolution, thresholds, all
nine original function bodies, and supplemental single-character OCR are unchanged.

Archived experiment, shared experiment and camera match exactly: 66 raw regions,
63 classified regions, 3 supplemental し, 44 labels, 0 omissions. These are counts,
not recognition rates. 京都・お花見・紅茶・食堂 readings remain intact. All three
reading modes and synthetic Live/capture retain the same OCR data.

The actual-image mask audit (`readability-v0216.json`) checks every owned ruby,
source dark pixels near the measured body, and preserved regions. All 8 owned
ruby are covered. Source residual dark ink, preserved-region pixel changes and
ruby-mask errors are zero. Both the font and scale ratios of de / 紅茶… are 1.

Build and asset integrity pass. Actual Chromium MeikiOCR sample and the separate
textbook regression also pass. Physical iPhone Live, text rotation, and vertical
writing are not validated or implemented by this change. Photographic backgrounds
can still show local repair artifacts; seamless restoration of arbitrary art is
not claimed.
