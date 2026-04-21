import { store } from '../store.js';
import type { ImageEntry, Rotation } from '../types.js';

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

export function createImageList(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'image-list-wrap';

  const header = document.createElement('div');
  header.className = 'image-list__header';

  const title = document.createElement('span');
  title.className = 'image-list__title';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn--ghost btn--sm';
  clearBtn.textContent = 'Remove all';
  clearBtn.addEventListener('click', () => store.clearImages());

  header.appendChild(title);
  header.appendChild(clearBtn);

  const list = document.createElement('ul');
  list.className = 'image-list';

  container.appendChild(header);
  container.appendChild(list);

  store.subscribe(() => render(store.getState().images));

  function render(images: ImageEntry[]): void {
    const count = images.length;
    title.textContent = `${count} image${count !== 1 ? 's' : ''}`;
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
  li.dataset['idx'] = String(idx);

  li.innerHTML = `
    <span class="image-item__drag-handle" title="Drag to reorder">⠿</span>
    <img class="image-item__thumb" src="${entry.objectUrl}" alt="${entry.file.name}" loading="lazy" />
    <span class="image-item__name" title="${entry.file.name}">${entry.file.name}</span>
    <span class="image-item__page">Page ${idx + 1} of ${total}</span>
    <label class="image-item__label">Rotate
      <select class="image-item__rotate">
        ${ROTATIONS.map((r) => `<option value="${r}"${r === entry.rotate ? ' selected' : ''}>${r}°</option>`).join('')}
      </select>
    </label>
    <button class="btn btn--ghost btn--sm image-item__remove" type="button" title="Remove">✕</button>
  `;

  li.querySelector<HTMLSelectElement>('.image-item__rotate')!.addEventListener('change', (e) => {
    const val = parseInt((e.target as HTMLSelectElement).value) as Rotation;
    store.updateImageRotate(entry.id, val);
  });

  li.querySelector<HTMLButtonElement>('.image-item__remove')!.addEventListener('click', () => {
    store.removeImage(entry.id);
  });

  // Drag-to-reorder
  let dragStartIdx = -1;

  li.addEventListener('dragstart', (e) => {
    dragStartIdx = idx;
    e.dataTransfer!.effectAllowed = 'move';
    li.classList.add('image-item--dragging');
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('image-item--dragging');
    document.querySelectorAll('.image-item--dragover').forEach((el) => {
      el.classList.remove('image-item--dragover');
    });
  });

  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    li.classList.add('image-item--dragover');
  });

  li.addEventListener('dragleave', () => {
    li.classList.remove('image-item--dragover');
  });

  li.addEventListener('drop', (e) => {
    e.preventDefault();
    li.classList.remove('image-item--dragover');
    const toIdx = idx;
    if (dragStartIdx !== -1 && dragStartIdx !== toIdx) {
      store.reorderImages(dragStartIdx, toIdx);
    }
    dragStartIdx = -1;
  });

  return li;
}
