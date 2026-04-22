import './style.css';
import { initializeImageMagick } from '@imagemagick/magick-wasm';
import wasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';
import { createToolbar } from './ui/toolbar.js';
import { createDropzone } from './ui/dropzone.js';
import { createImageList, applyExifOrientation } from './ui/imageList.js';
import { createOptionsPanel } from './ui/optionsPanel.js';
import { store } from './store.js';

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

  // Auto-apply EXIF orientation only to new images
  const processedFiles = new Set<File>();
  store.subscribe(() => {
    const { images } = store.getState();
    images.forEach((entry) => {
      if (!processedFiles.has(entry.file)) {
        processedFiles.add(entry.file);
        applyExifOrientation(entry.file).catch(console.debug);
      }
    });
  });
}

init().catch(console.error);


