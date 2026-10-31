# PDF pages and image/PDF downloads (v0.2.23)

Choose image / PDF accepts local images and PDFs. Documents are processed in
browser memory with the existing OCR and reading pipeline; there is no upload.

- A PDF opens a numbered page selector. Select one or multiple pages, or all.
  Only selected pages are converted, sequentially in original document order.
- Resolution defaults to 300 dpi for fine text/ruby. 200/150 dpi are explicit
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

## Rollback release v0.2.30

At the user's request, the application is restored to the v0.2.24 source state (181f2f7), with the release identifier updated to 0.2.30. The default PDF resolution is again 300 dpi; page selection and PNG/PDF exports remain. Changes introduced in v0.2.25–0.2.29 and the separate diagnostic page are removed from the deployed tree. Their commits remain in repository history. This is a rollback for comparison, not a claim that the recurring iPhone failure has been diagnosed or fixed.


## v0.2.31 failure recording

The normal application records PDF file size, page counts, selected resolution, rendering phases and Meiki frame dimensions in tab-local session storage. PDF bytes, filenames and recognized text are not included. The record is updated before each operation and survives a reload in the same tab; an interrupted operation is identified by its last recorded phase, not declared successful. A visible failure panel downloads that record with a unique timestamp. OCR exceptions propagate to the document controller without being replaced by a generic retry message. The separate startup probe only checks application startup and opening the small sample PDF; it does not test PDF rendering or OCR conversion. This release adds diagnosis and error preservation, and does not claim to fix the reported original-PDF failure on an iPhone.


## v0.2.32 PDF-only diagnostics

Remove all PDF diagnostic imports and calls from the shared OCR entry module and restore that module byte-for-byte to v0.2.30. Diagnostic UI binding and initialization/conversion phases now belong to the PDF document controller. The camera controller only passes its existing engine initializer and a per-PDF-call error receiver to the document controller; ordinary image and Live calls have no diagnostic callback. The original camera Live test is restored without the v0.2.31 DOM harness changes. Per-frame OCR traces are removed; PDF records retain page dimensions, initialization/conversion stages and original exceptions. OCR models, frame limits, resolution, dictionary and romanization rules are unchanged.
