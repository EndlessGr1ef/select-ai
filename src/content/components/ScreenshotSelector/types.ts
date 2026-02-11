// Screenshot Selector Types

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotSelectorProps {
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}
