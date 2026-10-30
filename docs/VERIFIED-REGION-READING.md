# Verified region readings

The canonical PP experiment and its raw OCR output remain the reference. Extra
camera processing records separate, measured crop decisions. Models, tensor
preparation, detector thresholds, 960-pixel overlapping tiles and dictionaries
are unchanged.

A verified ruby span overrides analyzer boundaries as a unit. Dictionary
pronunciation metadata is retained only when it matches that reading. A ruby
that differs from the dictionary needs two matching PP crop reads at the existing
.85 gate. Two text agreements with only one confident crop permit one bounded
intermediate-margin retry; any contrary text rejects the reading. A repeated identical body/annotation pair can reuse a verified pair
within the current document result; another annotation on the same spelling
cannot inherit it. No per-character PP coordinates are invented.

Conflicting overlapping body regions can be re-read together using their actual
union and nearby measured reference geometry. Their original detections remain
in raw/classified diagnostics. Replacement requires two matching confident PP
reads; interfering ruby/other regions are protected.

A clipped body whose reference differs on exactly one internal glyph may use
three agreeing confident PP crops, with at least two identical reference
characters before and after that glyph. The reference supplies geometry rather
than an automatic text replacement. Contrary and low-confidence checks fail
closed, with the original result retained.
