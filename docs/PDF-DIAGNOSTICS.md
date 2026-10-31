# PDF failure investigation

`diagnostics/` loads the unchanged camera app in a same-origin frame and observes it. This is an investigation tool, not a new OCR fix or a claim that the iPhone failure has been resolved.

The local JSON records the loaded app title and script URLs, progress/error messages, output dimensions and DPI, worker frame identifiers/dimensions, and stacks for large canvas reads. Canvas-read dimensions are distinct from worker-input dimensions: a large fingerprint read does not itself establish a worker-limit violation. No PDF/image bytes or recognized text are recorded or uploaded.

The current report remains downloadable after a caught conversion failure. Session storage retains the latest trace across a reload; the separate previous-report button exports that retained trace. Storage availability depends on the browser.

Open the page, select the PDF and run the failing conversion, then save the diagnostic report. Its loaded app version, actual failure text and frame trace distinguish an older running document from a failure in the current code. Until the failing-device trace exists, neither cache nor a new OCR defect is established as the cause.
