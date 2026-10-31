# Measured context recovery (not released)

The display verification path can subdivide a clipped body region using actual reference glyph envelopes, retaining source punctuation. Reference recognition text is not adopted. Two independent PP crops must agree exactly and both meet the existing 0.85 minimum probability. Uncertain letter geometry, crops crossing other detected regions, and overly wide crops are rejected. Raw canonical regions and the canonical OCR implementation remain unchanged.

Unknown kana-only tokens receive a display-only literal reading; unknown Han tokens retain the existing review gate. Analyzer tokens are not mutated.

Validation: 24 targeted tests pass; full suite 175/176 passes locally. The remaining test requires the absent generated Sudachi module. Build passes. Original PDF page 1 testing is in progress; no claim of full-page recovery or iPhone validation. This change is not ready for main until real-page and browser regression results are reviewed.

Private source PDF and diagnostic outputs must not be committed.
