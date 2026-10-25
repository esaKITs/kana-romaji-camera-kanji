# Kana → Romaji Camera: second-version development

2026-10-21 specification supersedes the earlier provisional four-mode memo.

- Only modes: **あア漢 / ア漢 / 漢**. No UI mode additions or removals.
- Name remains **Kana → Romaji Camera**; kana conversion remains the public concept.
- Stable main / backup: `56b3113bddc5f5893c2901d4f1955098ec3d1810`.
- Work only in `development/kanji-reading`; existing app sources and Pages workflow are out of scope.
- No production publication, app UI overhaul or romanization changes without user approval.
- No cloud OCR/reading, paid APIs, image/result uploads, ads or registration.
- Phase 1/2 implementation and measurements: [report](PHASE1-2-REPORT.md), [lab](lab/README.md).
- Production reading-engine selection is **pending**, particularly smartphone combined OCR memory.

A new repository is preferred. This session's GitHub connector exposes no repository-create operation, so the authorized development branch is used. A local baseline git bundle is a separate-file recovery copy, not an independent hosted repository. Publish neither the lab nor the second version automatically.

## Continued Phase 2 / minimal Still prototype

- [Updated evaluation and Still report](PHASE2-CONTINUATION-REPORT.md)
- [100-case results](EVALUATION-100-RESULTS.md)
- [Reproduction instructions](lab/V2-README.md)
- Analyzer final selection and product UI are pending user approval.

## Numeric pronunciation continuation — 2026-10-24

- [Numeric rules, evaluation and Still report](NUMERIC-READING-REPORT.md)
- [Original 100 before/after](NUMERIC-BASE-100-RESULTS.md)
- [Extra 80 + 20 guards](NUMERIC-EXTRA-100-RESULTS.md)
- Main/public UI and final analyzer selection remain unchanged.

## 2026-10-24 Still row allocation

Added isolated row-space allocation in `still-prototype/layout.mjs`. The research
renderer shares width between adjacent target words, protects preserved glyphs,
compresses horizontally no further than 0.70, and tries two rows for long labels.
See `STILL-LAYOUT-REPORT.md`. No production UI, engine selection, or deployment.
