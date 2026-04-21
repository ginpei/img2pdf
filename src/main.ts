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
  content.appendChild(createDropzone());
  content.appendChild(createImageList());

  main.appendChild(content);
  main.appendChild(createOptionsPanel());
  app.appendChild(main);
}

init().catch(console.error);
