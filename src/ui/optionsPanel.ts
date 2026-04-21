import { store } from '../store.js';
import type { Orientation, PageSize, ResizeMode } from '../types.js';

export function createOptionsPanel(): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'options-panel';

  panel.innerHTML = `
    <h2 class="options-panel__title">Options</h2>

    <!-- Resize -->
    <fieldset class="options-group">
      <legend class="options-group__legend">Resize</legend>
      <label class="option-row">
        <span class="option-row__label">Mode</span>
        <select class="option-row__control" id="opt-resize-mode">
          <option value="none">None</option>
          <option value="pixels">By pixels</option>
          <option value="percent">By percent</option>
        </select>
      </label>
      <div id="opt-resize-pixels" class="option-subgroup" hidden>
        <label class="option-row">
          <span class="option-row__label">Width (px)</span>
          <input type="number" id="opt-resize-w" class="option-row__control" min="1" max="10000" value="1920" />
        </label>
        <label class="option-row">
          <span class="option-row__label">Height (px)</span>
          <input type="number" id="opt-resize-h" class="option-row__control" min="1" max="10000" value="1080" />
        </label>
        <label class="option-row">
          <input type="checkbox" id="opt-resize-lock" checked />
          <span class="option-row__label">Lock aspect ratio</span>
        </label>
      </div>
      <div id="opt-resize-percent" class="option-subgroup" hidden>
        <label class="option-row">
          <span class="option-row__label">Scale (%)</span>
          <input type="number" id="opt-resize-pct" class="option-row__control" min="1" max="500" value="100" />
        </label>
      </div>
    </fieldset>

    <!-- Quality -->
    <fieldset class="options-group">
      <legend class="options-group__legend">Quality</legend>
      <label class="option-row">
        <span class="option-row__label">JPEG quality <span id="opt-quality-val">85</span></span>
        <input type="range" id="opt-quality" class="option-row__control" min="1" max="100" value="85" />
      </label>
    </fieldset>

    <!-- Image adjustments -->
    <fieldset class="options-group">
      <legend class="options-group__legend">Adjustments</legend>
      <label class="option-row">
        <input type="checkbox" id="opt-grayscale" />
        <span class="option-row__label">Convert to grayscale</span>
      </label>
    </fieldset>

    <!-- Page -->
    <fieldset class="options-group">
      <legend class="options-group__legend">Page</legend>
      <label class="option-row">
        <span class="option-row__label">Size</span>
        <select id="opt-page-size" class="option-row__control">
          <option value="fit">Fit to image</option>
          <option value="a4">A4</option>
          <option value="letter">US Letter</option>
        </select>
      </label>
      <label class="option-row" id="opt-orientation-row">
        <span class="option-row__label">Orientation</span>
        <select id="opt-orientation" class="option-row__control">
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
    </fieldset>

    <!-- Output -->
    <fieldset class="options-group">
      <legend class="options-group__legend">Output</legend>
      <label class="option-row">
        <span class="option-row__label">Filename</span>
        <input type="text" id="opt-filename" class="option-row__control" value="output.pdf" placeholder="output.pdf" />
      </label>
    </fieldset>
  `;

  function q<T extends HTMLElement>(sel: string): T {
    return panel.querySelector<T>(sel)!;
  }

  const modeEl = q<HTMLSelectElement>('#opt-resize-mode');
  const pixelsEl = q<HTMLDivElement>('#opt-resize-pixels');
  const percentEl = q<HTMLDivElement>('#opt-resize-percent');
  const wEl = q<HTMLInputElement>('#opt-resize-w');
  const hEl = q<HTMLInputElement>('#opt-resize-h');
  const lockEl = q<HTMLInputElement>('#opt-resize-lock');
  const pctEl = q<HTMLInputElement>('#opt-resize-pct');
  const qualityEl = q<HTMLInputElement>('#opt-quality');
  const qualityValEl = q<HTMLSpanElement>('#opt-quality-val');
  const grayscaleEl = q<HTMLInputElement>('#opt-grayscale');
  const pageSizeEl = q<HTMLSelectElement>('#opt-page-size');
  const orientationRowEl = q<HTMLLabelElement>('#opt-orientation-row');
  const orientationEl = q<HTMLSelectElement>('#opt-orientation');
  const filenameEl = q<HTMLInputElement>('#opt-filename');

  function toggleResizeSubgroups(mode: ResizeMode): void {
    pixelsEl.hidden = mode !== 'pixels';
    percentEl.hidden = mode !== 'percent';
  }

  function toggleOrientationRow(size: PageSize): void {
    orientationRowEl.hidden = size === 'fit';
  }

  modeEl.addEventListener('change', () => {
    const mode = modeEl.value as ResizeMode;
    toggleResizeSubgroups(mode);
    store.updateOptions({ resizeMode: mode });
  });

  wEl.addEventListener('input', () => {
    store.updateOptions({ resizeWidth: Math.max(1, parseInt(wEl.value) || 1) });
  });

  hEl.addEventListener('input', () => {
    store.updateOptions({ resizeHeight: Math.max(1, parseInt(hEl.value) || 1) });
  });

  lockEl.addEventListener('change', () => {
    store.updateOptions({ resizeLockAspect: lockEl.checked });
  });

  pctEl.addEventListener('input', () => {
    store.updateOptions({ resizePercent: Math.max(1, parseInt(pctEl.value) || 1) });
  });

  qualityEl.addEventListener('input', () => {
    const val = parseInt(qualityEl.value);
    qualityValEl.textContent = String(val);
    store.updateOptions({ quality: val });
  });

  grayscaleEl.addEventListener('change', () => {
    store.updateOptions({ grayscale: grayscaleEl.checked });
  });

  pageSizeEl.addEventListener('change', () => {
    const size = pageSizeEl.value as PageSize;
    toggleOrientationRow(size);
    store.updateOptions({ pageSize: size });
  });

  orientationEl.addEventListener('change', () => {
    store.updateOptions({ orientation: orientationEl.value as Orientation });
  });

  filenameEl.addEventListener('input', () => {
    let name = filenameEl.value.trim() || 'output.pdf';
    if (!name.endsWith('.pdf')) name += '.pdf';
    store.updateOptions({ outputFilename: name });
  });

  // Init visibility
  toggleResizeSubgroups('none');
  toggleOrientationRow('fit');

  return panel;
}
