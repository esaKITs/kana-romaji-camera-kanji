# Curved-line label omissions — 2026-10-24

User screenshot IMG_2068 shows Still finished with many outlined words lacking romaji. The guide code outlines reading candidates (`result.labels`), not only successfully placed labels. Therefore these outlines indicate placement omissions, rather than simply an unfinished OCR job. The screenshot alone does not prove that every missing label has the same cause, and an original camera frame/recognition snapshot is unavailable.

Identified and fixed two allocator problems:

- Whole-line bounding height was used as the font basis. On a bottle or slanted baseline, this envelope includes vertical drift, inflating the font relative to the actual glyph height. Use median glyph height, capped by the line envelope, while keeping a consistent font for the line.
- Two-row layout was attempted only when aggregate width exceeded available space. Source-anchor constraints could still fail with ample aggregate width. Attempt wrapping when anchor feasibility also fails, and allow readable two-row fallback inside individual source spans.

The existing minimum horizontal scale and source correspondence protections remain. Existing protected-glyph and collision tests pass. No analyzer, mode or romanization rule changed.

Still completion now reports displayed label count and layout omission count, rather than only finished. Position guides are green for drawn candidates and amber for candidates omitted by placement. This does not change unknown/ambiguous-reading policy or imply that omitted words have correct readings.

Verification: 80 automated tests pass, including curved-line geometry, anchor pressure with spare canvas width, serial Live/Still scheduling and all existing readability/collision/mode/romanization tests. A synthetic curved-line regression is compared against the previous allocator; this is not an OCR accuracy test on the user's original photo. Physical iPhone behavior for this revision remains unverified.
