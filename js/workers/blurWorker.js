/**
 * blurWorker.js — runs blur algorithms off the main thread.
 * Classic worker (no ES module imports needed — everything is self-contained).
 *
 * Expected message: { type, pixels: ArrayBuffer, width, height, intensity }
 * Posted reply:     { pixels: ArrayBuffer }  (buffer ownership transferred back)
 */

/* ---- 1-D Gaussian kernel ---- */
function gaussianKernel1D(radius) {
  const size   = radius * 2 + 1;
  const sigma  = Math.max(1, radius / 2.5);
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return kernel;
}

/* ---- Separable convolution (horizontal then vertical) ---- */
function separableConvolve(src, w, h, kernel) {
  const radius = (kernel.length - 1) / 2;
  const tmp    = new Float32Array(src.length);
  const dst    = new Uint8ClampedArray(src.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < kernel.length; k++) {
        const sx  = Math.max(0, Math.min(w - 1, x + k - radius));
        const idx = (y * w + sx) * 4;
        const wt  = kernel[k];
        r += src[idx] * wt; g += src[idx+1] * wt;
        b += src[idx+2] * wt; a += src[idx+3] * wt;
      }
      const di = (y * w + x) * 4;
      tmp[di] = r; tmp[di+1] = g; tmp[di+2] = b; tmp[di+3] = a;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < kernel.length; k++) {
        const sy  = Math.max(0, Math.min(h - 1, y + k - radius));
        const idx = (sy * w + x) * 4;
        const wt  = kernel[k];
        r += tmp[idx] * wt; g += tmp[idx+1] * wt;
        b += tmp[idx+2] * wt; a += tmp[idx+3] * wt;
      }
      const di = (y * w + x) * 4;
      dst[di] = r; dst[di+1] = g; dst[di+2] = b; dst[di+3] = a;
    }
  }
  return dst;
}

function applyGaussian(src, w, h, intensity) {
  const radius = Math.max(1, Math.round(intensity * 0.4));
  return separableConvolve(src, w, h, gaussianKernel1D(radius));
}

function applyBox(src, w, h, intensity) {
  const radius = Math.max(1, Math.round(intensity * 0.4));
  const size   = radius * 2 + 1;
  const kernel = new Float32Array(size).fill(1 / size);
  return separableConvolve(src, w, h, kernel);
}

function applyMotion(src, w, h, intensity) {
  const dst  = new Uint8ClampedArray(src.length);
  const half = Math.floor(intensity / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let k = -half; k <= half; k++) {
        const sx  = Math.max(0, Math.min(w - 1, x + k));
        const idx = (y * w + sx) * 4;
        r += src[idx]; g += src[idx+1]; b += src[idx+2]; a += src[idx+3];
        count++;
      }
      const di = (y * w + x) * 4;
      dst[di] = r/count; dst[di+1] = g/count; dst[di+2] = b/count; dst[di+3] = a/count;
    }
  }
  return dst;
}

function applyRadial(src, w, h, intensity) {
  const dst     = new Uint8ClampedArray(src.length);
  const cx      = w / 2;
  const cy      = h / 2;
  const samples = Math.max(4, Math.round(intensity / 4));
  const zoom    = (intensity / 100) * 0.35;   // max 35% zoom spread at intensity 100
  const step    = zoom / samples;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let s = 0; s < samples; s++) {
        const t  = 1 - s * step;
        const bx = Math.max(0, Math.min(w - 1, Math.round(cx + (x - cx) * t)));
        const by = Math.max(0, Math.min(h - 1, Math.round(cy + (y - cy) * t)));
        const idx = (by * w + bx) * 4;
        r += src[idx]; g += src[idx+1]; b += src[idx+2]; a += src[idx+3];
      }
      const di = (y * w + x) * 4;
      dst[di] = r/samples; dst[di+1] = g/samples; dst[di+2] = b/samples; dst[di+3] = a/samples;
    }
  }
  return dst;
}

/* ---- Message handler ---- */
self.onmessage = function (e) {
  const { type, pixels, width, height, intensity } = e.data;
  const src = new Uint8ClampedArray(pixels);

  let result;
  switch (type) {
    case 'gaussian': result = applyGaussian(src, width, height, intensity); break;
    case 'box':      result = applyBox(src, width, height, intensity);      break;
    case 'motion':   result = applyMotion(src, width, height, intensity);   break;
    case 'radial':   result = applyRadial(src, width, height, intensity);   break;
    default:         result = src;
  }

  self.postMessage({ pixels: result.buffer }, [result.buffer]);
};
