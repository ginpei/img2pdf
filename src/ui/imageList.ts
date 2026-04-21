import { store } from '../store.js';
import type { ImageEntry, Rotation } from '../types.js';

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
  li.draggable = true;
  li.dataset['id'] = entry.id;

  li.innerHTML = `
    <span class="image-item__drag-handle" title="Drag to reorder">⠿</span>
    <img class="image-item__thumb" src="${entry.objectUrl}" alt="${entry.file.name}" loading="lazy" />
    <span class="image-item__name" title="${entry.file.name}">${entry.file.name}</span>
    <span class="image-item__page">p.${idx + 1}/${total}</span>
    <button class="btn btn--ghost btn--sm image-item__rotate-btn" type="button" title="Rotate 90° clockwise">⤸ <span>${entry.rotate}°</span></button>
    <button class="btn btn--ghost btn--sm image-item__remove" type="button" title="Remove">✕</button>
  `;

  li.querySelector<HTMLButtonElement>('.image-item__rotate-btn')!.addEventListener('click', () => {
    const newRotate = ((entry.rotate + 90) % 360) as Rotation;
    store.updateImageRotate(entry.id, newRotate);
  });

  li.querySelector<HTMLButtonElement>('.image-item__remove')!.addEventListener('click', () => {
    store.removeImage(entry.id);
  });

  // Drag-to-reorder: use dataTransfer to pass source index across items
  li.addEventListener('dragstart', (e) => {
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', String(idx));
    li.classList.add('image-item--dragging');
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('image-item--dragging');
    document.querySelectorAll('.image-item--dragover').forEach((el) => {
      el.classList.remove('image-item--dragover');
    });
  });

  li.addEventListener('dragover', (e) => {
    // Only show drop target for reorder drags, not OS file drops
    if (!e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
      li.classList.add('image-item--dragover');
    }
  });

  li.addEventListener('dragleave', () => {
    li.classList.remove('image-item--dragover');
  });

  li.addEventListener('drop', (e) => {
    li.classList.remove('image-item--dragover');
    if (e.dataTransfer?.types.includes('Files')) {
      // OS file drop — prevent default but let it bubble to container
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const fromIdx = parseInt(e.dataTransfer!.getData('text/plain'));
    if (!isNaN(fromIdx) && fromIdx !== idx) {
      store.reorderImages(fromIdx, idx);
    }
  });

  return li;
}

