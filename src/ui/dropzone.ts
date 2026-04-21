import { store } from '../store.js';

export function createDropzone(): HTMLElement {
  const zone = document.createElement('div');
  zone.className = 'dropzone';
  zone.innerHTML = `
    <div class="dropzone__inner">
      <svg class="dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
      </svg>
      <p class="dropzone__label">Drop images here or <button class="dropzone__browse" type="button">browse files</button></p>
      <p class="dropzone__hint">JPEG, PNG, WebP, GIF, BMP, TIFF and more</p>
    </div>
  `;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  zone.appendChild(input);

  zone.querySelector<HTMLButtonElement>('.dropzone__browse')!.addEventListener('click', () => {
    input.click();
  });

  input.addEventListener('change', () => {
    if (input.files?.length) {
      store.addImages(Array.from(input.files));
      input.value = '';
    }
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dropzone--over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dropzone--over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dropzone--over');
    const files = e.dataTransfer?.files;
    if (files?.length) store.addImages(Array.from(files));
  });

  return zone;
}
