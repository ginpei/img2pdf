import { store } from '../store.js';
import type { ImageEntry, Rotation } from '../types.js';
import { getOrientation } from '@ginpei/exif-orientation';

interface ImageListOptions {
  onAdd?: () => void;
}

// Track which item was just moved for animation
let movedItemId: string | null = null;
let moveDirection: 'up' | 'down' | null = null;
let dragSourceId: string | null = null;

const expandedItemIds = new Set<string>();
const imageSizeById = new Map<string, { width: number; height: number }>();

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

  const collapseAllBtn = document.createElement('button');
  collapseAllBtn.className = 'btn btn--ghost btn--sm';
  collapseAllBtn.hidden = true;
  collapseAllBtn.addEventListener('click', () => {
    const images = store.getState().images;
    const allExpanded = images.length > 0 && images.every((image) => expandedItemIds.has(image.id));
    if (allExpanded) {
      expandedItemIds.clear();
    } else {
      images.forEach((image) => expandedItemIds.add(image.id));
    }
    render(images);
  });

  header.appendChild(title);
  header.appendChild(addBtn);
  header.appendChild(collapseAllBtn);
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
    const imageIds = new Set(images.map((image) => image.id));
    [...expandedItemIds].forEach((id) => {
      if (!imageIds.has(id)) expandedItemIds.delete(id);
    });
    [...imageSizeById.keys()].forEach((id) => {
      if (!imageIds.has(id)) imageSizeById.delete(id);
    });

    const count = images.length;
    title.textContent = `${count} image${count !== 1 ? 's' : ''}`;
    addBtn.hidden = count === 0;
    collapseAllBtn.hidden = count === 0;
    sortBtn.hidden = count === 0;
    clearBtn.hidden = count === 0;
    container.hidden = count === 0;
    const allExpanded = count > 0 && images.every((image) => expandedItemIds.has(image.id));
    collapseAllBtn.textContent = allExpanded ? '▾ Collapse all' : '▸ Expand all';

    list.innerHTML = '';
    images.forEach((entry, idx) => {
      list.appendChild(
        createItem(entry, idx, images.length, expandedItemIds.has(entry.id), () => {
          render(store.getState().images);
        }),
      );
      if (!imageSizeById.has(entry.id)) {
        const loader = new Image();
        loader.onload = () => {
          imageSizeById.set(entry.id, { width: loader.naturalWidth, height: loader.naturalHeight });
          if (store.getState().images.some((image) => image.id === entry.id)) {
            render(store.getState().images);
          }
        };
        loader.src = entry.objectUrl;
      }
    });
  }

  render([]);
  return container;
}

function createItem(
  entry: ImageEntry,
  idx: number,
  total: number,
  isExpanded: boolean,
  onToggleExpand: () => void,
): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'image-item';
  li.dataset['id'] = entry.id;
  if (isExpanded) li.classList.add('image-item--expanded');

  // Add animation class if this item just moved
  if (movedItemId === entry.id) {
    const direction = moveDirection === 'down' ? 'slideInFromDown' : 'slideInFromUp';
    li.classList.add(direction);
    // Clear the flag after animation completes
    setTimeout(() => {
      movedItemId = null;
      moveDirection = null;
    }, 300);
  }

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

  const leftRail = document.createElement('div');
  leftRail.className = 'image-item__left-rail';

  const dragHandle = document.createElement('button');
  dragHandle.className = 'image-item__drag-handle';
  dragHandle.type = 'button';
  dragHandle.title = 'Drag to reorder';
  dragHandle.textContent = '⋮⋮';

  const expandBtn = document.createElement('button');
  expandBtn.className = 'btn btn--ghost btn--sm image-item__expand-btn';
  expandBtn.type = 'button';
  expandBtn.title = isExpanded ? 'Collapse' : 'Expand';
  expandBtn.textContent = isExpanded ? '▾' : '▸';
  expandBtn.addEventListener('click', () => {
    if (expandedItemIds.has(entry.id)) {
      expandedItemIds.delete(entry.id);
    } else {
      expandedItemIds.add(entry.id);
    }
    onToggleExpand();
  });

  const name = document.createElement('span');
  name.className = 'image-item__name';
  name.textContent = entry.file.name;
  name.title = entry.file.name;

  const page = document.createElement('span');
  page.className = 'image-item__page';
  page.textContent = `Page ${idx + 1} of ${total}`;

  const dimensions = imageSizeById.get(entry.id);
  const metaLine = document.createElement('span');
  metaLine.className = 'image-item__meta';
  metaLine.textContent = dimensions
    ? `${dimensions.width} × ${dimensions.height} px · ${formatBytes(entry.file.size)}`
    : `loading… · ${formatBytes(entry.file.size)}`;

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
  moveUpBtn.addEventListener('click', () => {
    movedItemId = entry.id;
    moveDirection = 'up';
    store.reorderImages(idx, idx - 1);
  });

  const moveDownBtn = document.createElement('button');
  moveDownBtn.className = 'btn btn--ghost btn--sm image-item__move-btn';
  moveDownBtn.type = 'button';
  moveDownBtn.textContent = '↓';
  moveDownBtn.title = 'Move down';
  moveDownBtn.disabled = idx === total - 1;
  moveDownBtn.addEventListener('click', () => {
    movedItemId = entry.id;
    moveDirection = 'down';
    store.reorderImages(idx, idx + 1);
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn--ghost btn--sm image-item__remove';
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remove';
  removeBtn.addEventListener('click', () => {
    li.classList.add('image-item--removing');
    li.addEventListener('animationend', () => {
      store.removeImage(entry.id);
    }, { once: true });
  });

  li.draggable = false;
  dragHandle.addEventListener('pointerdown', () => {
    li.draggable = true;
  });
  dragHandle.addEventListener('pointerup', () => {
    li.draggable = false;
  });
  li.addEventListener('dragstart', (event) => {
    if (!li.draggable) {
      event.preventDefault();
      return;
    }
    dragSourceId = entry.id;
    li.classList.add('image-item--dragging');
    event.dataTransfer?.setData('text/plain', entry.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });
  li.addEventListener('dragover', (event) => {
    if (!dragSourceId || dragSourceId === entry.id) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    li.classList.add('image-item--dragover');
  });
  li.addEventListener('dragleave', () => {
    li.classList.remove('image-item--dragover');
  });
  li.addEventListener('drop', (event) => {
    event.preventDefault();
    li.classList.remove('image-item--dragover');
    if (!dragSourceId || dragSourceId === entry.id) return;

    const images = store.getState().images;
    const fromIdx = images.findIndex((item) => item.id === dragSourceId);
    const toIdx = images.findIndex((item) => item.id === entry.id);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    movedItemId = dragSourceId;
    moveDirection = fromIdx < toIdx ? 'down' : 'up';
    store.reorderImages(fromIdx, toIdx);
  });
  li.addEventListener('dragend', () => {
    dragSourceId = null;
    li.draggable = false;
    li.classList.remove('image-item--dragging');
    document.querySelectorAll('.image-item--dragover').forEach((target) => {
      target.classList.remove('image-item--dragover');
    });
  });

  leftRail.appendChild(expandBtn);
  leftRail.appendChild(dragHandle);

  infoDiv.appendChild(name);
  infoDiv.appendChild(metaLine);

  controlsDiv.appendChild(rotateBtn);
  controlsDiv.appendChild(moveUpBtn);
  controlsDiv.appendChild(moveDownBtn);
  controlsDiv.appendChild(page);

  infoDiv.appendChild(controlsDiv);
  infoDiv.appendChild(removeBtn);  // Position at top-right via CSS absolute

  li.appendChild(leftRail);
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
