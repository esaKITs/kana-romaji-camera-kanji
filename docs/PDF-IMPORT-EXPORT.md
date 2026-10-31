# PDF pages and image/PDF downloads (v0.2.23)

Choose image / PDF accepts local images and PDFs. Documents are processed in
browser memory with the existing OCR and reading pipeline; there is no upload.

- A PDF opens a numbered page selector. Select one or multiple pages, or all.
  Only selected pages are converted, sequentially in original document order.
- Resolution defaults to 600 dpi for fine text/ruby. 300/200/150 dpi are explicit
  alternatives. Oversized canvases fail with a clear resolution choice rather
  than silently downsampling or changing OCR inference settings.
- The page bar navigates selected pages. Converted pages reuse OCR snapshots
  when revisited at the same resolution. Cancel keeps completed page results.
- Save PNG saves the displayed Still page at its full raster dimensions.
- Save PDF saves every selected page, in source order; every selected page must
  first be converted at the current resolution. For a camera/image Still,
  Save PDF writes a single image page at 96 pixels per physical inch.
- PNG and PDF include the selected reading mode, long-vowel style and original
  image visibility. Zoom/pan, buttons and diagnostic guides are excluded.
- PDF exports are raster page images, not searchable/selectable text PDFs.
  Source PDF physical page dimensions, CropBox and displayed /Rotate orientation
  are preserved; mixed portrait/landscape selections are supported.
- Password-protected PDFs are not yet supported. Bad replacement input leaves
  the previous valid document and its converted page available.

## Processing and memory

PDF.js 6.4.299 (Apache-2.0, legacy browser build) rasterizes each selected page.
Its worker, CMaps, fonts, ICC profiles and image-decoder WASM ship from the same
site. PDF scripts are not executed; isEvalSupported is false. Static page/annotation
appearance is rendered without an interactive scripting/form layer.

Both OCR modes use their existing unchanged inference. The canonical PP core,
960-pixel overlapping tiles, thresholds, models and postprocessing are unchanged.
Page records retain OCR data and readings, not full-resolution page canvases or
background patches. Old page canvases are released after navigation. PDF export
rasterizes/repaints one page at a time and flushes embedded images to release
uncompressed decoder buffers. Final PDF byte buffers still require browser memory.

pdf-lib 1.17.1 (MIT) embeds lossless PNG page images in exported PDFs. No PDF
form data, executable script, embedded attachments or text layer is copied into
those image PDFs. A download link remains available if an automatic save does
not start. PDF.js, pdf-lib and bundled dependency/asset notices are distributed.

## Verification

Three-page sample: landscape image page 1; /Rotate=90 vector-text page 2;
portrait Japanese image page 3. Tests use real UI actions through both OCR modes:
select pages 1/3, cancel/retry, convert, compare decoded PNG pixels against the
output canvas with original-image visibility and guides enabled, save two-page
PDF with exact source page sizes/order, switch vowel style without rescanning,
navigate cached pages, convert/export rotated page 2, reject a corrupt replacement,
reopen the actual exported PDF through PDF.js, and export a normal image Still.
PDF output pages are also rendered with Poppler for visual inspection.

## Resolution policy (v0.2.25)

600 dpi is the default for import, OCR and export re-rendering on every device.
The app does not automatically reduce the selected resolution. The canvas limit
is 36 million pixels, with a maximum side of 16384 pixels; A4 at 600 dpi fits.
Larger pages are rejected before allocation and offer a lower resolution.
Only one selected page is processed at a time. Canonical OCR tiling, models,
thresholds and recognition preprocessing are unchanged. A higher render resolution
is not a claim that all recognition errors are resolved.

## Large local PDFs (v0.2.26)

PDF.js reads the local Blob through requested byte ranges with automatic fetching
and streaming disabled. Import no longer calls `file.arrayBuffer()` on the entire
PDF. Whitespace planning retains full pixel resolution while accumulating profiles
in strips of at most 128 rows, rather than copying the full page and its RGBA data.
The temporary recognition render canvas is explicitly released after painting.
Page status distinguishes rendering from recognition. The selected dpi and OCR
models/thresholds remain unchanged. These changes reduce peak memory; they do not
constitute confirmation on a user's physical iPhone or eliminate all memory limits.

## Distant repair crops (v0.2.27)

The ordinary page scan is tiled, but supplemental Meiki recognition previously
combined distant measured regions into one bounding frame. The reported
3193 x 4474 frame exceeded the existing 4,000,000-pixel worker guard. Each
regional repair now reads its own measured crop sequentially and restores source
coordinates before merging. No downsampling, model, threshold or worker-limit
change is used. Regression tests cover the exact reported union dimensions and
actual Meiki worker calls for two distant regions on a 3500 x 5000 canvas.

## Page-buffer lifetime (v0.2.28)

The app computes replacement layout and patches using a 1 x 1 measurement canvas,
then paints the visible result once. Export still paints at source resolution.
Disabled position guides have zero bitmap dimensions. Meiki scan tiles release
their canvas backing store immediately after their worker call, including errors.
A conversion shows the current phase and elapsed seconds. A reading failure is
propagated to document status instead of being replaced with a generic retry text.

The supplied 78-page PDF was exercised directly in Chromium (no extracted page
or substituted sample): page 1 at 300 dpi (2117 x 3055) and 600 dpi (4234 x 6109),
using both OCR engines. The v0.2.27 baseline completed all four cases, about
26-96 seconds locally. An iPhone-specific failure is not reproduced by that test;
these results must not be reported as confirmation on the user's physical device.
Layout-only tests compare every painted pixel at visibility 0/55/100 against the
previous path. Private source PDF and its output/diagnostic data are excluded from
the public repository and CI artifacts.

## Common worker input boundary (v0.2.29)

The v0.2.27 regional fix did not cover detector calls without measured regions. Every Meiki scan now passes through one boundary that splits oversized detector inputs as well as measured crops, preserving source pixels and absolute coordinates. Tests exercise the reported 3193×4474 frame with absent, empty and explicit regions through that production boundary; a real worker browser test also scans the full-size frame. Worker failures include the scan identifier and actual dimensions. This closes a code path that could produce the reported error; the precise failing call on the user's iPhone and its resolution on that device remain unverified.
