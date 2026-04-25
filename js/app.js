/**
 * app.js — Lumora bootstrap.
 *
 * This is the ONLY place where tools are registered.
 * To add a new tool:
 *   1. Create  js/tools/MyTool.js  (satisfying the ITool interface)
 *   2. Import it here
 *   3. registry.register(MyTool)
 *
 * That's it — no other files need to change.
 */

import { ImageProcessor } from './core/ImageProcessor.js';
import { ToolRegistry }   from './core/ToolRegistry.js';
import { UIController }   from './core/UIController.js';

// ── Tools ──────────────────────────────────────────────────────────
import { BlurTool } from './tools/BlurTool.js';

// ── Bootstrap ──────────────────────────────────────────────────────
const canvas    = document.getElementById('previewCanvas');
const processor = new ImageProcessor(canvas);
const registry  = new ToolRegistry();

// Register tools (order determines tab order)
registry.register(BlurTool);
// registry.register(BrightnessTool);  ← future tools added here
// registry.register(SharpenTool);

const ui = new UIController(processor, registry);
ui.init();
