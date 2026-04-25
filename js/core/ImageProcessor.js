/**
 * ImageProcessor — canvas-backed image state manager.
 *
 * Responsibilities:
 *  - Hold the original ImageData (never mutated).
 *  - Expose a mutable working ImageData for tools to write into.
 *  - Render the working copy to a visible <canvas>.
 *  - Provide a download() helper.
 */
export class ImageProcessor {
  /** @type {HTMLCanvasElement} */ #canvas;
  /** @type {CanvasRenderingContext2D} */ #ctx;
  /** @type {ImageData|null} */ #original = null;
  /** @type {ImageData|null} */ #working  = null;

  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx    = canvas.getContext('2d', { willReadFrequently: true });
  }

  /** Load an Image or ImageBitmap into the processor. */
  load(imageSource) {
    const { naturalWidth: w, naturalHeight: h } = imageSource;
    this.#canvas.width  = w;
    this.#canvas.height = h;
    this.#ctx.drawImage(imageSource, 0, 0);
    this.#original = this.#ctx.getImageData(0, 0, w, h);
    this.#working  = this.#ctx.getImageData(0, 0, w, h);
  }

  /**
   * Live drag preview: sets a CSS filter on the canvas.
   * clip-path:inset(0) is applied alongside the filter — it runs AFTER the
   * filter in the CSS render pipeline, hard-clipping the blur bleed to the
   * canvas boundary so it never bleeds into the background.
   * @param {string} cssFilter  e.g. 'blur(8px)'
   */
  setLiveFilter(cssFilter) {
    this.#canvas.style.filter   = cssFilter;
    this.#canvas.style.clipPath = 'inset(0)';
  }

  /** Remove the CSS live-preview filter (called before commit / reset). */
  clearLiveFilter() {
    this.#canvas.style.filter   = '';
    this.#canvas.style.clipPath = '';
  }

  get width()  { return this.#canvas.width; }
  get height() { return this.#canvas.height; }
  get hasImage() { return this.#original !== null; }

  /**
   * Returns a fresh copy of the original pixels for tools to work on.
   * @returns {ImageData}
   */
  getOriginalData() {
    return new ImageData(
      new Uint8ClampedArray(this.#original.data),
      this.#original.width,
      this.#original.height,
    );
  }

  /**
   * Commit processed ImageData to the canvas.
   * Clears any live CSS filter first so the real pixels show through cleanly.
   * @param {ImageData} imageData
   */
  commit(imageData) {
    this.clearLiveFilter();
    this.#working = imageData;
    this.#ctx.putImageData(imageData, 0, 0);
  }

  /** Reset canvas back to the original image. */
  reset() {
    if (!this.#original) return;
    this.clearLiveFilter();
    this.#working = new ImageData(
      new Uint8ClampedArray(this.#original.data),
      this.#original.width,
      this.#original.height,
    );
    this.#ctx.putImageData(this.#working, 0, 0);
  }

  /**
   * Download the current canvas as a PNG.
   * @param {string} [filename]
   */
  download(filename = 'lumora-output.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.#canvas.toDataURL('image/png');
    link.click();
  }
}
