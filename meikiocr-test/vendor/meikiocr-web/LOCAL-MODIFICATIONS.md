# Second-edition local changes

The pinned upstream remains revision 0431493cfc59534bdf9e48be95a9e43c21a206be; no model or license was replaced. Both shipped `index.js` and Worker `worker.js` contain these local changes:

- Report raw detector proposals and retained-region routing in each snapshot. These contain text coordinates/confidence, never image bytes or network uploads.
- Accept an optional, validated `frame.regions`: 1–16 integer rectangles inside the frame. This bypasses detection and runs the existing horizontal recognizer on the supplied regions. Scores on supplied regions are null, not detector probabilities. This allows bounded rereading of detector proposals with additional image context, including a single character whose box is taller than wide.
- Normal full-frame orientation routing and model thresholds are unchanged.

The application selects at most six geometrically distinct uncertain regions, protects already-confident rows, and requires high character-recognition confidence before adding or replacing a line. The exact modified files and tests are included in the application's corresponding-source archive. The upstream source archive and original source maps are retained; those maps describe the upstream build and do not include these local additions.
