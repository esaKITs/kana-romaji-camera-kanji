# PDF preview 0.1.0

An independent `/pdf-preview/` experiment next to the unchanged v0.2.22 camera.
This stage supports file loading, lazy thumbnails, multiple page selection and
300 dpi display of one selected page at a time. No OCR or export is included.

The selected File is read once before clearing the input and before importing
PDF.js (the same pinned 6.4.299 release used by v0.2.24). Its bytes are handed to
PDF.js. No custom range transport, independent JPEG decoder or source File
re-read is used. Rendering is serialized; visible thumbnails are 140 pixels wide
and offscreen thumbnail canvases are released. Full previews retain the original
300 dpi / 16 million pixel / 16384 pixel side limits. Oversized pages fail explicitly.

Replacing or closing a document invalidates in-flight results, cancels rendering
and destroys the old loading task. Render promises have a 45 second deadline and
the page task is cancelled on expiry. A browser process being killed cannot be
caught by JavaScript; this experiment does not claim to eliminate that risk.

The original three-page sample contains text, a rotated graphic page, and an
embedded JPEG image. User PDFs, their page images, filenames and extracted text
must not be committed or uploaded as CI artifacts. Physical iPhone verification
of the user's 78-page PDF is required before integrating PDF input into the camera.

The frozen `backup/v0.2.22-pre-pdf` branch remains the restore point.
