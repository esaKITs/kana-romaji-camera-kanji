# PP-OCRv6_manga independent feasibility experiment

Status: PREPARATION ONLY. No model inference or Safari performance test has been run. Do not merge into main.

Source: https://huggingface.co/Kellenok/PP-OCRv6_manga (model card: Apache-2.0)
Model: manga_det_v0.2 and manga_rec_v0.2, ONNX FP16 (~0.92 + 10.63 MB).
Reference pipeline: examples/onnx_openvino.py. It includes DB postprocessing, learned furigana filter and block-aware reading order.

## Gate before integration
1. Audit license files for model, code, dictionary, filter and runtime dependencies; check any separate model weight terms.
2. Port preprocessing, DB postprocessing and decoding from the author's reference pipeline to onnxruntime-web. Confirm tensor dimensions and supported WebAssembly ops on iPhone Safari.
3. Expose all detected text boxes and ruby-filter decisions (do not discard ruby candidates); compare against baseline using the same textbook image.
4. Measure cold start, memory, speed and text/ruby association; no image uploads.
5. Only after acceptance, add an opt-in integration that leaves current Still/Focus/Live behavior unchanged.

Pass conditions: body OCR intact; ruby boxes identified without contamination; coordinates retained; all processing local; licensing verified; acceptable Safari speed.
