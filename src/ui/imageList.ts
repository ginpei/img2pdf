import { store } from '../store.js';
import type { ImageEntry, Rotation } from '../types.js';
import { getOrientation } from '@ginpei/exif-orientation';

interface ImageListOptions {
  onAdd?: () => void;
}

export function createImageList(options: ImageListOptions = {}): HTMLElement {
  const container = document.createElement('div');
  container.className = 'image-list-wrap';

  const header = document.createElement('div');
  header.className = 'image-list__header';

  const title = document.createElement('span');
  title.className = 'image-list__title';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn--ghost btn--sm';
  addBtn.textContent = '+ Add';
  addBtn.hidden = true;
  addBtn.addEventListener('click', () => options.onAdd?.());

  const sortBtn = document.createElement('button');
  sortBtn.className = 'btn btn--ghost btn--sm';
  sortBtn.textContent = 'Sort by name';
  sortBtn.hidden = true;
  sortBtn.addEventListener('click', () => store.sortImagesByName());

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn--ghost btn--sm';
  clearBtn.textContent = 'Remove all';
  clearBtn.hidden = true;
  clearBtn.addEventListener('click', () => {
    if (window.confirm('Remove all images?')) store.clearImages();
  });

  header.appendChild(title);
  header.appendChild(addBtn);
  header.appendChild(sortBtn);
  header.appendChild(clearBtn);

  const list = document.createElement('ul');
  list.className = 'image-list';

  container.appendChild(header);
  container.appendChild(list);

  // Accept file drops on the container when images are already loaded
  container.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      container.classList.add('image-list-wrap--dragover');
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget as Node)) {
      container.classList.remove('image-list-wrap--dragover');
    }
  });

  container.addEventListener('drop', (e) => {
    container.classList.remove('image-list-wrap--dragover');
    if (e.dataTransfer?.files?.length) {
      e.preventDefault();
      store.addImages(Array.from(e.dataTransfer.files));
    }
  });

  store.subscribe(() => render(store.getState().images));

  function render(images: ImageEntry[]): void {
    const count = images.length;
    title.textContent = `${count} image${count !== 1 ? 's' : ''}`;
    addBtn.hidden = count === 0;
    sortBtn.hidden = count === 0;
    clearBtn.hidden = count === 0;
    container.hidden = count === 0;

    list.innerHTML = '';
    images.forEach((entry, idx) => {
      list.appendChild(createItem(entry, idx, images.length));
    });
  }

  render([]);
  return container;
}

function createItem(entry: ImageEntry, idx: number, total: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'image-item';
  li.dataset['id'] = entry.id;

  const thumbImg = document.createElement('img');
  thumbImg.className = 'image-item__thumb';
  thumbImg.src = entry.objectUrl;
  thumbImg.alt = entry.file.name;
  thumbImg.loading = 'lazy';
  // Apply rotation transform: CSS = user_rotate only (EXIF is already baked in by browser)
  if (entry.rotate > 0) {
    thumbImg.style.transform = `rotate(${entry.rotate}deg)`;
  }

  const infoDiv = document.createElement('div');
  infoDiv.className = 'image-item__info';

  const name = document.createElement('span');
  name.className = 'image-item__name';
  name.textContent = entry.file.name;
  name.title = entry.file.name;

  const page = document.createElement('span');
  page.className = 'image-item__page';
  page.textContent = `Page ${idx + 1} of ${total}`;

  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'image-item__controls';

  const rotateBtn = document.createElement('button');
  rotateBtn.className = 'btn btn--ghost btn--sm image-item__rotate-btn';
  rotateBtn.type = 'button';
  rotateBtn.title = 'Rotate 90° clockwise';
  rotateBtn.innerHTML = `⤸ <span>${entry.rotate}°</span>`;
  rotateBtn.addEventListener('click', () => {
    const newRotate = ((entry.rotate + 90) % 360) as Rotation;
    store.updateImageRotate(entry.id, newRotate);
  });

  const moveUpBtn = document.createElement('button');
  moveUpBtn.className = 'btn btn--ghost btn--sm image-item__move-btn';
  moveUpBtn.type = 'button';
  moveUpBtn.textContent = '↑';
  moveUpBtn.title = 'Move up';
  moveUpBtn.disabled = idx === 0;
  moveUpBtn.addEventListener('click', () => store.reorderImages(idx, idx - 1));

  const moveDownBtn = document.createElement('button');
  moveDownBtn.className = 'btn btn--ghost btn--sm image-item__move-btn';
  moveDownBtn.type = 'button';
  moveDownBtn.textContent = '↓';
  moveDownBtn.title = 'Move down';
  moveDownBtn.disabled = idx === total - 1;
  moveDownBtn.addEventListener('click', () => store.reorderImages(idx, idx + 1));

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn--ghost btn--sm image-item__remove';
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remove';
  removeBtn.addEventListener('click', () => {
    store.removeImage(entry.id);
  });

  infoDiv.appendChild(name);
  infoDiv.appendChild(page);

  controlsDiv.appendChild(rotateBtn);
  controlsDiv.appendChild(moveUpBtn);
  controlsDiv.appendChild(moveDownBtn);

  infoDiv.appendChild(controlsDiv);
  infoDiv.appendChild(removeBtn);  // Position at top-right via CSS absolute

  li.appendChild(thumbImg);
  li.appendChild(infoDiv);

  return li;
}

// Auto-detect and apply EXIF orientation on file load
export async function applyExifOrientation(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) return;

  try {
    const info = await getOrientation(file);
    if (info) {
      const entry = store.getState().images.find((e) => e.file === file);
      if (entry) {
        // Store the original EXIF orientation
        store.updateImageExifOrientation(entry.id, info.rotation);
      }
    }
  } catch (err) {
    console.debug('EXIF read error:', err);
  }
}
