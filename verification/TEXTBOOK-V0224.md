# v0.2.24: verified ruby, conflicting tile fragments and PDF numerals

## Observed evidence

The user supplied a v0.2.23 PP report (SHA-256
`92a89ad29f27a1f6bb73d4eb8c746a4f3e65412642e4d17539df3f6874b9c1ff`),
two raster result PDFs, and the first-page sample PNG. Uploaded files and their
full traces stay local; they are not published in this repository.

The report records a 2117×3055 source fingerprint
`600633c6a5491d34efe6aca0ff68f436d9fd6ec919d140482c92af9ec0f1eda7`.
It verifies the ruby for 山田一郎, yet then withholds both surname and given name
because the verified span covers two analyzer tokens. 日本's dictionary reading
is ニッポン while its annotation is にほん; the old bridge never tried an
independent annotation reread. Two overlapping title detections block both labels;
two overlapping work-question fragments are both displayed.

The built-in PDF page 1 independently reproduces the final numerical line:
PP reads 水が十三杯あります。 twice at .9963/.9942, but the reference reads
水が一三杯あります。 and vetoes both. The fallback line height is 24 pixels
rather than the measured 50-pixel body, explaining its small label.

## Changes

- Keep a verified annotation span together across analyzer token boundaries.
  Preserve actual dictionary pronunciation metadata when the selected reading
  agrees, and retain ordinary verb-chain grouping.
- For a uniquely associated Han span whose ruby differs from the dictionary,
  require two confident PP ruby crops at the existing .85 minimum. If both
  agree in text but only one is confident, one intermediate crop may retry;
  contrary text cannot be outvoted. Identical body AND
  annotation readings can reuse a verified same-document association; homographs
  with different ruby cannot borrow it. Unverified proper names remain withheld.
- Keep parent spelling aliases when verified geometry repairs the OCR text.
  Cover only annotations belonging to actually converted Han spans. A different
  converted Han elsewhere in the line cannot erase an unresolved annotation.
- Conflicting, overlapping same-row detections can become one measured crop.
  Nearby independently measured reference boxes supply geometry, not text.
  Two agreeing PP crops at .85 are required. Ruby/other-region intersections
  veto a candidate. All original raw/classified regions are retained.
- For an otherwise eligible clipped-region repair, a reference disagreement on
  exactly one internal glyph with two unchanged characters on each side can
  request a third PP crop. All three must agree confidently. This neither
  rewrites numerals by vocabulary nor lowers the .85 threshold.
- Reuse the original, unchanged `classifyLocal` on verified display geometry;
  retain canonical classifications separately. This allows clipped-body ruby
  to regain its correct role after the body height is measured.

## Verification and limits

- Original experiment SHA and all nine canonical function bodies remain unchanged.
- Existing negative crop-confidence/disagreement tests remain active; new tests
  reject low/contrary third crops, unrelated replacements and ruby intersections.
- Real local Chromium OCR of an authored ruby fixture converts 山田一郎,
  both occurrences of 山田友子 and 日本 with their annotations. Switching
  long-vowel style preserves the exact OCR snapshot.
- Actual built-in PDF page 1 now renders `mizu ga juusambai arimasu.` with a
  42.5-pixel nominal font, comparable to the other body rows (39.95–43.35).
  The PDF browser test now requires its source text, reading and normal size.
- Replaying the actual device snapshot against the real dictionary and verified
  annotation reads converts all three recorded 山田一郎 and all three 山田友子,
  plus 日本. Canonical raw regions remain byte-for-byte unchanged.
- The two uploaded result PDFs have identical, unpainted title pixels. Two actual
  PP crops there return 失礼します。 at .99914/.99906, repairing both conflicting
  detections as one display region. Repainted areas are explicitly excluded from
  this crop replay; they are not passed off as the original image.
- The source PDF itself was not supplied. The work-question overlap and other
  already-repainted body fragments cannot be fully re-run from these exports.
  Full-page visual acceptance still needs the original PDF; no claim of complete
  textbook-page recovery is made.
- The local full suite has a pre-existing missing generated Sudachi research
  module; CI builds that pinned module and must pass every test. No test is
  disabled. CI also runs the PDF/numeral and authored-ruby regressions through
  Chromium and Linux/macOS WebKit. Physical iPhone testing is not claimed.
