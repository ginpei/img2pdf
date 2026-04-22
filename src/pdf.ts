import {
  Gravity,
  ImageMagick,
  MagickColors,
  MagickFormat,
  MagickGeometry,
  MagickImageCollection,
} from '@imagemagick/magick-wasm';
import type { IMagickImage } from '@imagemagick/magick-wasm';
import type { GlobalOptions, ImageEntry } from './types.js';

// Page dimensions in pixels at 96 DPI
const PAGE_DIMENSIONS: Record<string, [number, number]> = {
  a4: [794, 1123],      // 210×297mm at 96dpi
  letter: [816, 1056],  // 8.5×11in at 96dpi
};

async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Build a MagickImageCollection without triggering the "dispose on read()"
 * behaviour present in magick-wasm ≤ 0.0.40. The trick is to splice() the
 * backing array empty before each read() call so that the internal
 * this.dispose() loop has nothing to clean up.
 */
function buildCollectionFromBytesArray(bytesArray: Uint8Array[]): ReturnType<typeof MagickImageCollection.create> {
  const collection = MagickImageCollection.create();
  const saved: IMagickImage[] = [];

  for (const bytes of bytesArray) {
    // Clear the Array backing store without calling dispose() on existing images.
    collection.splice(0);
    // Now the internal dispose() in readOrPing() is a no-op.
    collection.read(bytes);
    // Stash the newly read image and remove it from the collection array
    // without disposal so we can accumulate all images.
    saved.push(collection[0]);
    collection.splice(0);
  }

  // Restore all accumulated images into the collection in page order.
  collection.push(...saved);
  return collection;
}

export async function generatePdf(
  images: ImageEntry[],
  options: GlobalOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const processedBytesArray: Uint8Array[] = [];

  for (let i = 0; i < images.length; i++) {
    onProgress?.(i, images.length);
    const entry = images[i];
    const bytes = await fileToBytes(entry.file);

    const processed = ImageMagick.read(bytes, (img) => {
      // Rotate: ImageMagick operates on raw image, so we add EXIF orientation + user rotation
      const totalRotation = (entry.exifOrientation + entry.rotate) % 360;
      if (totalRotation !== 0) {
        img.rotate(totalRotation);
      }

      // Resize
      if (options.resizeMode === 'percent') {
        const geo = new MagickGeometry(options.resizePercent, options.resizePercent);
        geo.isPercentage = true;
        img.resize(geo);
      } else if (options.resizeMode === 'pixels') {
        if (options.resizeLockAspect) {
          const srcAspect = img.width / img.height;
          let targetW = options.resizeWidth;
          let targetH = options.resizeHeight;
          if (targetW / targetH > srcAspect) {
            targetW = Math.round(targetH * srcAspect);
          } else {
            targetH = Math.round(targetW / srcAspect);
          }
          img.resize(targetW, targetH);
        } else {
          img.resize(options.resizeWidth, options.resizeHeight);
        }
      }

      // Grayscale
      if (options.grayscale) {
        img.grayscale();
      }

      // Page size: resize to fit within bounds, then extend canvas to page size
      if (options.pageSize !== 'fit') {
        const [pw, ph] = PAGE_DIMENSIONS[options.pageSize];
        const [pageW, pageH] =
          options.orientation === 'landscape' ? [ph, pw] : [pw, ph];
        // Fit image within page, preserving aspect ratio
        const fitGeo = new MagickGeometry(pageW, pageH);
        img.resize(fitGeo);
        // Extend canvas to exact page size, centering the image on white
        const extGeo = new MagickGeometry(pageW, pageH);
        img.extent(extGeo, Gravity.Center, MagickColors.White);
      }

      // Quality applies to JPEG encoding
      img.quality = options.quality;

      return img.write(MagickFormat.Jpeg, (data) => new Uint8Array(data));
    });

    processedBytesArray.push(processed);
  }

  onProgress?.(images.length, images.length);

  const collection = buildCollectionFromBytesArray(processedBytesArray);
  try {
    const pdfBytes = collection.write(MagickFormat.Pdf, (data) => new Uint8Array(data));
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } finally {
    collection.dispose();
  }
}
