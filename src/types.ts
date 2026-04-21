export type Rotation = 0 | 90 | 180 | 270;
export type PageSize = 'fit' | 'a4' | 'letter';
export type Orientation = 'portrait' | 'landscape';
export type ResizeMode = 'none' | 'pixels' | 'percent';

export interface ImageEntry {
  id: string;
  file: File;
  objectUrl: string;
  rotate: Rotation;
}

export interface GlobalOptions {
  resizeMode: ResizeMode;
  resizeWidth: number;
  resizeHeight: number;
  resizeLockAspect: boolean;
  resizePercent: number;
  quality: number;
  grayscale: boolean;
  pageSize: PageSize;
  orientation: Orientation;
  outputFilename: string;
}

export const DEFAULT_OPTIONS: GlobalOptions = {
  resizeMode: 'none',
  resizeWidth: 1920,
  resizeHeight: 1080,
  resizeLockAspect: true,
  resizePercent: 100,
  quality: 85,
  grayscale: false,
  pageSize: 'fit',
  orientation: 'portrait',
  outputFilename: 'output.pdf',
};
