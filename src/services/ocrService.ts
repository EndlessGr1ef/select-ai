// OCR Service - Handles Tesseract.js image text recognition

import Tesseract from 'tesseract.js';

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

interface OCRSettings {
  ocrEnabled: boolean;
  ocrLanguages: string[];
}

const STORAGE_KEYS = {
  OCR_ENABLED: 'ocr_enabled',
  OCR_LANGUAGES: 'ocr_languages',
};

// Language code mapping
const LANG_MAP: Record<string, string> = {
  'jpn': 'jpn',
  'eng': 'eng',
  'chs': 'chi_sim', // Simplified Chinese
};

class OCRService {
  private worker: Tesseract.Worker | null = null;
  private initialized = false;
  private defaultLanguages: string[] = ['jpn', 'eng', 'chs'];

  // Logger type for Tesseract.js
  private createLogger(): (m: Tesseract.LoggerMessage) => void {
    return (m) => {
      if (m.status === 'recognizing text' && m.progress !== undefined) {
        console.log(`[OCR] 识别进度: ${Math.round(m.progress * 100)}%`);
      }
    };
  }

  // Initialize Tesseract worker
  async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[OCR] Initializing Tesseract worker...');
    this.initialized = true;
  }

  // Load and initialize a language
  async loadLanguage(langId: string): Promise<void> {
    const tessLang = LANG_MAP[langId];
    if (!tessLang) {
      throw new Error(`Unknown language: ${langId}`);
    }

    // Mark as downloaded
    await chrome.storage.local.set({ [`ocr_lang_${langId}_downloaded`]: true });
    console.log(`[OCR] Language ${langId} loaded successfully`);
  }

  // Download language pack (triggers download if not cached)
  async downloadLanguage(langId: string): Promise<void> {
    await this.loadLanguage(langId);
  }

  // Check if language pack is downloaded
  async isLanguageDownloaded(langId: string): Promise<boolean> {
    const result = await chrome.storage.local.get(`ocr_lang_${langId}_downloaded`);
    return !!result[`ocr_lang_${langId}_downloaded`];
  }

  // Recognize text from image
  async recognize(
    imageSource: File | Blob | string,
    languages?: string[]
  ): Promise<OCRResult> {
    const langs = languages || this.defaultLanguages;
    const combinedLang = langs
      .map(lang => LANG_MAP[lang])
      .filter(Boolean)
      .join('+');

    console.log(`[OCR] Recognizing with languages: ${combinedLang}`);

    // Create worker with language
    const worker = await Tesseract.createWorker(combinedLang, 1, {
      logger: this.createLogger(),
    });

    try {
      const result = await worker.recognize(imageSource);

      const words = result.data.words?.map((w) => ({
        text: w.text,
        bbox: {
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1,
        },
      })) || [];

      await worker.terminate();

      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        words,
      };
    } catch (error) {
      await worker.terminate();
      throw error;
    }
  }

  // Get list of available languages
  getAvailableLanguages(): Array<{ id: string; name: string; size: string }> {
    return [
      { id: 'jpn', name: '日语 (Japanese)', size: '~50MB' },
      { id: 'eng', name: '英语 (English)', size: '~20MB' },
      { id: 'chs', name: '简体中文 (Chinese)', size: '~50MB' },
    ];
  }

  // Load OCR settings
  async loadSettings(): Promise<OCRSettings> {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.OCR_ENABLED,
      STORAGE_KEYS.OCR_LANGUAGES,
    ]);

    return {
      ocrEnabled: (result[STORAGE_KEYS.OCR_ENABLED] as boolean) ?? false,
      ocrLanguages: (result[STORAGE_KEYS.OCR_LANGUAGES] as string[]) ?? ['jpn', 'eng'],
    };
  }

  // Save OCR settings
  async saveSettings(settings: OCRSettings): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.OCR_ENABLED]: settings.ocrEnabled,
      [STORAGE_KEYS.OCR_LANGUAGES]: settings.ocrLanguages,
    });
  }

  // Convert image element to blob
  async imageToBlob(imgElement: HTMLImageElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }

      ctx.drawImage(imgElement, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert image to blob'));
          }
        },
        'image/png'
      );
    });
  }

  // Cleanup resources
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      console.log('[OCR] Worker terminated');
    }
  }
}

export const ocrService = new OCRService();
export type { OCRResult, OCRSettings };
