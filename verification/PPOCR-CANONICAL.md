Canonical PP-OCR camera integration (candidate; not yet released)

Original blob: 21a0546f93031e81b20b74fd2eee8c39af868e7d, archived byte-for-byte in tests/fixtures/ppocr-experiment-21a0546.html.
All nine required functions are extracted verbatim into ppocr-core.mjs. Detection and recognition statements are copied from the original click handler; only UI drawing, UI option access and session lifetime are separated. Both deployed entry points import /ppocr-core.mjs. Camera always uses 960/150 tiles and original classifiers and merge.

Measured Practice A source: IMG_2112(5).png (1179×2556); tests/fixtures/practice-a.png. Original, refactored experiment and camera agree exactly: 66 raw regions, 63 merged/classified regions, including all four required words and ruby. Counts are not recognition accuracy. Raw text, boxes and classifications remain separate from labels and omissions.

Bridge uses measured region boxes, never synthetic character boxes. Dictionary analysis retains raw text, separates ruby/held regions, and paints composite region labels. Ruby annotations remain visible; no claim of character-level OCR or learned ruby association. Region-level rendering cannot place separate word labels within a detected multiword region. Vertical regions remain preserved without horizontal labels.

Local regression: 108 unit tests, Meiki browser integration and original-textbook browser integration passed. Actual PP comparison and synthetic Live are release gates in check.yml. Real iPhone/camera validation remains distinct from simulated stream tests.
