/**
 * ToolRegistry — central registry for image tool plugins.
 *
 * Each tool is a plain object that satisfies the ITool interface:
 *
 *   {
 *     id:          string          — unique slug, e.g. "blur"
 *     label:       string          — tab display name, e.g. "Blur"
 *     renderPanel: (container) => void   — renders controls into the given element
 *     process:     (ImageProcessor) => void  — applies the effect to the processor
 *   }
 *
 * Adding a new tool = one ToolRegistry.register() call in app.js. Nothing else
 * needs to change.
 */
export class ToolRegistry {
  /** @type {Map<string, ITool>} */
  #tools = new Map();

  /**
   * @param {ITool} tool
   */
  register(tool) {
    if (!tool.id || !tool.label || typeof tool.renderPanel !== 'function' || typeof tool.process !== 'function') {
      throw new Error(`ToolRegistry: tool "${tool.id}" must implement { id, label, renderPanel, process }`);
    }
    this.#tools.set(tool.id, tool);
  }

  /** @returns {ITool[]} */
  all() {
    return [...this.#tools.values()];
  }

  /** @param {string} id @returns {ITool|undefined} */
  get(id) {
    return this.#tools.get(id);
  }
}
