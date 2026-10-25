// src/errors.ts
var MeikiOcrError = class extends Error {
  code;
  cause;
  constructor(code, message, cause) {
    super(message);
    this.name = "MeikiOcrError";
    this.code = code;
    if (cause !== void 0) this.cause = cause;
  }
};
var BusyError = class extends MeikiOcrError {
  constructor(message = "A scan is already in progress; coalesce intents in the caller.") {
    super("BUSY", message);
    this.name = "BusyError";
  }
};
var DisposedError = class extends MeikiOcrError {
  constructor(message = "Client has been disposed.") {
    super("DISPOSED", message);
    this.name = "DisposedError";
  }
};
var AbortedError = class extends MeikiOcrError {
  constructor(message = "Scan aborted by caller.") {
    super("ABORTED", message);
    this.name = "AbortedError";
  }
};
var InvalidInputError = class extends MeikiOcrError {
  constructor(message) {
    super("INVALID_INPUT", message);
    this.name = "InvalidInputError";
  }
};
var InputTooLargeError = class extends MeikiOcrError {
  constructor(message) {
    super("INPUT_TOO_LARGE", message);
    this.name = "InputTooLargeError";
  }
};
var AssetError = class extends MeikiOcrError {
  constructor(code, message, cause) {
    super(code, message, cause);
    this.name = "AssetError";
  }
};
var ModelSignatureError = class extends MeikiOcrError {
  constructor(message) {
    super("MODEL_SIGNATURE_MISMATCH", message);
    this.name = "ModelSignatureError";
  }
};
var RuntimeInitError = class extends MeikiOcrError {
  constructor(message, cause) {
    super("RUNTIME_INIT_FAILED", message, cause);
    this.name = "RuntimeInitError";
  }
};
var InferenceError = class extends MeikiOcrError {
  constructor(message, cause) {
    super("INFERENCE_FAILED", message, cause);
    this.name = "InferenceError";
  }
};
var WorkerProtocolError = class extends MeikiOcrError {
  constructor(message) {
    super("WORKER_PROTOCOL_ERROR", message);
    this.name = "WorkerProtocolError";
  }
};
var WorkerCrashedError = class extends MeikiOcrError {
  constructor(message, cause) {
    super("WORKER_CRASHED", message, cause);
    this.name = "WorkerCrashedError";
  }
};
function deserializeError(s) {
  switch (s.code) {
    case "BUSY":
      return new BusyError(s.message);
    case "DISPOSED":
      return new DisposedError(s.message);
    case "ABORTED":
      return new AbortedError(s.message);
    case "INVALID_INPUT":
      return new InvalidInputError(s.message);
    case "INPUT_TOO_LARGE":
      return new InputTooLargeError(s.message);
    case "ASSET_FETCH_FAILED":
    case "ASSET_INTEGRITY_FAILED":
    case "ASSET_MISSING":
      return new AssetError(s.code, s.message);
    case "MODEL_SIGNATURE_MISMATCH":
      return new ModelSignatureError(s.message);
    case "RUNTIME_INIT_FAILED":
      return new RuntimeInitError(s.message);
    case "WORKER_PROTOCOL_ERROR":
      return new WorkerProtocolError(s.message);
    case "WORKER_CRASHED":
      return new WorkerCrashedError(s.message);
    case "INFERENCE_FAILED":
    case "UNSUPPORTED":
    default:
      return new MeikiOcrError(s.code, s.message);
  }
}

// src/assets/manifest.ts
function resolveAssetUrl(baseUrl, path) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  if (!baseUrl.endsWith("/")) {
    throw new InvalidInputError(`assetBaseUrl must end with '/': ${baseUrl}`);
  }
  return new URL(path, baseUrl).toString();
}
function validateManifest(m) {
  if (!m || typeof m.modelSetId !== "string" || !m.modelSetId) {
    throw new InvalidInputError("manifest.modelSetId is required");
  }
  const roles = /* @__PURE__ */ new Set();
  for (const a of m.models) {
    if (!a.path || !/^[0-9a-f]{64}$/i.test(a.sha256) || !(a.byteLength > 0)) {
      throw new InvalidInputError(`manifest model ${a.role} needs path, 64-hex sha256 and byteLength`);
    }
    if (roles.has(a.role)) throw new InvalidInputError(`duplicate model role ${a.role}`);
    roles.add(a.role);
  }
  if (!roles.has("detector") || !roles.has("recognizer-horizontal")) {
    throw new InvalidInputError("manifest must include detector and recognizer-horizontal");
  }
}
async function sha256Hex(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const buf = view.byteOffset === 0 && view.byteLength === view.buffer.byteLength ? view.buffer : view.slice().buffer;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// src/defaults.ts
var MODEL_DIMS = Object.freeze({
  DET_WIDTH: 960,
  DET_HEIGHT: 544,
  REC_HEIGHT: 32,
  REC_WIDTH: 960,
  VREC_WIDTH: 32,
  VREC_HEIGHT: 480,
  /** Height of segments when a vertical split is forced. */
  VREC_MAX_CONTENT_HEIGHT: 420,
  /** Overlap in the scaled space when splitting vertical lines. */
  VREC_OVERLAP_PX: 64
});
var NMS = Object.freeze({
  X_OVERLAP_THRESHOLD: 0.3,
  Y_OVERLAP_THRESHOLD: 0.3,
  EPSILON: 1e-6
});
var SWAPPED_PAIRS = /* @__PURE__ */ new Map([
  ["\u5121\u5080", "\u5080\u5121"],
  ["\u8AC7\u5197", "\u5197\u8AC7"],
  ["\u6C70\u6DD8", "\u6DD8\u6C70"],
  ["\u6CB1\u6EC2", "\u6EC2\u6CB1"],
  ["\u6523\u75D9", "\u75D9\u6523"],
  ["\u914A\u9169", "\u9169\u914A"],
  ["\u9EAD\u9EBA", "\u9EBA\u9EAD"],
  ["\u54ED\u615F", "\u615F\u54ED"]
]);
var PROFILES = Object.freeze({
  "meikipop-v2": Object.freeze({
    channelOrder: "rgb",
    detThreshold: 0.5,
    recThreshold: 0.1,
    punctConfFactor: 0.2
  }),
  "meikiocr-native": Object.freeze({
    channelOrder: "bgr",
    detThreshold: 0.5,
    recThreshold: 0.1,
    punctConfFactor: 1
  })
});
var HORIZONTAL_RECOGNIZER_MAX_CHARS = 48;
var DEFAULTS = Object.freeze({
  profile: "meikipop-v2",
  execution: "wasm",
  wasmThreads: 1,
  vertical: "lazy",
  recognitionBatchSize: 4,
  maxRecognitionBatchSize: 8,
  /** 4 megapixels */
  maxInputPixels: 4e6,
  persistentCache: true,
  /** Cache Storage namespace owned exclusively by this library. */
  cacheName: "meikiocr-web-assets-v1",
  /** Bounded worker restart policy on fatal failures. */
  maxWorkerRestarts: 2,
  /** Watchdog: a scan with no reply for this long is treated as a hung worker (terminate + bounded restart). */
  scanTimeoutMs: 3e4,
  /** Consumer-side scheduling default (mirrors MeikiPop auto_scan_interval_seconds). */
  scanIntervalMs: 500
});
var UPSTREAM_MODEL_FILES = Object.freeze({
  detector: "meiki.text.detect.v0.1.960x544.onnx",
  recognizerHorizontal: "meiki.text.rec.v0.960x32.onnx",
  recognizerVertical: "meiki.text.rec.v0.vertical.32x480.onnx"
});

// src/image/resize.ts
var COEF_BITS = 11;
var COEF_SCALE = 1 << COEF_BITS;
function cvRound(x) {
  const r = Math.round(x);
  if (Math.abs(x % 1) === 0.5) {
    const f = Math.floor(x);
    return f % 2 === 0 ? f : f + 1;
  }
  return r;
}
function computeAxis(srcSize, dstSize, clampWeights) {
  const idx = new Int32Array(dstSize);
  const a0 = new Int32Array(dstSize);
  const a1 = new Int32Array(dstSize);
  const scale = srcSize / dstSize;
  for (let d = 0; d < dstSize; d++) {
    let f = Math.fround((d + 0.5) * scale - 0.5);
    let s = Math.floor(f);
    f = Math.fround(f - s);
    if (clampWeights) {
      if (s < 0) {
        f = 0;
        s = 0;
      }
      if (s >= srcSize - 1) {
        f = 0;
        s = srcSize - 1;
      }
    }
    idx[d] = s;
    a0[d] = cvRound(Math.fround(Math.fround(1 - f) * COEF_SCALE));
    a1[d] = cvRound(Math.fround(f * COEF_SCALE));
  }
  return { idx, a0, a1 };
}
function resizeArea2x(src, sw, sh, channels) {
  const dw = sw >> 1;
  const dh = sh >> 1;
  const out = new Uint8ClampedArray(dw * dh * channels);
  for (let y = 0; y < dh; y++) {
    const r0 = 2 * y * sw * channels;
    const r1 = r0 + sw * channels;
    for (let x = 0; x < dw; x++) {
      const c0 = 2 * x * channels;
      const c1 = c0 + channels;
      const o = (y * dw + x) * channels;
      for (let c = 0; c < channels; c++) {
        const sum = src[r0 + c0 + c] + src[r0 + c1 + c] + src[r1 + c0 + c] + src[r1 + c1 + c];
        out[o + c] = sum + 2 >> 2;
      }
    }
  }
  return { data: out, width: dw, height: dh };
}
function resizeLinearCv(src, sw, sh, dw, dh, channels = 4) {
  if (!(sw > 0 && sh > 0 && dw > 0 && dh > 0)) {
    throw new RangeError(`resize: invalid dimensions ${sw}x${sh} -> ${dw}x${dh}`);
  }
  if (src.length < sw * sh * channels) {
    throw new RangeError("resize: source buffer too small");
  }
  if (sw === dw && sh === dh) {
    return { data: Uint8ClampedArray.from(src.subarray(0, sw * sh * channels)), width: dw, height: dh };
  }
  if (sw === dw * 2 && sh === dh * 2) {
    return resizeArea2x(src, sw, sh, channels);
  }
  const ax = computeAxis(sw, dw, true);
  const ay = computeAxis(sh, dh, false);
  const out = new Uint8ClampedArray(dw * dh * channels);
  const rowBuf0 = new Int32Array(dw * channels);
  const rowBuf1 = new Int32Array(dw * channels);
  const hResize = (sy, buf) => {
    const rowOff = sy * sw * channels;
    for (let x = 0; x < dw; x++) {
      const sx = ax.idx[x];
      const w0 = ax.a0[x];
      const w1 = ax.a1[x];
      const sx1 = sx + 1 < sw ? sx + 1 : sx;
      const p0 = rowOff + sx * channels;
      const p1 = rowOff + sx1 * channels;
      const o = x * channels;
      for (let c = 0; c < channels; c++) {
        buf[o + c] = src[p0 + c] * w0 + src[p1 + c] * w1;
      }
    }
  };
  let cached0 = -1;
  let cached1 = -1;
  for (let y = 0; y < dh; y++) {
    const sy = clipIndex(ay.idx[y], sh);
    const sy1 = clipIndex(ay.idx[y] + 1, sh);
    if (cached0 !== sy) {
      if (cached1 === sy) {
        rowBuf0.set(rowBuf1);
      } else {
        hResize(sy, rowBuf0);
      }
      cached0 = sy;
    }
    if (cached1 !== sy1) {
      hResize(sy1, rowBuf1);
      cached1 = sy1;
    }
    const b0 = ay.a0[y];
    const b1 = ay.a1[y];
    const oRow = y * dw * channels;
    for (let i = 0; i < dw * channels; i++) {
      const v = (b0 * (rowBuf0[i] >> 4) >> 16) + (b1 * (rowBuf1[i] >> 4) >> 16) + 2 >> 2;
      out[oRow + i] = v;
    }
  }
  return { data: out, width: dw, height: dh };
}
function clipIndex(x, size) {
  return x < 0 ? 0 : x >= size ? size - 1 : x;
}
function cropInterleaved(src, sw, x0, y0, x1, y1, channels = 4) {
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return { data: new Uint8ClampedArray(0), width: Math.max(0, w), height: Math.max(0, h) };
  const out = new Uint8ClampedArray(w * h * channels);
  for (let y = 0; y < h; y++) {
    const s = ((y0 + y) * sw + x0) * channels;
    out.set(src.subarray(s, s + w * channels), y * w * channels);
  }
  return { data: out, width: w, height: h };
}
function pyRound(x) {
  const r = Math.round(x);
  if (Math.abs(x % 1) === 0.5) {
    const f = Math.floor(x);
    return f % 2 === 0 ? f : f + 1;
  }
  return r;
}

// src/image/preprocess.ts
function packNchw(rgba, contentW, contentH, planeW, planeH, order, out, outOffset = 0) {
  const planeSize = planeW * planeH;
  const tensor = out ?? new Float32Array(3 * planeSize);
  if (out === void 0) ; else {
    tensor.fill(0, outOffset, outOffset + 3 * planeSize);
  }
  const c0 = order === "rgb" ? 0 : 2;
  const c2 = order === "rgb" ? 2 : 0;
  const inv = 1 / 255;
  for (let y = 0; y < contentH; y++) {
    const srcRow = y * contentW * 4;
    const dstRow = y * planeW;
    for (let x = 0; x < contentW; x++) {
      const s = srcRow + x * 4;
      const d = outOffset + dstRow + x;
      tensor[d] = rgba[s + c0] * inv;
      tensor[d + planeSize] = rgba[s + 1] * inv;
      tensor[d + 2 * planeSize] = rgba[s + c2] * inv;
    }
  }
  return tensor;
}
function preprocessForDetection(rgba, width, height, order) {
  const { DET_WIDTH, DET_HEIGHT } = MODEL_DIMS;
  const scale = Math.min(DET_WIDTH / width, DET_HEIGHT / height);
  const wResized = Math.max(1, Math.trunc(width * scale));
  const hResized = Math.max(1, Math.trunc(height * scale));
  const resized = resizeLinearCv(rgba, width, height, wResized, hResized, 4);
  const tensor = packNchw(resized.data, wResized, hResized, DET_WIDTH, DET_HEIGHT, order);
  const origTargetSizes = new BigInt64Array([
    BigInt(Math.trunc(DET_WIDTH / scale)),
    BigInt(Math.trunc(DET_HEIGHT / scale))
  ]);
  return { tensor, origTargetSizes, scale, resizedWidth: wResized, resizedHeight: hResized };
}
function preprocessHorizontal(rgba, imgW, boxes, indices, order) {
  const { REC_WIDTH, REC_HEIGHT } = MODEL_DIMS;
  const planeSize = REC_WIDTH * REC_HEIGHT;
  const metas = [];
  const tensors = [];
  for (const i of indices) {
    const [x1, y1, x2, y2] = boxes[i];
    const crop = cropInterleaved(rgba, imgW, x1, y1, x2, y2, 4);
    if (crop.width === 0 || crop.height === 0) continue;
    const h = crop.height;
    const w = crop.width;
    let newH = REC_HEIGHT;
    const scale = newH / h;
    let newW = Math.trunc(pyRound(w * scale));
    if (newW > REC_WIDTH) {
      const scaleW = REC_WIDTH / newW;
      newW = REC_WIDTH;
      newH = Math.trunc(pyRound(newH * scaleW));
    }
    if (newW < 1) newW = 1;
    if (newH < 1) newH = 1;
    const resized = resizeLinearCv(crop.data, w, h, newW, newH, 4);
    const t = new Float32Array(3 * planeSize);
    packNchw(resized.data, newW, newH, REC_WIDTH, REC_HEIGHT, order, t, 0);
    tensors.push(t);
    metas.push({ boxIndex: i, origBox: [x1, y1, x2, y2], effectiveW: newW, effectiveH: newH, segmentIdx: 0 });
  }
  if (tensors.length === 0) return null;
  const tensor = new Float32Array(tensors.length * 3 * planeSize);
  tensors.forEach((t, n) => tensor.set(t, n * 3 * planeSize));
  return { tensor, count: tensors.length, planeW: REC_WIDTH, planeH: REC_HEIGHT, metas };
}
function preprocessVertical(rgba, imgW, boxes, indices, order) {
  const { VREC_WIDTH, VREC_HEIGHT, VREC_MAX_CONTENT_HEIGHT, VREC_OVERLAP_PX } = MODEL_DIMS;
  const planeSize = VREC_WIDTH * VREC_HEIGHT;
  const metas = [];
  const tensors = [];
  for (const i of indices) {
    const [x1, y1, x2, y2] = boxes[i];
    const w = x2 - x1;
    const h = y2 - y1;
    if (w <= 0 || h <= 0) continue;
    const scale = VREC_WIDTH / w;
    const hScaledFull = h * scale;
    let maxHScaled;
    let yStarts;
    let segmentHOrig;
    if (hScaledFull > VREC_HEIGHT) {
      maxHScaled = VREC_MAX_CONTENT_HEIGHT;
      segmentHOrig = VREC_MAX_CONTENT_HEIGHT / scale;
      const strideOrig = (VREC_MAX_CONTENT_HEIGHT - VREC_OVERLAP_PX) / scale;
      yStarts = [];
      let currY = y1;
      while (currY + segmentHOrig < y2) {
        yStarts.push(currY);
        currY += strideOrig;
      }
      const lastY = y2 - segmentHOrig;
      if (yStarts.length === 0 || lastY > yStarts[yStarts.length - 1] + 1) {
        yStarts.push(lastY);
      }
    } else {
      maxHScaled = VREC_HEIGHT;
      yStarts = [y1];
      segmentHOrig = y2 - y1;
    }
    for (let segIdx = 0; segIdx < yStarts.length; segIdx++) {
      const sy1f = yStarts[segIdx];
      const sy1 = Math.trunc(pyRound(sy1f));
      let sy2 = Math.trunc(pyRound(sy1f + segmentHOrig));
      sy2 = Math.min(sy2, y2);
      const segCrop = cropInterleaved(rgba, imgW, x1, sy1, x2, sy2, 4);
      const segH = segCrop.height;
      if (segH <= 0) continue;
      let segNewH = Math.min(Math.trunc(pyRound(segH * scale)), maxHScaled);
      if (segNewH < 1) segNewH = 1;
      const resized = resizeLinearCv(segCrop.data, segCrop.width, segH, VREC_WIDTH, segNewH, 4);
      const t = new Float32Array(3 * planeSize);
      packNchw(resized.data, VREC_WIDTH, segNewH, VREC_WIDTH, VREC_HEIGHT, order, t, 0);
      tensors.push(t);
      metas.push({
        boxIndex: i,
        origBox: [x1, sy1, x2, sy2],
        effectiveW: VREC_WIDTH,
        effectiveH: segNewH,
        segmentIdx: segIdx
      });
    }
  }
  if (tensors.length === 0) return null;
  const tensor = new Float32Array(tensors.length * 3 * planeSize);
  tensors.forEach((t, n) => tensor.set(t, n * 3 * planeSize));
  return { tensor, count: tensors.length, planeW: VREC_WIDTH, planeH: VREC_HEIGHT, metas };
}

// src/ocr/detect.ts
function postprocessDetection(out, imgW, imgH, threshold, warnings) {
  const kept = [];
  let dropped = 0;
  for (let k = 0; k < out.count; k++) {
    const s = out.scores[k];
    if (!(s > threshold)) continue;
    const b0 = out.boxes[k * 4];
    const b1 = out.boxes[k * 4 + 1];
    const b2 = out.boxes[k * 4 + 2];
    const b3 = out.boxes[k * 4 + 3];
    if (!Number.isFinite(b0) || !Number.isFinite(b1) || !Number.isFinite(b2) || !Number.isFinite(b3)) {
      dropped++;
      continue;
    }
    const x0 = Math.trunc(clamp(b0, 0, imgW));
    const y0 = Math.trunc(clamp(b1, 0, imgH));
    const x1 = Math.trunc(clamp(b2, 0, imgW));
    const y1 = Math.trunc(clamp(b3, 0, imgH));
    kept.push({ box: [x0, y0, x1, y1], score: s });
  }
  if (dropped > 0) warnings.push(`detector: dropped ${dropped} non-finite box(es)`);
  kept.sort((a, b) => a.box[1] - b.box[1]);
  return kept;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// src/ocr/postprocess.ts
var f32 = Math.fround;
var PUNCT_RE = /^\p{P}$/u;
function labelAt(labels, i) {
  const v = labels[i];
  return typeof v === "bigint" ? Number(v) : v;
}
function buildCandidates(out, metas, recThreshold, isVertical) {
  const byIdx = /* @__PURE__ */ new Map();
  const K = out.perItem;
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    const [gx1, gy1, gx2, gy2] = meta.origBox;
    const cropW = gx2 - gx1;
    const cropH = gy2 - gy1;
    let list = byIdx.get(meta.boxIndex);
    if (!list) {
      list = [];
      byIdx.set(meta.boxIndex, list);
    }
    for (let k = 0; k < K; k++) {
      const scr = out.scores[i * K + k];
      if (scr < recThreshold) continue;
      const code = labelAt(out.labels, i * K + k);
      if (!Number.isInteger(code) || code < 0 || code > 1114111) continue;
      const char = String.fromCodePoint(code);
      const o = (i * K + k) * 4;
      let rx1 = out.boxes[o];
      const ry1i = out.boxes[o + 1];
      let rx2 = out.boxes[o + 2];
      const ry2i = out.boxes[o + 3];
      let ry1 = ry1i;
      let ry2 = ry2i;
      if (![rx1, ry1, rx2, ry2].every(Number.isFinite)) continue;
      if (!isVertical) {
        const effW = meta.effectiveW;
        if (rx1 >= effW) continue;
        rx1 = Math.min(rx1, effW);
        rx2 = Math.min(rx2, effW);
        const cx1 = f32(f32(rx1 / effW) * cropW);
        const cx2 = f32(f32(rx2 / effW) * cropW);
        const cy1 = f32(f32(ry1 / MODEL_DIMS.REC_HEIGHT) * cropH);
        const cy2 = f32(f32(ry2 / MODEL_DIMS.REC_HEIGHT) * cropH);
        const ax1 = gx1 + Math.trunc(cx1);
        const ay1 = gy1 + Math.trunc(cy1);
        const ax2 = gx1 + Math.trunc(cx2);
        const ay2 = gy1 + Math.trunc(cy2);
        list.push({ char, box: [ax1, ay1, ax2, ay2], conf: scr, interval: [ax1, ax2] });
      } else {
        const effH = meta.effectiveH;
        if (ry1 >= effH) continue;
        ry1 = Math.min(ry1, effH);
        ry2 = Math.min(ry2, effH);
        const cx1 = f32(f32(rx1 / MODEL_DIMS.VREC_WIDTH) * cropW);
        const cx2 = f32(f32(rx2 / MODEL_DIMS.VREC_WIDTH) * cropW);
        const cy1 = f32(f32(ry1 / effH) * cropH);
        const cy2 = f32(f32(ry2 / effH) * cropH);
        const ax1 = gx1 + Math.trunc(cx1);
        const ay1 = gy1 + Math.trunc(cy1);
        const ax2 = gx1 + Math.trunc(cx2);
        const ay2 = gy1 + Math.trunc(cy2);
        if (ay2 <= ay1) continue;
        list.push({ char, box: [ax1, ay1, ax2, ay2], conf: scr, interval: [ay1, ay2] });
      }
    }
  }
  return byIdx;
}
function resolveCandidates(candidates, punctConfFactor, isVertical) {
  const overlapThreshold = isVertical ? NMS.Y_OVERLAP_THRESHOLD : NMS.X_OVERLAP_THRESHOLD;
  if (punctConfFactor !== 1) {
    for (const c of candidates) {
      if (PUNCT_RE.test(c.char)) c.conf *= punctConfFactor;
    }
  }
  candidates.sort((a, b) => b.conf - a.conf);
  const accepted = [];
  const acceptedIntervals = [];
  for (const cand of candidates) {
    const [i1c, i2c] = cand.interval;
    const lenC = i2c - i1c + NMS.EPSILON;
    let isOverlap = false;
    for (const [i1a, i2a] of acceptedIntervals) {
      if (i1c >= i2a || i1a >= i2c) continue;
      const interStart = Math.max(i1c, i1a);
      const interEnd = Math.min(i2c, i2a);
      const interLen = Math.max(0, interEnd - interStart);
      const lenA = i2a - i1a + NMS.EPSILON;
      const minLen = Math.min(lenC, lenA);
      if (interLen / minLen > overlapThreshold) {
        isOverlap = true;
        break;
      }
    }
    if (!isOverlap) {
      accepted.push(cand);
      acceptedIntervals.push(cand.interval);
    }
  }
  accepted.sort((a, b) => a.interval[0] - b.interval[0]);
  const chars = accepted.map((c) => ({ char: c.char, box: c.box, conf: c.conf }));
  return fixSwappedPairs(chars);
}
function fixSwappedPairs(chars) {
  const cps = chars.map((c) => c.char);
  for (const [wrong, correct] of SWAPPED_PAIRS) {
    const w = Array.from(wrong);
    const idx = findSeq(cps, w);
    if (idx !== -1 && idx + 1 < chars.length) {
      const c = Array.from(correct);
      const a = chars[idx];
      const b = chars[idx + 1];
      chars[idx] = { char: b.char, box: a.box, conf: a.conf };
      chars[idx + 1] = { char: a.char, box: b.box, conf: b.conf };
      cps[idx] = c[0];
      cps[idx + 1] = c[1];
    }
  }
  return { text: cps.join(""), chars };
}
function findSeq(hay, needle) {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
function toOcrLine(lineId, res) {
  const glyphs = [];
  let utf16 = 0;
  let text = "";
  for (let i = 0; i < res.chars.length; i++) {
    const ch = res.chars[i];
    const start = utf16;
    utf16 += ch.char.length;
    text += ch.char;
    glyphs.push({
      id: `${lineId}g${i}`,
      text: ch.char,
      box: ch.box,
      confidence: ch.conf,
      utf16Start: start,
      utf16End: utf16
    });
  }
  const orientation = res.isVertical ? "vertical" : "horizontal";
  return { id: lineId, text, box: unionBoxes(glyphs.map((g) => g.box)), orientation, glyphs };
}
function unionBoxes(boxes) {
  if (boxes.length === 0) return [0, 0, 0, 0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    if (b[0] < x0) x0 = b[0];
    if (b[1] < y0) y0 = b[1];
    if (b[2] > x1) x1 = b[2];
    if (b[3] > y1) y1 = b[3];
  }
  return [x0, y0, x1, y1];
}

// src/ocr/pipeline.ts
function validateFrame(frame, maxInputPixels) {
  if (!frame || typeof frame !== "object") throw new InvalidInputError("frame must be an object");
  if (typeof frame.frameId !== "string" || frame.frameId.length === 0) {
    throw new InvalidInputError("frame.frameId must be a non-empty string");
  }
  if (!Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width <= 0 || frame.height <= 0) {
    throw new InvalidInputError(`frame dimensions must be positive integers (got ${frame.width}x${frame.height})`);
  }
  if (frame.width * frame.height > maxInputPixels) {
    throw new InputTooLargeError(
      `frame ${frame.width}x${frame.height} exceeds maxInputPixels=${maxInputPixels}; downsample before scanning`
    );
  }
  if (!(frame.rgba instanceof ArrayBuffer)) throw new InvalidInputError("frame.rgba must be an ArrayBuffer");
  const expected = frame.width * frame.height * 4;
  if (frame.rgba.byteLength !== expected) {
    throw new InvalidInputError(`frame.rgba has ${frame.rgba.byteLength} bytes; expected ${expected} (tightly packed RGBA8)`);
  }
}
async function runPipeline(engine, frame, cfg, now = () => performance.now()) {
  validateFrame(frame, cfg.maxInputPixels);
  const t0 = now();
  const params = PROFILES[cfg.profile];
  const warnings = [];
  const rgba = new Uint8Array(frame.rgba);
  const { width, height } = frame;
  const det = preprocessForDetection(rgba, width, height, params.channelOrder);
  const t1 = now();
  const detOut = await engine.detect(det.tensor, det.origTargetSizes);
  const t2 = now();
  const boxes = postprocessDetection(detOut, width, height, params.detThreshold, warnings);
  const results = /* @__PURE__ */ new Map();
  const hIdx = [];
  const vIdx = [];
  const rects = boxes.map((b) => b.box);
  rects.forEach((r, i) => {
    const w = r[2] - r[0];
    const h = r[3] - r[1];
    if (w <= 0 || h <= 0) return;
    if (h > w) vIdx.push(i);
    else hIdx.push(i);
  });
  let recPre = 0;
  let recRun = 0;
  let post = 0;
  const process = async (indices, isVertical, pre, run) => {
    const a = now();
    const batch = pre(indices);
    const b = now();
    recPre += b - a;
    if (!batch) return;
    const planeSize = 3 * batch.planeW * batch.planeH;
    const chunkSize = Math.max(1, Math.min(cfg.recognitionBatchSize, DEFAULTS.maxRecognitionBatchSize));
    const outs = [];
    for (let s = 0; s < batch.count; s += chunkSize) {
      const n = Math.min(chunkSize, batch.count - s);
      const sub = batch.tensor.subarray(s * planeSize, (s + n) * planeSize);
      outs.push(await run(sub, n));
    }
    const c = now();
    recRun += c - b;
    const merged = concatOutputs(outs);
    const cands = buildCandidates(merged, batch.metas, params.recThreshold, isVertical);
    for (const [boxIndex, list] of cands) {
      const resolved = resolveCandidates(list, params.punctConfFactor, isVertical);
      results.set(boxIndex, { boxIndex, text: resolved.text, chars: resolved.chars, isVertical });
      if (!isVertical && countAccepted(merged, boxIndex, batch.metas, params.recThreshold) >= HORIZONTAL_RECOGNIZER_MAX_CHARS) {
        warnings.push(`line ${boxIndex}: horizontal recognizer saturated (${HORIZONTAL_RECOGNIZER_MAX_CHARS} candidates)`);
      }
    }
    post += now() - c;
  };
  if (hIdx.length > 0) {
    await process(
      hIdx,
      false,
      (idx) => preprocessHorizontal(rgba, width, rects, idx, params.channelOrder),
      (b, n) => engine.recognizeHorizontal(b, n)
    );
  }
  if (vIdx.length > 0) {
    if (cfg.verticalEnabled && engine.recognizeVertical) {
      await process(
        vIdx,
        true,
        (idx) => preprocessVertical(rgba, width, rects, idx, params.channelOrder),
        (b, n) => engine.recognizeVertical(b, n)
      );
    } else {
      warnings.push(`vertical recognition disabled; skipped ${vIdx.length} vertical box(es)`);
    }
  }
  const lines = [];
  for (let i = 0; i < rects.length; i++) {
    const r = results.get(i);
    if (!r || r.chars.length === 0) continue;
    lines.push(toOcrLine(`l${i}`, r));
  }
  const t3 = now();
  return {
    frameId: frame.frameId,
    width,
    height,
    profile: cfg.profile,
    lines,
    diagnostics: {
      backend: engine.backend,
      elapsedMs: t3 - t0,
      modelSetId: engine.modelSetId,
      warnings,
      timings: {
        detectPreprocessMs: t1 - t0,
        detectMs: t2 - t1,
        recognizePreprocessMs: recPre,
        recognizeMs: recRun,
        postprocessMs: post
      }
    }
  };
}
function countAccepted(out, boxIndex, metas, thr) {
  let n = 0;
  for (let i = 0; i < metas.length; i++) {
    if (metas[i].boxIndex !== boxIndex) continue;
    for (let k = 0; k < out.perItem; k++) if (out.scores[i * out.perItem + k] >= thr) n++;
  }
  return n;
}
function concatOutputs(outs) {
  if (outs.length === 1) return outs[0];
  const perItem = outs[0].perItem;
  let total = 0;
  for (const o of outs) total += o.scores.length;
  const labels = new Float64Array(total);
  const scores = new Float32Array(total);
  const boxes = new Float32Array(total * 4);
  let off = 0;
  for (const o of outs) {
    const n = o.scores.length;
    for (let i = 0; i < n; i++) {
      const v = o.labels[i];
      labels[off + i] = typeof v === "bigint" ? Number(v) : v;
      scores[off + i] = o.scores[i];
    }
    for (let i = 0; i < n * 4; i++) boxes[off * 4 + i] = o.boxes[i];
    off += n;
  }
  return { labels, scores, boxes, perItem };
}

// src/protocol.ts
var PROTOCOL_VERSION = 1;
var REPLY_TYPES = /* @__PURE__ */ new Set(["ready", "progress", "result", "error", "disposed", "cache-cleared"]);
function isWorkerReply(v) {
  if (!v || typeof v !== "object") return false;
  const o = v;
  return typeof o.type === "string" && REPLY_TYPES.has(o.type) && typeof o.generation === "number";
}
function isSnapshotShape(v) {
  if (!v || typeof v !== "object") return false;
  const s = v;
  return typeof s.frameId === "string" && typeof s.width === "number" && typeof s.height === "number" && Array.isArray(s.lines) && !!s.diagnostics && typeof s.diagnostics.elapsedMs === "number";
}

// src/client.ts
function resolveOptions(o) {
  if (typeof o.assetBaseUrl !== "string" || !o.assetBaseUrl.endsWith("/")) {
    throw new InvalidInputError("assetBaseUrl is required and must end with '/'");
  }
  validateManifest(o.manifest);
  const batch = o.recognitionBatchSize ?? DEFAULTS.recognitionBatchSize;
  return {
    profile: o.profile ?? DEFAULTS.profile,
    execution: o.execution ?? DEFAULTS.execution,
    wasmThreads: o.wasmThreads ?? DEFAULTS.wasmThreads,
    vertical: o.vertical ?? DEFAULTS.vertical,
    recognitionBatchSize: Math.max(1, Math.min(batch, DEFAULTS.maxRecognitionBatchSize)),
    maxInputPixels: o.maxInputPixels ?? DEFAULTS.maxInputPixels,
    persistentCache: o.persistentCache ?? DEFAULTS.persistentCache,
    scanTimeoutMs: o.scanTimeoutMs ?? DEFAULTS.scanTimeoutMs,
    runtimeBaseUrl: o.assetBaseUrl
  };
}
var Client = class {
  profile;
  _backend = "wasm";
  _modelSetId;
  opts;
  resolved;
  factory;
  worker = null;
  generation = 0;
  nextRequestId = 1;
  pending = null;
  cacheClears = /* @__PURE__ */ new Map();
  disposed = false;
  disposing = null;
  readyPromise = null;
  restarts = 0;
  lastFatal = null;
  /** Rejects a pending `start()` (used by dispose). */
  rejectReady = null;
  /**
   * Request the worker is still executing. Set on send, cleared on its result/error.
   * Stays set after an abort: the ORT run does not stop, so the worker is busy
   * until it reports; `scan` rejects with BusyError meanwhile (documented).
   */
  workerBusyRequestId = null;
  constructor(opts, resolved, factory) {
    this.opts = opts;
    this.resolved = resolved;
    this.factory = factory;
    this.profile = resolved.profile;
    this._modelSetId = opts.manifest.modelSetId;
  }
  get backend() {
    return this._backend;
  }
  get modelSetId() {
    return this._modelSetId;
  }
  /** Create a worker and initialise it; resolves when 'ready' arrives. */
  start() {
    if (this.readyPromise) return this.readyPromise;
    this.generation++;
    const generation = this.generation;
    let worker;
    try {
      worker = this.factory();
    } catch (e) {
      const err = e instanceof MeikiOcrError ? e : new WorkerCrashedError(`worker factory failed: ${e?.message ?? e}`, e);
      this.lastFatal = err;
      return Promise.reject(err);
    }
    this.worker = worker;
    this.workerBusyRequestId = null;
    this.readyPromise = new Promise((resolve, reject) => {
      let settled = false;
      const settleReject = (e) => {
        if (settled) return;
        settled = true;
        this.rejectReady = null;
        reject(e);
      };
      this.rejectReady = settleReject;
      worker.onerror = (ev) => {
        const err = new WorkerCrashedError(`worker error: ${ev?.message ?? "unknown"}`);
        this.onFatal(err);
        settleReject(err);
      };
      if ("onmessageerror" in worker) {
        worker.onmessageerror = () => {
          const err = new WorkerProtocolError("worker message could not be deserialized");
          this.onFatal(err);
          settleReject(err);
        };
      }
      worker.onmessage = (ev) => {
        const msg = ev.data;
        if (!isWorkerReply(msg)) {
          this.onFatal(new WorkerProtocolError("malformed worker reply"));
          settleReject(this.lastFatal);
          return;
        }
        if (msg.generation !== this.generation) return;
        this.handleReply(msg, (r) => {
          if (settled) return;
          settled = true;
          this.rejectReady = null;
          resolve(r);
        }, settleReject);
      };
      const init = {
        type: "init",
        protocol: PROTOCOL_VERSION,
        generation,
        manifest: this.opts.manifest,
        assetBaseUrl: this.opts.assetBaseUrl,
        runtimeBaseUrl: this.resolved.runtimeBaseUrl,
        profile: this.resolved.profile,
        execution: this.resolved.execution,
        wasmThreads: this.resolved.wasmThreads,
        vertical: this.resolved.vertical,
        recognitionBatchSize: this.resolved.recognitionBatchSize,
        maxInputPixels: this.resolved.maxInputPixels,
        persistentCache: this.resolved.persistentCache,
        cacheName: DEFAULTS.cacheName
      };
      this.send(init);
    });
    return this.readyPromise;
  }
  send(msg, transfer) {
    this.worker?.postMessage(msg, transfer);
  }
  handleReply(msg, onReady, onInitError) {
    switch (msg.type) {
      case "progress":
        this.opts.onProgress?.(msg.event);
        break;
      case "ready":
        this._backend = msg.backend;
        this._modelSetId = msg.modelSetId;
        this.opts.onProgress?.({ phase: "ready", message: `${msg.backend} (${msg.backendReason}); threads=${msg.threads}` });
        onReady(msg);
        break;
      case "result": {
        if (this.workerBusyRequestId === msg.requestId) this.workerBusyRequestId = null;
        const p = this.pending;
        if (!p || p.requestId !== msg.requestId) return;
        if (!isSnapshotShape(msg.snapshot)) {
          this.settle(p, void 0, new WorkerProtocolError("result snapshot has invalid shape"));
          return;
        }
        this.settle(p, msg.snapshot);
        break;
      }
      case "error": {
        const err = deserializeError(msg.error);
        if (msg.requestId === void 0) {
          this.lastFatal = err;
          this.readyPromise = null;
          onInitError(err);
          if (msg.fatal) this.teardownWorker();
          return;
        }
        if (this.workerBusyRequestId === msg.requestId) this.workerBusyRequestId = null;
        const p = this.pending;
        if (p && p.requestId === msg.requestId) this.settle(p, void 0, err);
        const cc = this.cacheClears.get(msg.requestId);
        if (cc) {
          this.cacheClears.delete(msg.requestId);
          cc.reject(err);
        }
        if (msg.fatal) this.onFatal(new WorkerCrashedError(`fatal worker error: ${err.message}`, err));
        break;
      }
      case "cache-cleared": {
        const cc = this.cacheClears.get(msg.requestId);
        if (cc) {
          this.cacheClears.delete(msg.requestId);
          cc.resolve();
        }
        break;
      }
    }
  }
  settle(p, snapshot, err) {
    if (p.settled) return;
    p.settled = true;
    if (this.pending === p) this.pending = null;
    if (snapshot) p.resolve(snapshot);
    else p.reject(err);
  }
  onFatal(err) {
    this.lastFatal = err;
    if (this.pending) this.settle(this.pending, void 0, err);
    for (const [, cc] of this.cacheClears) cc.reject(err);
    this.cacheClears.clear();
    this.teardownWorker();
    this.readyPromise = null;
  }
  teardownWorker() {
    const w = this.worker;
    this.worker = null;
    this.workerBusyRequestId = null;
    if (w) {
      w.onmessage = null;
      w.onerror = null;
      try {
        w.terminate();
      } catch {
      }
    }
  }
  async scan(frame, options = {}) {
    if (this.disposed) throw new DisposedError();
    if (this.pending) throw new BusyError();
    if (this.workerBusyRequestId !== null) {
      throw new BusyError("worker is still finishing an aborted scan; retry after it reports");
    }
    validateFrame(frame, this.resolved.maxInputPixels);
    if (options.signal?.aborted) throw new AbortedError();
    if (!this.worker) {
      if (this.restarts >= DEFAULTS.maxWorkerRestarts) {
        throw new WorkerCrashedError(
          `worker unavailable after ${this.restarts} restart(s): ${this.lastFatal?.message ?? "unknown"}`,
          this.lastFatal
        );
      }
      this.restarts++;
      await this.start();
    } else if (this.readyPromise) {
      await this.readyPromise;
    }
    if (this.disposed) throw new DisposedError();
    if (this.pending) throw new BusyError();
    if (this.workerBusyRequestId !== null) throw new BusyError("worker is still finishing an aborted scan; retry after it reports");
    if (options.signal?.aborted) throw new AbortedError();
    const requestId = this.nextRequestId++;
    const generation = this.generation;
    const move = options.transfer === "move";
    const rgba = move ? frame.rgba : frame.rgba.slice(0);
    const payload = { ...frame, rgba };
    return new Promise((resolve, reject) => {
      const p = { requestId, resolve, reject, settled: false };
      this.pending = p;
      const onAbort = () => {
        this.send({ type: "cancel", generation, requestId });
        this.settle(p, void 0, new AbortedError());
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      const cleanup = () => options.signal?.removeEventListener("abort", onAbort);
      const origResolve = p.resolve;
      const origReject = p.reject;
      p.resolve = (s) => {
        cleanup();
        origResolve(s);
      };
      p.reject = (e) => {
        cleanup();
        origReject(e);
      };
      this.workerBusyRequestId = requestId;
      if (this.resolved.scanTimeoutMs > 0) {
        const timer = setTimeout(() => {
          if (p.settled || this.pending !== p) return;
          this.onFatal(new WorkerCrashedError(`scan ${requestId} timed out after ${this.resolved.scanTimeoutMs} ms; worker presumed hung`));
        }, this.resolved.scanTimeoutMs);
        const prevResolve = p.resolve;
        const prevReject = p.reject;
        p.resolve = (snap) => {
          clearTimeout(timer);
          prevResolve(snap);
        };
        p.reject = (e) => {
          clearTimeout(timer);
          prevReject(e);
        };
      }
      this.send({ type: "scan", generation, requestId, frame: payload }, [rgba]);
    });
  }
  async clearCache() {
    if (this.disposed) throw new DisposedError();
    if (!this.worker) {
      if (typeof caches !== "undefined") await caches.delete(DEFAULTS.cacheName).catch(() => void 0);
      return;
    }
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.cacheClears.set(requestId, { resolve, reject });
      this.send({ type: "clear-cache", generation: this.generation, requestId });
    });
  }
  dispose() {
    if (this.disposing) return this.disposing;
    this.disposed = true;
    this.disposing = (async () => {
      this.rejectReady?.(new DisposedError("Client disposed during initialization."));
      if (this.pending) this.settle(this.pending, void 0, new DisposedError("Client disposed while scan was in flight."));
      for (const [, cc] of this.cacheClears) cc.reject(new DisposedError());
      this.cacheClears.clear();
      const w = this.worker;
      if (w) {
        this.send({ type: "dispose", generation: this.generation });
        await new Promise((r) => setTimeout(r, 50));
      }
      this.teardownWorker();
      this.readyPromise = null;
    })();
    return this.disposing;
  }
};
function defaultWorkerFactory(opts) {
  if (opts.workerFactory) return () => opts.workerFactory();
  if (opts.worker) {
    let used = false;
    return () => {
      if (used) {
        throw new WorkerCrashedError(
          "the supplied `worker` was terminated after a fatal error and cannot be restarted; pass `workerFactory` to enable bounded restarts"
        );
      }
      used = true;
      return opts.worker;
    };
  }
  return () => {
    const url = opts.workerUrl ?? new URL("./worker.js", import.meta.url);
    return new Worker(url, { type: "module", name: "meikiocr-web" });
  };
}
async function createMeikiOcr(options) {
  return createMeikiOcrWithFactory(options, defaultWorkerFactory(options));
}
async function createMeikiOcrWithFactory(options, factory) {
  const resolved = resolveOptions(options);
  const client = new Client(options, resolved, factory);
  await client.start();
  return client;
}

// src/runtime/capabilities.ts
function detectCapabilities() {
  const g = globalThis;
  return {
    crossOriginIsolated: g.crossOriginIsolated === true,
    sharedArrayBuffer: typeof g.SharedArrayBuffer !== "undefined",
    webgpu: typeof g.navigator?.gpu !== "undefined",
    hardwareConcurrency: g.navigator?.hardwareConcurrency ?? 1
  };
}
function chooseBackend(pref, caps) {
  if (pref === "webgpu") {
    if (caps.webgpu) return { backend: "webgpu", reason: "explicitly requested; navigator.gpu present" };
    return { backend: "wasm", reason: "webgpu requested but navigator.gpu unavailable" };
  }
  if (pref === "auto") {
    return { backend: "wasm", reason: "auto resolves to wasm until webgpu graph validation is recorded" };
  }
  return { backend: "wasm", reason: "explicitly requested" };
}
function effectiveThreads(requested, caps) {
  const req = Math.max(1, Math.floor(requested || 1));
  if (req === 1) return { threads: 1 };
  if (!caps.crossOriginIsolated || !caps.sharedArrayBuffer) {
    return { threads: 1, reason: "multi-threaded wasm requires cross-origin isolation; falling back to 1 thread" };
  }
  return { threads: Math.min(req, Math.max(1, caps.hardwareConcurrency)) };
}

export { AbortedError, AssetError, BusyError, DEFAULTS, DisposedError, HORIZONTAL_RECOGNIZER_MAX_CHARS, InferenceError, InputTooLargeError, InvalidInputError, MODEL_DIMS, MeikiOcrError, ModelSignatureError, NMS, PROFILES, PROTOCOL_VERSION, RuntimeInitError, SWAPPED_PAIRS, UPSTREAM_MODEL_FILES, WorkerCrashedError, WorkerProtocolError, buildCandidates, chooseBackend, createMeikiOcr, createMeikiOcrWithFactory, cropInterleaved, detectCapabilities, effectiveThreads, fixSwappedPairs, packNchw, postprocessDetection, preprocessForDetection, preprocessHorizontal, preprocessVertical, pyRound, resizeLinearCv, resolveAssetUrl, resolveCandidates, resolveOptions, runPipeline, sha256Hex, toOcrLine, unionBoxes, validateFrame, validateManifest };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map