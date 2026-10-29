# Agreed development stages

1. Diagnose OCR → morphology → number/counter reading → label generation.
   Resolve 20歳/3本/3時 as whole pronunciations, keeping raw OCR and measured boxes.
2. Improve upright horizontal display: compare actual rendered character heights
   against the original, retain large readable romaji, handle long text and controls.
   The user's 55% original-image visibility is intentionally used for size comparison.
   Also compare and settle long-vowel spelling (including ei/ee/ē) and nasal
   spelling (n/m/n’), keeping pronunciation selection separate from spelling.
   The existing m-before-b output is inherited behavior, not a newly settled policy.
3. Rotated horizontal text: arbitrary angle, inverse coordinate mapping, Still/Live
   and uploaded images. Rotation is distinct from viewport orientation.
4. Vertical writing: verify recognition, reading order, right-hand ruby, placement,
   then arbitrarily rotated vertical writing.
5. PDF input and result download (requested 2026-10-30 JST):
   * Import PDF and select pages to convert.
   * Download converted results as an image or PDF, excluding controls/debug guides.
   * This is a recorded requirement; PDF I/O is not implemented in stage 1.

Each stage is developed on a separate branch, verified before merging, and released
with version, public camera URL and GitHub Actions result URL. Do not infer original
camera OCR strings from screenshots containing overlaid labels.
