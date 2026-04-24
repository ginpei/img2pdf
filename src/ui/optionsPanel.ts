import { store } from '../store.js';
import type { GlobalOptions, ImageEntry, Orientation, PageSize, ResizeMode } from '../types.js';

interface WorkerImageSource {
  bytes: ArrayBuffer;
  rotate: number;
  exifOrientation: number;
}

interface WorkerProgressMessage {
  type: 'progress';
  requestId: number;
  done: number;
  total: number;
}

interface WorkerResultMessage {
  type: 'result';
  requestId: number;
  pdfBytes: ArrayBuffer;
}

interface WorkerErrorMessage {
  type: 'error';
  requestId: number;
  message: string;
}

type WorkerResponseMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

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

    <!-- Convert -->
    <div class="options-panel__convert-area">
      <!-- Output -->
      <fieldset class="options-group">
        <legend class="options-group__legend">Output</legend>
        <label class="option-row">
          <span class="option-row__label">Filename</span>
          <input type="text" id="opt-filename" class="option-row__control" value="output.pdf" placeholder="output.pdf" />
        </label>
      </fieldset>

      <button class="btn btn--primary" id="opt-convert" type="button" disabled>Convert &amp; Download</button>
      <p class="options-panel__status" id="opt-status" aria-live="polite"></p>
    </div>

    <!-- Copyright -->
    <footer class="options-panel__copyright-area">
      By Ginpei Takanashi
      @
      <a href="http://ginpei.dev">ginpei.dev</a>
    </footer>
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
  const convertBtn = q<HTMLButtonElement>('#opt-convert');
  const statusEl = q<HTMLParagraphElement>('#opt-status');

  // Tracks the locked aspect ratio (W/H); initialized from default values
  let aspectRatio = 1920 / 1080;
  let latestPdfSizeBytes: number | null = null;
  let previewTimer: number | null = null;
  let previewRunId = 0;
  let workerRequestId = 0;
  let cachedPdf: { key: string; blob: Blob } | null = null;
  let inflightGeneration: { key: string; promise: Promise<Blob> } | null = null;

  const pdfWorker = new Worker(new URL('../pdf.worker.ts', import.meta.url), { type: 'module' });

  function makeGenerationKey(images: ImageEntry[], options: GlobalOptions): string {
    const optionsKey = JSON.stringify({
      resizeMode: options.resizeMode,
      resizeWidth: options.resizeWidth,
      resizeHeight: options.resizeHeight,
      resizeLockAspect: options.resizeLockAspect,
      resizePercent: options.resizePercent,
      quality: options.quality,
      grayscale: options.grayscale,
      pageSize: options.pageSize,
      orientation: options.orientation,
    });
    const imagesKey = images
      .map((image) =>
        [
          image.file.name,
          image.file.size,
          image.file.lastModified,
          image.file.type,
          image.rotate,
          image.exifOrientation,
        ].join('|'),
      )
      .join('||');
    return `${optionsKey}::${imagesKey}`;
  }

  async function createWorkerSources(images: ImageEntry[]): Promise<WorkerImageSource[]> {
    return Promise.all(
      images.map(async (image) => ({
        bytes: await image.file.arrayBuffer(),
        rotate: image.rotate,
        exifOrientation: image.exifOrientation,
      })),
    );
  }

  async function generatePdfInWorker(
    images: ImageEntry[],
    options: GlobalOptions,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Blob> {
    const sources = await createWorkerSources(images);
    const requestId = ++workerRequestId;

    return new Promise<Blob>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponseMessage>): void => {
        const data = event.data;
        if (data.requestId !== requestId) return;

        if (data.type === 'progress') {
          onProgress?.(data.done, data.total);
          return;
        }

        pdfWorker.removeEventListener('message', handleMessage);
        if (data.type === 'result') {
          resolve(new Blob([data.pdfBytes], { type: 'application/pdf' }));
          return;
        }
        reject(new Error(data.message));
      };

      pdfWorker.addEventListener('message', handleMessage);
      pdfWorker.postMessage(
        {
          type: 'generate',
          requestId,
          images: sources,
          options,
        },
        sources.map((source) => source.bytes),
      );
    });
  }

  async function ensurePdfBlob(
    key: string,
    images: ImageEntry[],
    options: GlobalOptions,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Blob> {
    if (cachedPdf && cachedPdf.key === key) {
      return cachedPdf.blob;
    }
    if (inflightGeneration && inflightGeneration.key === key) {
      return inflightGeneration.promise;
    }

    const promise = generatePdfInWorker(images, options, onProgress)
      .then((blob) => {
        cachedPdf = { key, blob };
        return blob;
      })
      .finally(() => {
        if (inflightGeneration?.key === key) {
          inflightGeneration = null;
        }
      });

    inflightGeneration = { key, promise };
    return promise;
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIdx = 0;
    while (value >= 1024 && unitIdx < units.length - 1) {
      value /= 1024;
      unitIdx++;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIdx]}`;
  }

  function toggleResizeSubgroups(mode: ResizeMode): void {
    pixelsEl.hidden = mode !== 'pixels';
    percentEl.hidden = mode !== 'percent';
  }

  function toggleOrientationRow(size: PageSize): void {
    orientationRowEl.hidden = size === 'fit';
  }

  function setStatus(msg: string, showPdfSize = true): void {
    if (!msg) {
      statusEl.textContent = '';
      return;
    }
    const sizeText = showPdfSize && latestPdfSizeBytes !== null ? ` · PDF ${formatBytes(latestPdfSizeBytes)}` : '';
    statusEl.textContent = `${msg}${sizeText}`;
  }

  function schedulePreview(): void {
    if (previewTimer !== null) {
      window.clearTimeout(previewTimer);
    }
    previewTimer = window.setTimeout(() => {
      previewTimer = null;
      void runPreview();
    }, 250);
  }

  async function runPreview(): Promise<void> {
    const runId = ++previewRunId;
    const { images, options } = store.getState();
    if (images.length === 0) {
      latestPdfSizeBytes = null;
      setStatus('');
      return;
    }

    const key = makeGenerationKey(images, options);
    if (cachedPdf && cachedPdf.key === key) {
      latestPdfSizeBytes = cachedPdf.blob.size;
      setStatus(`Estimated ${images.length} page${images.length !== 1 ? 's' : ''}`);
      return;
    }

    setStatus(`Estimating ${0} / ${images.length}…`, false);
    try {
      const blob = await ensurePdfBlob(key, images, options, (done, total) => {
        if (runId !== previewRunId) return;
        setStatus(`Estimating ${done} / ${total}…`, false);
      });
      if (runId !== previewRunId) return;
      latestPdfSizeBytes = blob.size;
      setStatus(`Estimated ${images.length} page${images.length !== 1 ? 's' : ''}`);
    } catch (err) {
      if (runId !== previewRunId) return;
      console.error(err);
      setStatus('Estimate failed');
    }
  }

  modeEl.addEventListener('change', () => {
    const mode = modeEl.value as ResizeMode;
    toggleResizeSubgroups(mode);
    store.updateOptions({ resizeMode: mode });
  });

  wEl.addEventListener('input', () => {
    const w = Math.max(1, parseInt(wEl.value) || 1);
    if (lockEl.checked && aspectRatio > 0) {
      const newH = Math.max(1, Math.round(w / aspectRatio));
      hEl.value = String(newH);
      store.updateOptions({ resizeWidth: w, resizeHeight: newH });
    } else {
      store.updateOptions({ resizeWidth: w });
    }
  });

  hEl.addEventListener('input', () => {
    const h = Math.max(1, parseInt(hEl.value) || 1);
    if (lockEl.checked && aspectRatio > 0) {
      const newW = Math.max(1, Math.round(h * aspectRatio));
      wEl.value = String(newW);
      store.updateOptions({ resizeWidth: newW, resizeHeight: h });
    } else {
      store.updateOptions({ resizeHeight: h });
    }
  });

  lockEl.addEventListener('change', () => {
    store.updateOptions({ resizeLockAspect: lockEl.checked });
    if (lockEl.checked) {
      const w = parseInt(wEl.value) || 1;
      const h = parseInt(hEl.value) || 1;
      if (h > 0) aspectRatio = w / h;
    }
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

  store.subscribe((event) => {
    const { images } = store.getState();
    convertBtn.disabled = images.length === 0;
    if (images.length === 0) {
      latestPdfSizeBytes = null;
      setStatus('');
      return;
    }
    if (event.kind !== 'images:reorder') {
      schedulePreview();
    }
  });

  convertBtn.addEventListener('click', async () => {
    const { images, options } = store.getState();
    if (images.length === 0) return;
    const key = makeGenerationKey(images, options);

    convertBtn.disabled = true;
    setStatus(`Processing 0 / ${images.length}…`, false);

    try {
      const blob = await ensurePdfBlob(key, images, options, (done, total) => {
        setStatus(`Processing ${done} / ${total}…`, false);
      });
      latestPdfSizeBytes = blob.size;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = options.outputFilename;
      a.click();
      URL.revokeObjectURL(url);

      setStatus(`Done — ${images.length} page${images.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      setStatus('Error: conversion failed. See console.');
    } finally {
      convertBtn.disabled = store.getState().images.length === 0;
    }
  });

  // Init visibility
  toggleResizeSubgroups('none');
  toggleOrientationRow('fit');
  void runPreview();

  return panel;
}
