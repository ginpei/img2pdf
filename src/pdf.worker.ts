/// <reference lib="webworker" />

import { initializeImageMagick } from '@imagemagick/magick-wasm';
import wasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';
import { generatePdfFromSources } from './pdf.js';
import type { GlobalOptions } from './types.js';

interface WorkerImageSource {
  bytes: ArrayBuffer;
  rotate: number;
  exifOrientation: number;
}

interface GenerateMessage {
  type: 'generate';
  requestId: number;
  images: WorkerImageSource[];
  options: GlobalOptions;
}

let magickReady: Promise<void> | null = null;

function ensureMagick(): Promise<void> {
  if (!magickReady) {
    magickReady = initializeImageMagick(new URL(wasmUrl, self.location.href));
  }
  return magickReady;
}

self.addEventListener('message', async (event: MessageEvent<GenerateMessage>) => {
  const data = event.data;
  if (data.type !== 'generate') return;

  try {
    await ensureMagick();
    const pdfBytes = generatePdfFromSources(
      data.images.map((source) => ({
        bytes: new Uint8Array(source.bytes),
        rotate: source.rotate,
        exifOrientation: source.exifOrientation,
      })),
      data.options,
      (done, total) => {
        self.postMessage({
          type: 'progress',
          requestId: data.requestId,
          done,
          total,
        });
      },
    );
    self.postMessage(
      {
        type: 'result',
        requestId: data.requestId,
        pdfBytes: pdfBytes.buffer,
      },
      [pdfBytes.buffer],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'error',
      requestId: data.requestId,
      message,
    });
  }
});
