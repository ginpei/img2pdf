import { store } from '../store.js';
import { generatePdf } from '../pdf.js';

export function createToolbar(): HTMLElement {
  const toolbar = document.createElement('header');
  toolbar.className = 'toolbar';

  toolbar.innerHTML = `
    <h1 class="toolbar__title">img2pdf</h1>
    <div class="toolbar__actions">
      <span class="toolbar__status" id="toolbar-status" aria-live="polite"></span>
      <button class="btn btn--primary" id="toolbar-convert" type="button" disabled>Convert &amp; Download</button>
    </div>
  `;

  const convertBtn = toolbar.querySelector<HTMLButtonElement>('#toolbar-convert')!;
  const statusEl = toolbar.querySelector<HTMLSpanElement>('#toolbar-status')!;

  store.subscribe(() => {
    const { images } = store.getState();
    convertBtn.disabled = images.length === 0;
  });

  convertBtn.addEventListener('click', async () => {
    const { images, options } = store.getState();
    if (images.length === 0) return;

    convertBtn.disabled = true;
    setStatus(`Processing 0 / ${images.length}…`);

    try {
      const blob = await generatePdf(images, options, (done, total) => {
        setStatus(`Processing ${done} / ${total}…`);
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = options.outputFilename;
      a.click();
      URL.revokeObjectURL(url);

      setStatus(`Done — ${images.length} page${images.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      setStatus('Error: conversion failed. See console for details.');
    } finally {
      convertBtn.disabled = store.getState().images.length === 0;
    }
  });

  function setStatus(msg: string): void {
    statusEl.textContent = msg;
  }

  return toolbar;
}
