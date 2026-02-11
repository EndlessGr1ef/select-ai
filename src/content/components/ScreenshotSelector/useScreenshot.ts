// Screenshot Hook - Handles screenshot capture and cropping

import { type Rect } from './types';

// Load image from data URL
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

// Crop image from data URL using canvas
async function cropImageFromDataUrl(
  dataUrl: string,
  rect: Rect
): Promise<Blob> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width;
  canvas.height = rect.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw cropped image (considering device pixel ratio)
  ctx.drawImage(
    img,
    rect.x * dpr,
    rect.y * dpr,
    rect.width * dpr,
    rect.height * dpr,
    0,
    0,
    rect.width,
    rect.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      'image/png'
    );
  });
}

export function useScreenshot() {
  const captureScreenshot = async (rect: Rect): Promise<Blob> => {
    // Send message to background to capture visible tab
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'capture-screenshot', rect },
        async (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`截图失败: ${chrome.runtime.lastError.message}`));
            return;
          }

          if (response?.error) {
            reject(new Error(`截图失败: ${response.error}`));
            return;
          }

          if (!response?.dataUrl) {
            reject(new Error('截图失败: 未返回图片数据'));
            return;
          }

          try {
            const blob = await cropImageFromDataUrl(response.dataUrl, rect);
            resolve(blob);
          } catch (error) {
            reject(new Error(`图片处理失败: ${error instanceof Error ? error.message : String(error)}`));
          }
        }
      );
    });
  };

  return { captureScreenshot };
}
