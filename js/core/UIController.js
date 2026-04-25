/**
 * UIController — wires DOM events to the ImageProcessor and ToolRegistry.
 *
 * Responsibilities:
 *  - Drag-and-drop / file-input upload
 *  - Tab switching (one tab per registered tool)
 *  - Delegating "process" calls to the active tool
 *  - Reset and Download actions
 *  - Show/hide workspace vs. upload zone
 *
 * No tool-specific knowledge lives here. Adding a new tool = register it;
 * UIController picks it up automatically.
 */
export class UIController {
  /** @type {import('./ImageProcessor.js').ImageProcessor} */ #processor;
  /** @type {import('./ToolRegistry.js').ToolRegistry}     */ #registry;

  /** @type {string|null} */ #activeToolId = null;

  /** @type {HTMLElement} */ #uploadZone;
  /** @type {HTMLInputElement} */ #fileInput;
  /** @type {HTMLElement} */ #workspace;
  /** @type {HTMLElement} */ #toolTabs;
  /** @type {HTMLElement} */ #toolPanel;
  /** @type {HTMLButtonElement} */ #resetBtn;
  /** @type {HTMLButtonElement} */ #downloadBtn;
  /** @type {HTMLButtonElement} */ #browseBtn;

  /** Debounce timer for process calls */
  #processTimer = null;

  /**
   * @param {import('./ImageProcessor.js').ImageProcessor} processor
   * @param {import('./ToolRegistry.js').ToolRegistry}     registry
   */
  constructor(processor, registry) {
    this.#processor = processor;
    this.#registry  = registry;
  }

  init() {
    this.#uploadZone  = document.getElementById('uploadZone');
    this.#fileInput   = document.getElementById('fileInput');
    this.#workspace   = document.getElementById('workspace');
    this.#toolTabs    = document.getElementById('toolTabs');
    this.#toolPanel   = document.getElementById('toolPanel');
    this.#resetBtn    = document.getElementById('resetBtn');
    this.#downloadBtn = document.getElementById('downloadBtn');
    this.#browseBtn   = document.getElementById('browseBtn');

    this.#buildTabs();
    this.#bindUpload();
    this.#bindActions();
  }

  /* ----------------------------------------------------------------
     Tab building
     ---------------------------------------------------------------- */
  #buildTabs() {
    const tools = this.#registry.all();
    if (tools.length === 0) return;

    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.className = 'tool-tab';
      btn.textContent = tool.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.dataset.toolId = tool.id;
      btn.addEventListener('click', () => this.#activateTool(tool.id));
      this.#toolTabs.appendChild(btn);
    });

    // Activate first tool by default
    this.#activateTool(tools[0].id);
  }

  #activateTool(id) {
    this.#activeToolId = id;

    // Update tab states
    this.#toolTabs.querySelectorAll('.tool-tab').forEach(btn => {
      const active = btn.dataset.toolId === id;
      btn.setAttribute('aria-selected', String(active));
    });

    // Render the tool's control panel
    const tool = this.#registry.get(id);
    if (!tool) return;

    this.#toolPanel.innerHTML = '';
    tool.renderPanel(this.#toolPanel, this.#processor);

    // 'change' fires when the slider is released (not on every tick).
    // 'click' covers pill/button selections.
    // 'input' is intentionally omitted — tools handle live preview themselves.
    this.#toolPanel.addEventListener('change', () => this.#scheduleProcess());
    this.#toolPanel.addEventListener('click',  () => this.#scheduleProcess());

    // Apply immediately if image is loaded
    this.#scheduleProcess();
  }

  /* ----------------------------------------------------------------
     Upload handling
     ---------------------------------------------------------------- */
  #bindUpload() {
    // Click on zone or browse button opens file picker
    this.#uploadZone.addEventListener('click', () => this.#fileInput.click());
    this.#browseBtn.addEventListener('click',  e => { e.stopPropagation(); this.#fileInput.click(); });

    this.#fileInput.addEventListener('change', () => {
      if (this.#fileInput.files[0]) this.#loadFile(this.#fileInput.files[0]);
    });

    // Drag and drop
    this.#uploadZone.addEventListener('dragover', e => {
      e.preventDefault();
      this.#uploadZone.classList.add('drag-over');
    });
    this.#uploadZone.addEventListener('dragleave', () => {
      this.#uploadZone.classList.remove('drag-over');
    });
    this.#uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      this.#uploadZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this.#loadFile(file);
    });
  }

  #loadFile(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      this.#processor.load(img);
      URL.revokeObjectURL(url);
      this.#showWorkspace();
      this.#scheduleProcess();
    };
    img.src = url;
  }

  /* ----------------------------------------------------------------
     Actions
     ---------------------------------------------------------------- */
  #bindActions() {
    this.#resetBtn.addEventListener('click', () => {
      this.#processor.reset();
    });

    this.#downloadBtn.addEventListener('click', () => {
      this.#processor.download('lumora-output.png');
    });
  }

  /* ----------------------------------------------------------------
     Processing
     ---------------------------------------------------------------- */
  /**
   * Tiny debounce to batch same-frame slider ticks.
   * Worker-side cancellation (terminate) keeps the UI responsive regardless.
   */
  #scheduleProcess() {
    if (!this.#processor.hasImage) return;
    clearTimeout(this.#processTimer);
    this.#processTimer = setTimeout(() => this.#runProcess(), 30);
  }

  #runProcess() {
    if (!this.#activeToolId) return;
    const tool = this.#registry.get(this.#activeToolId);
    if (tool) tool.process(this.#processor);
  }

  /* ----------------------------------------------------------------
     Visibility helpers
     ---------------------------------------------------------------- */
  #showWorkspace() {
    this.#uploadZone.hidden = true;
    this.#workspace.hidden  = false;
  }
}
