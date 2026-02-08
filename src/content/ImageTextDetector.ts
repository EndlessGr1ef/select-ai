// Image Text Detector - Detects selected text in images and shows OCR popup

import { ocrService } from '../services/ocrService';

interface PopupData {
  status: 'loading' | 'ready' | 'error';
  imageInfo?: ImageInfo;
  ocrResult?: OCRResult;
  matchedText?: string;
  selectedText?: string;
  error?: string;
}

interface ImageInfo {
  imageElement: HTMLImageElement;
  imageUrl: string;
  imageBlob: Blob;
}

interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

class ImageTextDetector {
  private selectionChangeHandler: () => void;
  private popup: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private isProcessing = false;
  private isEnabled = false;

  constructor() {
    this.selectionChangeHandler = this.handleSelectionChange.bind(this);
  }

  // Enable/disable the detector
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      document.addEventListener('selectionchange', this.selectionChangeHandler);
    } else {
      document.removeEventListener('selectionchange', this.selectionChangeHandler);
      this.hidePopup();
      this.hidePanel();
    }
    console.log(`[ImageTextDetector] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  // Handle selection change
  private async handleSelectionChange(): Promise<void> {
    if (!this.isEnabled || this.isProcessing) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    // If no selection, hide popup
    if (!selectedText) {
      this.hidePopup();
      return;
    }

    // Check if selection is inside an image
    const imageInfo = this.getSelectedImageInfo(selection!);
    if (!imageInfo) {
      this.hidePopup();
      return;
    }

    // Show loading popup
    this.showPopup({
      status: 'loading',
      imageInfo,
    });

    try {
      this.isProcessing = true;
      const settings = await ocrService.loadSettings();
      const ocrResult = await ocrService.recognize(
        imageInfo.imageBlob,
        settings.ocrLanguages
      );

      // Try to match selected text with OCR result
      const matched = this.fuzzyMatch(selectedText, ocrResult.text);

      if (matched) {
        this.showPopup({
          status: 'ready',
          imageInfo,
          ocrResult,
          matchedText: matched,
          selectedText,
        });
      } else {
        // Still show popup but mark as unmatched
        this.showPopup({
          status: 'ready',
          imageInfo,
          ocrResult,
          selectedText,
        });
      }
    } catch (error) {
      console.error('[ImageTextDetector] OCR failed:', error);
      this.showPopup({
        status: 'error',
        imageInfo,
        error: '识别失败',
      });
    } finally {
      this.isProcessing = false;
    }
  }

  // Get image info from selection
  private getSelectedImageInfo(selection: Selection): ImageInfo | null {
    const anchorNode = selection.anchorNode;
    if (!anchorNode) return null;

    // Method 1: Find parent img element
    let element: Node | null = anchorNode;
    while (element) {
      if (element.nodeType === Node.ELEMENT_NODE) {
        const img = (element as Element).querySelector?.('img');
        if (img && img.complete && (img as HTMLImageElement).naturalWidth > 0) {
          return this.createImageInfo(img as HTMLImageElement);
        }
      }
      element = element.parentNode;
    }

    // Method 2: Check background image or figure
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;

    if (commonAncestor.nodeType === Node.TEXT_NODE) {
      const parent = commonAncestor.parentElement;
      const img = parent?.closest('img[alt], figure, .image-wrapper, .image-container')?.querySelector('img');
      if (img) {
        return this.createImageInfo(img as HTMLImageElement);
      }
    }

    return null;
  }

  // Create ImageInfo from img element
  private async createImageInfo(img: HTMLImageElement): Promise<ImageInfo> {
    const imageBlob = await ocrService.imageToBlob(img);
    return {
      imageElement: img,
      imageUrl: img.src,
      imageBlob,
    };
  }

  // Fuzzy match selected text with OCR result
  private fuzzyMatch(selected: string, ocrText: string): string | null {
    const cleanSelected = selected.toLowerCase().replace(/\s+/g, ' ').trim();
    const cleanOCR = ocrText.toLowerCase().replace(/\s+/g, ' ').trim();

    // Exact contains match
    if (cleanOCR.includes(cleanSelected)) {
      return selected;
    }

    // Similarity match
    if (this.similarity(cleanSelected, cleanOCR) > 0.6) {
      return selected;
    }

    return null;
  }

  // Calculate string similarity (Levenshtein-based)
  private similarity(a: string, b: string): number {
    if (a.length === 0 || b.length === 0) return 0;
    const longer = a.length > b.length ? a : b;
    if (longer.length === 0) return 1;

    const distance = this.levenshteinDistance(a, b);
    return 1 - distance / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  // Show floating button popup
  private showPopup(data: PopupData): void {
    this.hidePopup();

    const button = document.createElement('div');
    button.className = 'select-ai-ocr-float-btn';

    const buttonText = data.status === 'loading' ? '识别中...' : '📷 OCR';
    button.innerHTML = `<span>${buttonText}</span>`;

    // Click to show translation panel
    button.onclick = () => {
      if (data.status === 'ready' || data.status === 'error') {
        this.showPanel(data);
      }
    };

    // Position near selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      button.style.cssText = `
        position: fixed;
        left: ${rect.right + 12}px;
        top: ${rect.top + window.scrollY}px;
        z-index: 9999999;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border-radius: 20px;
        padding: 6px 14px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      button.onmouseenter = () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.5)';
      };
      button.onmouseleave = () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
      };

      document.body.appendChild(button);
      this.popup = button;
    }
  }

  private hidePopup(): void {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
  }

  // Show translation/explanation panel
  private showPanel(data: PopupData): void {
    this.hidePanel();

    const panel = document.createElement('div');
    panel.className = 'select-ai-ocr-panel';

    const originalText = data.matchedText || data.selectedText || '';

    panel.innerHTML = `
      <div class="ocr-panel-header">
        <span class="ocr-panel-title">📷 图片识别</span>
        <button class="ocr-panel-close">✕</button>
      </div>
      <div class="ocr-panel-content">
        ${data.status === 'loading'
          ? '<div class="ocr-loading">识别中...</div>'
          : `
            <div class="ocr-original">
              <div class="ocr-label">原文</div>
              <div class="ocr-text">${originalText}</div>
            </div>
            <div class="ocr-actions">
              <button class="ocr-action-btn translate-btn" data-action="translate">
                🌐 翻译
              </button>
              <button class="ocr-action-btn explain-btn" data-action="explain">
                💡 解释
              </button>
              <button class="ocr-action-btn copy-btn" data-action="copy">
                📋 复制
              </button>
            </div>
          `
        }
      </div>
    `;

    // Close button
    panel.querySelector('.ocr-panel-close')?.addEventListener('click', () => {
      this.hidePanel();
    });

    // Action buttons
    panel.querySelectorAll('.ocr-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (action === 'translate') {
          this.handleTranslate(originalText, data.ocrResult);
        } else if (action === 'explain') {
          this.handleExplain(originalText, data.ocrResult);
        } else if (action === 'copy') {
          navigator.clipboard.writeText(originalText);
          this.showToast('已复制到剪贴板');
        }
      });
    });

    // Position
    const button = this.popup;
    if (button) {
      const rect = button.getBoundingClientRect();
      panel.style.cssText = `
        position: fixed;
        left: ${rect.right + 15}px;
        top: ${rect.top}px;
        z-index: 9999999;
        width: 280px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      document.body.appendChild(panel);
      this.panel = panel;
    }
  }

  private hidePanel(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  // Handle translate action
  private handleTranslate(text: string, ocrResult?: OCRResult): void {
    window.postMessage({
      type: 'select-ai-translate',
      text,
      source: 'image-ocr',
    }, '*');
  }

  // Handle explain action
  private handleExplain(text: string, ocrResult?: OCRResult): void {
    window.postMessage({
      type: 'select-ai-explain',
      text,
      context: ocrResult?.text || '',
      source: 'image-ocr',
    }, '*');
  }

  // Show toast notification
  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'select-ai-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 99999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}

export const imageTextDetector = new ImageTextDetector();
export type { PopupData, ImageInfo, OCRResult };
