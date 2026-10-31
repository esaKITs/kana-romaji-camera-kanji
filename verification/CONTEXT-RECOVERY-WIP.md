# Measured context recovery (not released)

The display verification path can subdivide a clipped body region using actual reference glyph envelopes, retaining source punctuation. Reference recognition text is not adopted. Two independent PP crops must agree exactly and both meet the existing 0.85 minimum probability. Uncertain letter geometry, crops crossing other detected regions, and overly wide crops are rejected. Raw canonical regions and the canonical OCR implementation remain unchanged.

Unknown kana-only tokens receive a display-only literal reading; unknown Han tokens retain the existing review gate. Analyzer tokens are not mutated.

Validation: 24 targeted tests pass; full suite 175/176 passes locally. The remaining test requires the absent generated Sudachi module. Build passes. Original PDF page 1 testing is in progress; no claim of full-page recovery or iPhone validation. This change is not ready for main until real-page and browser regression results are reviewed.

Private source PDF and diagnostic outputs must not be committed.

## Original page validation

PDF page 1 rendered at 300 dpi: 2117 x 3055, RGBA SHA-256 `600633c6a5491d34efe6aca0ff68f436d9fd6ec919d140482c92af9ec0f1eda7`, matching the device report. Ten measured context components were confirmed by two PP crops. Coffee and the polite refusal were recovered without the earlier duplicated fragments. Unknown kana `ジョゼ` and `サントス` display literally.

Release blockers: work question and repeated `そうですか` still fail; thanks and final invitation still fragment. A newly split `生活は` label is omitted for label collision. Do not merge or release this branch. Measured crop acceptance alone is insufficient; sibling label layout and ruby association need regression coverage and correction. Original full-page OCR 18.6 s, verification 44.7 s in this headless run; no device performance claim.
