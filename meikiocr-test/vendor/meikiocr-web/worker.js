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
function serializeError(err) {
  if (err instanceof MeikiOcrError) {
    return { code: err.code, message: err.message, name: err.name };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: "INFERENCE_FAILED", message, name: "Error" };
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
function findModel(m, role) {
  return m.models.find((a) => a.role === role);
}
async function sha256Hex(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const buf = view.byteOffset === 0 && view.byteLength === view.buffer.byteLength ? view.buffer : view.slice().buffer;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyBytes(asset, bytes) {
  if (bytes.byteLength !== asset.byteLength) {
    throw new AssetError(
      "ASSET_INTEGRITY_FAILED",
      `${asset.path}: byte length ${bytes.byteLength} != expected ${asset.byteLength}`
    );
  }
  const actual = await sha256Hex(bytes);
  if (actual.toLowerCase() !== asset.sha256.toLowerCase()) {
    throw new AssetError("ASSET_INTEGRITY_FAILED", `${asset.path}: sha256 ${actual} != expected ${asset.sha256}`);
  }
}

// src/assets/cache.ts
var AssetCache = class {
  cacheName;
  persistent;
  fetchImpl;
  onProgress;
  memory = /* @__PURE__ */ new Map();
  constructor(opts) {
    this.cacheName = opts.cacheName ?? DEFAULTS.cacheName;
    this.persistent = opts.persistent && typeof caches !== "undefined";
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
    this.onProgress = opts.onProgress;
  }
  keyFor(asset) {
    return `https://meikiocr-web.invalid/${this.cacheName}/${asset.sha256.toLowerCase()}`;
  }
  async openCache() {
    if (!this.persistent) return null;
    try {
      return await caches.open(this.cacheName);
    } catch {
      return null;
    }
  }
  async load(asset, url) {
    const mem = this.memory.get(asset.sha256);
    if (mem) return mem;
    const cache = await this.openCache();
    if (cache) {
      try {
        const hit = await cache.match(this.keyFor(asset));
        if (hit) {
          const bytes2 = await hit.arrayBuffer();
          this.onProgress?.({ phase: "verifying", asset: asset.path, loadedBytes: bytes2.byteLength, totalBytes: asset.byteLength });
          try {
            await verifyBytes(asset, bytes2);
            this.memory.set(asset.sha256, bytes2);
            return bytes2;
          } catch {
            await cache.delete(this.keyFor(asset)).catch(() => void 0);
          }
        }
      } catch {
      }
    }
    const bytes = await this.fetchWithProgress(asset, url);
    this.onProgress?.({ phase: "verifying", asset: asset.path, loadedBytes: bytes.byteLength, totalBytes: asset.byteLength });
    await verifyBytes(asset, bytes);
    this.memory.set(asset.sha256, bytes);
    if (cache) {
      try {
        await cache.put(
          this.keyFor(asset),
          new Response(bytes.slice(0), {
            headers: {
              "content-type": "application/octet-stream",
              "content-length": String(bytes.byteLength),
              "x-meikiocr-asset": asset.path
            }
          })
        );
      } catch {
      }
    }
    return bytes;
  }
  async fetchWithProgress(asset, url) {
    let res;
    try {
      res = await this.fetchImpl(url, { credentials: "same-origin" });
    } catch (e) {
      throw new AssetError("ASSET_FETCH_FAILED", `${asset.path}: network error fetching ${url}`, e);
    }
    if (res.status === 404) throw new AssetError("ASSET_MISSING", `${asset.path}: 404 at ${url}`);
    if (!res.ok) throw new AssetError("ASSET_FETCH_FAILED", `${asset.path}: HTTP ${res.status} at ${url}`);
    const total = asset.byteLength;
    this.onProgress?.({ phase: "fetching", asset: asset.path, loadedBytes: 0, totalBytes: total });
    if (!res.body) {
      const buf = await res.arrayBuffer();
      this.onProgress?.({ phase: "fetching", asset: asset.path, loadedBytes: buf.byteLength, totalBytes: total });
      return buf;
    }
    const reader = res.body.getReader();
    const out = new Uint8Array(total);
    let loaded = 0;
    let lastReport = 0;
    for (; ; ) {
      let step;
      try {
        step = await reader.read();
      } catch (e) {
        throw new AssetError("ASSET_FETCH_FAILED", `${asset.path}: connection interrupted after ${loaded} of ${total} bytes`, e);
      }
      const { done, value } = step;
      if (done) break;
      if (!value) continue;
      if (loaded + value.byteLength > total) {
        const grown = new Uint8Array(loaded + value.byteLength);
        grown.set(out.subarray(0, loaded));
        grown.set(value, loaded);
        loaded += value.byteLength;
        return this.drain(reader, grown, loaded, asset, total);
      }
      out.set(value, loaded);
      loaded += value.byteLength;
      if (loaded - lastReport > 262144 || loaded === total) {
        lastReport = loaded;
        this.onProgress?.({ phase: "fetching", asset: asset.path, loadedBytes: loaded, totalBytes: total });
      }
    }
    if (loaded !== total) {
      throw new AssetError("ASSET_INTEGRITY_FAILED", `${asset.path}: received ${loaded} bytes, expected ${total} (interrupted?)`);
    }
    return out.buffer;
  }
  async drain(reader, acc, loaded, asset, total) {
    for (; ; ) {
      let step;
      try {
        step = await reader.read();
      } catch (e) {
        throw new AssetError("ASSET_FETCH_FAILED", `${asset.path}: connection interrupted after ${loaded} bytes`, e);
      }
      const { done, value } = step;
      if (done) break;
      if (value) {
        loaded += value.byteLength;
      }
    }
    throw new AssetError("ASSET_INTEGRITY_FAILED", `${asset.path}: received ${loaded} bytes, expected ${total}`);
  }
  /** Remove only this library's cache namespace. Never touches other caches. */
  async clear() {
    this.memory.clear();
    if (typeof caches === "undefined") return;
    try {
      await caches.delete(this.cacheName);
    } catch {
    }
  }
};

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
  let post2 = 0;
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
    post2 += now() - c;
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
        postprocessMs: post2
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

// src/runtime/session.ts
function configureOrtEnv(ort, cfg) {
  ort.env.wasm.wasmPaths = cfg.runtimeBaseUrl;
  ort.env.wasm.numThreads = Math.max(1, cfg.wasmThreads | 0);
  ort.env.wasm.proxy = false;
  ort.env.logLevel = "error";
}
async function createSession(ort, bytes, backend, label) {
  const providers = backend === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
  try {
    return await ort.InferenceSession.create(bytes, {
      executionProviders: providers,
      graphOptimizationLevel: "all",
      // Mirror upstream: disable spinning so an idle worker does not burn CPU.
      extra: {
        session: {
          intra_op: { allow_spinning: "0" },
          inter_op: { allow_spinning: "0" }
        }
      }
    });
  } catch (e) {
    throw new RuntimeInitError(`failed to create ${label} session on ${backend}: ${e?.message ?? e}`, e);
  }
}
function assertSignature(s, label, inputs, outputs) {
  const missingIn = inputs.filter((n) => !s.inputNames.includes(n));
  const missingOut = outputs.filter((n) => !s.outputNames.includes(n));
  if (missingIn.length || missingOut.length) {
    throw new ModelSignatureError(
      `${label}: unexpected signature. inputs=${JSON.stringify(s.inputNames)} outputs=${JSON.stringify(s.outputNames)}; missing inputs=${JSON.stringify(missingIn)} outputs=${JSON.stringify(missingOut)}`
    );
  }
  const meta = s.inputMetadata;
  if (Array.isArray(meta)) {
    const expect = {
      images: { type: "float32", rank: 4 },
      orig_target_sizes: { type: "int64", rank: 2 }
    };
    for (const m of meta) {
      const want = expect[m.name];
      if (!want || !m.isTensor) continue;
      if (m.type !== want.type || m.shape && m.shape.length !== want.rank) {
        throw new ModelSignatureError(
          `${label}: input '${m.name}' is ${m.type}${m.shape ? `[${m.shape.join(",")}]` : ""}, expected ${want.type} rank ${want.rank}`
        );
      }
    }
  }
}
var SIGNATURES = Object.freeze({
  detector: { inputs: ["images", "orig_target_sizes"], outputs: ["labels", "boxes", "scores"] },
  recognizer: { inputs: ["images", "orig_target_sizes"], outputs: ["char_codes", "boxes", "scores"] }
});
var OrtEngine = class {
  backend;
  modelSetId;
  ort;
  sessions;
  recognizeVertical;
  constructor(ort, sessions, backend, modelSetId) {
    this.ort = ort;
    this.sessions = sessions;
    this.backend = backend;
    this.modelSetId = modelSetId;
    assertSignature(sessions.detector, "detector", SIGNATURES.detector.inputs, SIGNATURES.detector.outputs);
    assertSignature(sessions.recognizerH, "recognizer-horizontal", SIGNATURES.recognizer.inputs, SIGNATURES.recognizer.outputs);
    if (sessions.recognizerV) {
      assertSignature(sessions.recognizerV, "recognizer-vertical", SIGNATURES.recognizer.inputs, SIGNATURES.recognizer.outputs);
      this.recognizeVertical = (batch, count) => this.runRecognizer(sessions.recognizerV, batch, count, MODEL_DIMS.VREC_WIDTH, MODEL_DIMS.VREC_HEIGHT);
    }
  }
  attachVertical(session) {
    assertSignature(session, "recognizer-vertical", SIGNATURES.recognizer.inputs, SIGNATURES.recognizer.outputs);
    this.sessions.recognizerV = session;
    this.recognizeVertical = (batch, count) => this.runRecognizer(session, batch, count, MODEL_DIMS.VREC_WIDTH, MODEL_DIMS.VREC_HEIGHT);
  }
  async detect(tensor, origTargetSizes) {
    const { Tensor } = this.ort;
    const feeds = {
      images: new Tensor("float32", tensor, [1, 3, MODEL_DIMS.DET_HEIGHT, MODEL_DIMS.DET_WIDTH]),
      orig_target_sizes: new Tensor("int64", origTargetSizes, [1, 2])
    };
    let out;
    try {
      out = await this.sessions.detector.run(feeds);
    } catch (e) {
      throw new InferenceError(`detector run failed: ${e?.message ?? e}`, e);
    }
    const boxes = out["boxes"];
    const scores = out["scores"];
    const count = Number(scores.dims[1] ?? 0);
    return {
      boxes: boxes.data,
      scores: scores.data,
      count
    };
  }
  recognizeHorizontal(batch, count) {
    return this.runRecognizer(this.sessions.recognizerH, batch, count, MODEL_DIMS.REC_WIDTH, MODEL_DIMS.REC_HEIGHT);
  }
  async runRecognizer(session, batch, count, w, h) {
    const { Tensor } = this.ort;
    const feeds = {
      images: new Tensor("float32", batch, [count, 3, h, w]),
      orig_target_sizes: new Tensor("int64", new BigInt64Array([BigInt(w), BigInt(h)]), [1, 2])
    };
    let out;
    try {
      out = await session.run(feeds);
    } catch (e) {
      throw new InferenceError(`recognizer run failed: ${e?.message ?? e}`, e);
    }
    const codes = out["char_codes"];
    const boxes = out["boxes"];
    const scores = out["scores"];
    const perItem = Number(scores.dims[1] ?? 0);
    return {
      labels: codes.data,
      boxes: boxes.data,
      scores: scores.data,
      perItem
    };
  }
  async release() {
    const all = [this.sessions.detector, this.sessions.recognizerH, this.sessions.recognizerV].filter(Boolean);
    await Promise.allSettled(all.map((s) => s.release()));
  }
};

// src/worker.ts
var state = {
  generation: 0,
  init: null,
  ort: null,
  engine: null,
  cache: null,
  pipeline: null,
  activeRequestId: null,
  cancelled: /* @__PURE__ */ new Set(),
  disposed: false,
  verticalLoading: null
};
var scope = self;
function post(msg, transfer) {
  scope.postMessage(msg);
}
function fail(generation, error, fatal, requestId) {
  const reply = {
    type: "error",
    generation,
    error: serializeError(error),
    fatal,
    ...requestId !== void 0 ? { requestId } : {}
  };
  post(reply);
}
async function loadModel(req, cache, role) {
  const asset = findModel(req.manifest, role);
  if (!asset) throw new AssetError("ASSET_MISSING", `manifest lacks ${role}`);
  const url = resolveAssetUrl(req.assetBaseUrl, asset.path);
  const bytes = await cache.load(asset, url);
  return new Uint8Array(bytes);
}
async function handleInit(req) {
  state.generation = req.generation;
  state.init = req;
  state.disposed = false;
  validateManifest(req.manifest);
  const caps = detectCapabilities();
  const chosen = chooseBackend(req.execution, caps);
  const threads = effectiveThreads(req.wasmThreads, caps);
  const warnings = [];
  if (threads.reason) warnings.push(threads.reason);
  const cache = new AssetCache({
    cacheName: req.cacheName,
    persistent: req.persistentCache,
    onProgress: (event) => post({ type: "progress", generation: req.generation, event })
  });
  state.cache = cache;
  const ort = await import('onnxruntime-web');
  state.ort = ort;
  configureOrtEnv(ort, { backend: chosen.backend, wasmThreads: threads.threads, runtimeBaseUrl: req.runtimeBaseUrl });
  const [detBytes, recBytes] = await Promise.all([
    loadModel(req, cache, "detector"),
    loadModel(req, cache, "recognizer-horizontal")
  ]);
  post({ type: "progress", generation: req.generation, event: { phase: "initializing", message: "creating sessions" } });
  let backend = chosen.backend;
  let backendReason = chosen.reason;
  const tryCreate = async (b) => {
    const detector = await createSession(ort, detBytes, b, "detector");
    const recognizerH = await createSession(ort, recBytes, b, "recognizer-horizontal");
    return new OrtEngine(ort, { detector, recognizerH }, b, req.manifest.modelSetId);
  };
  let engine;
  try {
    engine = await tryCreate(backend);
  } catch (e) {
    if (backend === "webgpu") {
      backendReason = `webgpu session creation failed (${e.message}); fell back to wasm`;
      warnings.push(backendReason);
      backend = "wasm";
      engine = await tryCreate("wasm");
    } else {
      throw e;
    }
  }
  state.engine = engine;
  state.pipeline = {
    profile: req.profile,
    recognitionBatchSize: req.recognitionBatchSize,
    maxInputPixels: req.maxInputPixels,
    verticalEnabled: req.vertical !== "off"
  };
  post({
    type: "ready",
    generation: req.generation,
    backend,
    backendReason,
    threads: threads.threads,
    modelSetId: req.manifest.modelSetId,
    warnings
  });
}
function isRuntimeTrap(e) {
  if (typeof WebAssembly !== "undefined" && e instanceof WebAssembly.RuntimeError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /abort\(|RuntimeError|memory access out of bounds|unreachable/i.test(msg);
}
function engineWithLazyVertical(engine) {
  if (!state.init || state.init.vertical === "off") {
    return { backend: engine.backend, modelSetId: engine.modelSetId, detect: engine.detect.bind(engine), recognizeHorizontal: engine.recognizeHorizontal.bind(engine) };
  }
  return {
    backend: engine.backend,
    modelSetId: engine.modelSetId,
    detect: engine.detect.bind(engine),
    recognizeHorizontal: engine.recognizeHorizontal.bind(engine),
    recognizeVertical: async (batch, count) => {
      if (!engine.recognizeVertical) {
        if (!state.verticalLoading) {
          state.verticalLoading = (async () => {
            const req = state.init;
            const bytes = await loadModel(req, state.cache, "recognizer-vertical");
            const session = await createSession(state.ort, bytes, engine.backend, "recognizer-vertical");
            engine.attachVertical(session);
          })().finally(() => {
            state.verticalLoading = null;
          });
        }
        await state.verticalLoading;
      }
      return engine.recognizeVertical(batch, count);
    }
  };
}
async function handleScan(generation, requestId, frame) {
  if (!state.engine || !state.pipeline) {
    fail(generation, new MeikiOcrError("RUNTIME_INIT_FAILED", "worker not initialized"), false, requestId);
    return;
  }
  if (state.activeRequestId !== null) {
    fail(generation, new MeikiOcrError("BUSY", "worker busy"), false, requestId);
    return;
  }
  state.activeRequestId = requestId;
  try {
    const snapshot = await runPipeline(engineWithLazyVertical(state.engine), frame, state.pipeline);
    if (state.cancelled.delete(requestId) || state.disposed) {
      fail(generation, new AbortedError(), false, requestId);
      return;
    }
    post({ type: "result", generation, requestId, snapshot });
  } catch (e) {
    state.cancelled.delete(requestId);
    const fatal = e instanceof MeikiOcrError ? e.code === "WORKER_CRASHED" : isRuntimeTrap(e);
    fail(generation, e, fatal, requestId);
  } finally {
    state.activeRequestId = null;
  }
}
async function handleDispose(generation) {
  state.disposed = true;
  const engine = state.engine;
  state.engine = null;
  state.pipeline = null;
  if (engine) await engine.release().catch(() => void 0);
  post({ type: "disposed", generation });
  scope.close();
}
scope.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
  switch (msg.type) {
    case "init":
      handleInit(msg).catch((e) => fail(msg.generation, e, true));
      break;
    case "scan":
      if (msg.generation !== state.generation) return;
      void handleScan(msg.generation, msg.requestId, msg.frame);
      break;
    case "cancel":
      if (msg.generation !== state.generation) return;
      if (state.activeRequestId === msg.requestId) state.cancelled.add(msg.requestId);
      break;
    case "clear-cache":
      (state.cache?.clear() ?? Promise.resolve()).then(() => post({ type: "cache-cleared", generation: msg.generation, requestId: msg.requestId })).catch((e) => fail(msg.generation, e, false, msg.requestId));
      break;
    case "dispose":
      void handleDispose(msg.generation);
      break;
  }
};

export { DEFAULTS };
//# sourceMappingURL=worker.js.map
//# sourceMappingURL=worker.js.map