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
  private workerLang: string = '';
  private workerCreating: Promise<Tesseract.Worker> | null = null;
  private defaultLanguages: string[] = ['jpn', 'eng', 'chs'];

  // Cached blob URL for the combined Tesseract worker.
  //
  // Chrome extension content scripts run in the web page's origin, which cannot:
  //   - new Worker('chrome-extension://...') → SecurityError (cross-origin worker)
  //   - importScripts('chrome-extension://...') inside blob worker → NetworkError
  //   - blob URLs don't end in '.js', so getCore.js misinterprets them as directories
  //
  // Solution: fetch BOTH worker.min.js and tesseract-core-simd-lstm.wasm.js via
  // web_accessible_resources, concatenate them into a single blob, and create one
  // Worker from that blob. Because the core script runs first and defines
  // `TesseractCore` globally, getCore.js's `typeof global.TesseractCore === 'undefined'`
  // check is false, so the entire importScripts logic is skipped.
  private cachedWorkerBlobUrl: string | null = null;
  private blobUrlPromise: Promise<string> | null = null;

  private async getCombinedWorkerBlobUrl(): Promise<string> {
    if (this.cachedWorkerBlobUrl) return this.cachedWorkerBlobUrl;

    // Deduplicate concurrent calls
    if (this.blobUrlPromise) return this.blobUrlPromise;

    this.blobUrlPromise = (async () => {
      console.log('[OCR] Fetching worker & core scripts to create combined blob...');
      const [workerRes, coreRes] = await Promise.all([
        fetch(chrome.runtime.getURL('tesseract/worker.min.js')),
        fetch(chrome.runtime.getURL('tesseract/tesseract-core-simd-lstm.wasm.js')),
      ]);

      if (!workerRes.ok) throw new Error(`Failed to fetch worker script: ${workerRes.statusText}`);
      if (!coreRes.ok) throw new Error(`Failed to fetch core script: ${coreRes.statusText}`);

      const workerText = await workerRes.text();
      const coreText = await coreRes.text();

      // Core script first: defines TesseractCore on the global scope.
      // Worker script second: getCore.js finds TesseractCore already defined,
      // skips importScripts entirely.
      const combined = `${coreText}\n;\n${workerText}`;

      this.cachedWorkerBlobUrl = URL.createObjectURL(
        new Blob([combined], { type: 'application/javascript' })
      );

      console.log('[OCR] Combined worker blob URL created successfully');
      return this.cachedWorkerBlobUrl;
    })();

    try {
      return await this.blobUrlPromise;
    } finally {
      this.blobUrlPromise = null;
    }
  }

  // Logger type for Tesseract.js
  private createLogger(): (m: Tesseract.LoggerMessage) => void {
    return (m) => {
      if (m.status === 'recognizing text' && m.progress !== undefined) {
        console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
      }
    };
  }

  // Download language pack by creating a worker that triggers the actual download.
  // onStatus receives a status string describing the current stage.
  // onProgress receives a value between 0 and 1 (may jump; see notes below).
  //
  // NOTE: Tesseract.js fetches language data inside a Web Worker using a single
  //       fetch() call, so no incremental download progress is available.
  //       Progress jumps from 0 → ~0.5 once the fetch finishes, then to 1 when
  //       initialization completes.
  async downloadLanguage(
    langId: string,
    onStatus?: (status: string) => void,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const tessLang = LANG_MAP[langId];
    if (!tessLang) {
      throw new Error(`Unknown language: ${langId}`);
    }

    console.log(`[OCR] Downloading language pack: ${tessLang}`);

    const statusMap: Record<string, string> = {
      'loading tesseract core': '加载 OCR 引擎...',
      'initializing tesseract': '初始化引擎...',
      'loading language traineddata': '下载语言包...',
      'loaded language traineddata': '语言包已加载',
      'initializing api': '初始化 API...',
    };

    // Use combined worker+core blob to avoid chrome-extension:// cross-origin issues
    const workerUrl = await this.getCombinedWorkerBlobUrl();

    // Create a temporary worker; this triggers the real language data download.
    // workerBlobURL: false — our blob URL IS the worker, no wrapping needed.
    // corePath is unused because TesseractCore is pre-loaded in the combined blob.
    const worker = await Tesseract.createWorker(tessLang, 1, {
      workerPath: workerUrl,
      corePath: 'unused-core-preloaded.js',
      workerBlobURL: false,
      logger: (m) => {
        if (onStatus && m.status) {
          onStatus(statusMap[m.status] || m.status);
        }
        if (onProgress && m.progress !== undefined) {
          onProgress(m.progress);
        }
      },
    });

    // Worker created successfully — language data is now cached by the browser
    await worker.terminate();

    // Persist the downloaded flag
    await chrome.storage.local.set({ [`ocr_lang_${langId}_downloaded`]: true });
    console.log(`[OCR] Language ${langId} downloaded successfully`);
  }

  // Check if language pack has been downloaded before
  async isLanguageDownloaded(langId: string): Promise<boolean> {
    const result = await chrome.storage.local.get(`ocr_lang_${langId}_downloaded`);
    return !!result[`ocr_lang_${langId}_downloaded`];
  }

  // Get or create a reusable worker for the given language combo
  private async getWorker(combinedLang: string): Promise<Tesseract.Worker> {
    // Reuse existing worker if language hasn't changed
    if (this.worker && this.workerLang === combinedLang) {
      return this.worker;
    }

    // If a worker is currently being created, wait for it
    if (this.workerCreating) {
      await this.workerCreating;
      if (this.worker && this.workerLang === combinedLang) {
        return this.worker;
      }
    }

    // Terminate old worker if language changed
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
        // Ignore termination errors
      }
      this.worker = null;
    }

    console.log(`[OCR] Creating worker for languages: ${combinedLang}`);

    // Use combined worker+core blob to avoid chrome-extension:// cross-origin issues
    this.workerCreating = this.getCombinedWorkerBlobUrl().then((workerUrl) =>
      Tesseract.createWorker(combinedLang, 1, {
        workerPath: workerUrl,
        corePath: 'unused-core-preloaded.js',
        workerBlobURL: false,
        logger: this.createLogger(),
      })
    );

    try {
      this.worker = await this.workerCreating;
      this.workerLang = combinedLang;
      return this.worker;
    } catch (error) {
      this.worker = null;
      this.workerLang = '';
      throw error;
    } finally {
      this.workerCreating = null;
    }
  }

  // Remove spurious spaces between CJK characters inserted by Tesseract.
  // Keeps spaces between Latin/number characters intact.
  private cleanOCRText(text: string): string {
    // CJK Unified Ideographs, CJK Extension A, Hiragana, Katakana,
    // Katakana Phonetic Extensions, CJK Symbols/Punctuation, Fullwidth forms,
    // Hangul Syllables, common CJK punctuation
    const CJK = '[\\u3000-\\u303f\\u3040-\\u309f\\u30a0-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef\\uac00-\\ud7af]';

    // Remove spaces between two CJK characters
    let cleaned = text.replace(
      new RegExp(`(${CJK})\\s+(${CJK})`, 'g'),
      '$1$2',
    );
    // The regex only matches pairs, so "A B C D" needs multiple passes
    // (A+B matched, C+D matched, but B C gap remains). Run once more.
    cleaned = cleaned.replace(
      new RegExp(`(${CJK})\\s+(${CJK})`, 'g'),
      '$1$2',
    );

    // Collapse multiple blank lines into one
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
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

    const worker = await this.getWorker(combinedLang);

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

      return {
        text: this.cleanOCRText(result.data.text),
        confidence: result.data.confidence,
        words,
      };
    } catch (error) {
      // Worker might be in bad state; force recreation on next call
      this.worker = null;
      this.workerLang = '';
      throw error;
    }
  }

  // Get list of available languages
  getAvailableLanguages(uiLang: 'zh' | 'en' = 'zh'): Array<{ id: string; name: string; size: string }> {
    if (uiLang === 'zh') {
      return [
        { id: 'jpn', name: '日语 (Japanese)', size: '~50MB' },
        { id: 'eng', name: '英语 (English)', size: '~20MB' },
        { id: 'chs', name: '简体中文 (Chinese)', size: '~50MB' },
      ];
    }
    return [
      { id: 'jpn', name: 'Japanese (日语)', size: '~50MB' },
      { id: 'eng', name: 'English (英语)', size: '~20MB' },
      { id: 'chs', name: 'Chinese (简体中文)', size: '~50MB' },
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
  // Tries canvas first (same-origin), falls back to fetch for cross-origin images
  async imageToBlob(imgElement: HTMLImageElement): Promise<Blob> {
    // Try canvas approach first (faster for same-origin images)
    try {
      const blob = await this.imageToBlobViaCanvas(imgElement);
      return blob;
    } catch {
      // Canvas tainted by cross-origin image — fall back to fetch
      console.log('[OCR] Canvas tainted, falling back to fetch for cross-origin image');
    }

    // Fetch the image URL directly
    const response = await fetch(imgElement.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    return response.blob();
  }

  private imageToBlobViaCanvas(imgElement: HTMLImageElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }

      try {
        ctx.drawImage(imgElement, 0, 0);
        // This will throw if the canvas is tainted (cross-origin image)
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
      } catch (e) {
        reject(e);
      }
    });
  }

  // Cleanup resources
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.workerLang = '';
      console.log('[OCR] Worker terminated');
    }
  }
}

export const ocrService = new OCRService();
export type { OCRResult, OCRSettings };
