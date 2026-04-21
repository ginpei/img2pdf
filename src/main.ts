import './style.css';
import { initializeImageMagick } from '@imagemagick/magick-wasm';
import wasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';
import { createToolbar } from './ui/toolbar.js';
import { createDropzone } from './ui/dropzone.js';
import { createImageList } from './ui/imageList.js';
import { createOptionsPanel } from './ui/optionsPanel.js';

async function init(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app')!;

  const loading = document.createElement('div');
  loading.className = 'loading-overlay';
  loading.innerHTML = '<span class="loading-overlay__text">Initialising ImageMagick…</span>';
  app.appendChild(loading);

  await initializeImageMagick(new URL(wasmUrl, location.href));

  loading.remove();

  app.appendChild(createToolbar());

  const main = document.createElement('div');
  main.className = 'main-layout';

  const content = document.createElement('div');
  content.className = 'main-layout__content';

  const { element: dropzoneEl, openFilePicker } = createDropzone();
  content.appendChild(dropzoneEl);
  content.appendChild(createImageList({ onAdd: openFilePicker }));

  main.appendChild(content);
  main.appendChild(createOptionsPanel());
  app.appendChild(main);

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML =
    '© <a href="https://ginpei.dev" target="_blank" rel="noopener noreferrer">Ginpei Takanashi</a>';
  app.appendChild(footer);
}

init().catch(console.error);

