/**
 * BlurTool — image tool plugin for Lumora.
 *
 * Blur types: gaussian, box, motion, radial.
 *
 * All pixel computation runs in a Web Worker so the main thread (and the
 * slider) stay fully responsive. Any in-flight worker is terminated
 * immediately when a new request arrives — the most-recent settings win.
 */

const BLUR_TYPES = [
  { id: 'gaussian', label: 'Gaussian' },
  { id: 'box',      label: 'Box'      },
  { id: 'motion',   label: 'Motion'   },
  { id: 'radial',   label: 'Radial'   },
];

let selectedType = BLUR_TYPES[0].id;
let intensity    = 20;

/** @type {Worker|null} worker currently computing a blur */
let _activeWorker = null;

export const BlurTool = {
  id:    'blur',
  label: '✦ Blur',

  /**
   * @param {HTMLElement} container
   * @param {import('../core/ImageProcessor.js').ImageProcessor} processor
   */
  renderPanel(container, processor) {
    container.innerHTML = /* html */`
      <div class="control-group">
        <label>Blur Type</label>
        <div class="pill-selector" id="blurTypePicker">
          ${BLUR_TYPES.map(t => `
            <button
              class="pill${t.id === selectedType ? ' active' : ''}"
              data-type="${t.id}"
              aria-pressed="${t.id === selectedType}"
            >${t.label}</button>
          `).join('')}
        </div>
      </div>
      <div class="control-group">
        <label>Intensity</label>
        <div class="slider-row">
          <input type="range" id="blurIntensity" min="0" max="100" value="${intensity}" />
          <span class="slider-value" id="blurIntensityValue">${intensity}</span>
        </div>
      </div>
    `;

    container.querySelector('#blurTypePicker').addEventListener('click', e => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      selectedType = btn.dataset.type;
      container.querySelectorAll('.pill').forEach(p => {
        p.classList.toggle('active', p.dataset.type === selectedType);
        p.setAttribute('aria-pressed', p.dataset.type === selectedType);
      });
    });

    const slider = container.querySelector('#blurIntensity');
    const label  = container.querySelector('#blurIntensityValue');

    // On every slider tick: update label + apply CSS filter on the element.
    // Setting style.filter costs ~0ms — no canvas redraw, no pixel work.
    // The slider therefore never lags regardless of image size.
    slider.addEventListener('input', () => {
      intensity = Number(slider.value);
      label.textContent = intensity;
      if (!processor.hasImage) return;
      if (intensity === 0) {
        processor.clearLiveFilter();
      } else {
        // Match the worker's effective sigma: radius = intensity*0.4, sigma = radius/2.5
        // → CSS blur sigma = intensity * 0.16
        const sigma = Math.max(0.5, intensity * 0.16).toFixed(2);
        processor.setLiveFilter(`blur(${sigma}px)`);
      }
    });
    // slider 'change' (release) → UIController calls process() → accurate worker result.
  },

  /**
   * Offloads blur to a Web Worker. Terminates any previous in-flight worker
   * instantly so the UI never waits on a stale computation.
   * @param {import('../core/ImageProcessor.js').ImageProcessor} processor
   */
  process(processor) {
    if (!processor.hasImage) return;

    // Kill the previous computation immediately — slider stays free
    if (_activeWorker) {
      _activeWorker.terminate();
      _activeWorker = null;
    }

    const loader = document.getElementById('canvasLoader');

    // intensity = 0 → show original, no worker needed
    if (intensity === 0) {
      processor.commit(processor.getOriginalData());
      if (loader) loader.hidden = true;
      return;
    }

    const original = processor.getOriginalData(); // fresh copy for each call
    const { width, height } = original;

    if (loader) loader.hidden = false;

    const worker = new Worker(
      new URL('../workers/blurWorker.js', import.meta.url),
    );
    _activeWorker = worker;

    worker.onmessage = (e) => {
      _activeWorker = null;
      worker.terminate();
      if (loader) loader.hidden = true;
      const result = new ImageData(new Uint8ClampedArray(e.data.pixels), width, height);
      processor.commit(result);
    };

    worker.onerror = () => {
      _activeWorker = null;
      worker.terminate();
      if (loader) loader.hidden = true;
    };

    // Transfer the pixel buffer (zero-copy) to the worker
    worker.postMessage(
      { type: selectedType, pixels: original.data.buffer, width, height, intensity },
      [original.data.buffer],
    );
  },
};
