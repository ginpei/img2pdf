import type { GlobalOptions, ImageEntry, Rotation } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

interface State {
  images: ImageEntry[];
  options: GlobalOptions;
}

type Listener = () => void;

const state: State = {
  images: [],
  options: { ...DEFAULT_OPTIONS },
};

const listeners = new Set<Listener>();

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

function getState(): Readonly<State> {
  return state;
}

function addImages(files: File[]): void {
  const newEntries: ImageEntry[] = files
    .filter((f) => f.type.startsWith('image/'))
    .map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      objectUrl: URL.createObjectURL(f),
      rotate: 0 as Rotation,
    }));
  state.images = [...state.images, ...newEntries];
  notify();
}

function removeImage(id: string): void {
  const entry = state.images.find((e) => e.id === id);
  if (entry) URL.revokeObjectURL(entry.objectUrl);
  state.images = state.images.filter((e) => e.id !== id);
  notify();
}

function clearImages(): void {
  state.images.forEach((e) => URL.revokeObjectURL(e.objectUrl));
  state.images = [];
  notify();
}

function reorderImages(fromIdx: number, toIdx: number): void {
  if (fromIdx === toIdx) return;
  const imgs = [...state.images];
  const [moved] = imgs.splice(fromIdx, 1);
  imgs.splice(toIdx, 0, moved);
  state.images = imgs;
  notify();
}

function updateImageRotate(id: string, rotate: Rotation): void {
  state.images = state.images.map((e) => (e.id === id ? { ...e, rotate } : e));
  notify();
}

function updateOptions(patch: Partial<GlobalOptions>): void {
  state.options = { ...state.options, ...patch };
  notify();
}

function sortImagesByName(): void {
  state.images = [...state.images].sort((a, b) =>
    a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
  notify();
}

export const store = {
  subscribe,
  getState,
  addImages,
  removeImage,
  clearImages,
  reorderImages,
  updateImageRotate,
  updateOptions,
  sortImagesByName,
};
