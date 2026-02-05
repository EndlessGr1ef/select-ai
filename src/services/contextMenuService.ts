// Context Menu Service - Handles right-click menu for images

import { ocrService } from './ocrService';

class ContextMenuService {
  private menuId = 'select-ai-ocr-menu';
  private translateId = 'select-ai-ocr-translate';
  private explainId = 'select-ai-ocr-explain';

  // Create context menus
  async createMenus(): Promise<void> {
    // Clean up existing menus first
    this.destroy();

    // Main menu
    chrome.contextMenus.create({
      id: this.menuId,
      title: '📷 Select AI',
      contexts: ['image'],
    });

    // Sub-menus
    chrome.contextMenus.create({
      id: `${this.menuId}-recognize`,
      parentId: this.menuId,
      title: '识别文字',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: this.translateId,
      parentId: this.menuId,
      title: '翻译图片',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: this.explainId,
      parentId: this.menuId,
      title: '解释图片',
      contexts: ['image'],
    });

    // Add click listener
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === this.translateId) {
        this.handleTranslate(tab?.id, info.srcUrl);
      } else if (info.menuItemId === this.explainId) {
        this.handleExplain(tab?.id, info.srcUrl);
      } else if (info.menuItemId === `${this.menuId}-recognize`) {
        this.handleRecognize(tab?.id, info.srcUrl);
      }
    });

    console.log('[ContextMenu] Menus created');
  }

  // Handle translate action
  private async handleTranslate(tabId: number | undefined, imageUrl: string | undefined): Promise<void> {
    if (!tabId || !imageUrl) return;

    try {
      const imageBlob = await this.urlToBlob(imageUrl);
      const settings = await ocrService.loadSettings();
      const ocrResult = await ocrService.recognize(imageBlob, settings.ocrLanguages);

      // Send message to content script to show translation panel
      chrome.tabs.sendMessage(tabId, {
        action: 'show-image-translation',
        sourceType: 'image',
        sourceText: ocrResult.text,
        ocrResult,
      });

      console.log('[ContextMenu] Translate action completed');
    } catch (error) {
      console.error('[ContextMenu] Translate failed:', error);
      this.showNotification('翻译失败，请重试');
    }
  }

  // Handle explain action
  private async handleExplain(tabId: number | undefined, imageUrl: string | undefined): Promise<void> {
    if (!tabId || !imageUrl) return;

    try {
      const imageBlob = await this.urlToBlob(imageUrl);
      const settings = await ocrService.loadSettings();
      const ocrResult = await ocrService.recognize(imageBlob, settings.ocrLanguages);

      // Send message to content script to show explanation panel
      chrome.tabs.sendMessage(tabId, {
        action: 'show-image-explanation',
        sourceType: 'image',
        sourceText: ocrResult.text,
        ocrResult,
      });

      console.log('[ContextMenu] Explain action completed');
    } catch (error) {
      console.error('[ContextMenu] Explain failed:', error);
      this.showNotification('解释失败，请重试');
    }
  }

  // Handle recognize action (just show OCR text)
  private async handleRecognize(tabId: number | undefined, imageUrl: string | undefined): Promise<void> {
    if (!tabId || !imageUrl) return;

    try {
      const imageBlob = await this.urlToBlob(imageUrl);
      const settings = await ocrService.loadSettings();
      const ocrResult = await ocrService.recognize(imageBlob, settings.ocrLanguages);

      // Send message to content script to show OCR result
      chrome.tabs.sendMessage(tabId, {
        action: 'show-ocr-result',
        text: ocrResult.text,
        confidence: ocrResult.confidence,
      });

      console.log('[ContextMenu] Recognize action completed');
    } catch (error) {
      console.error('[ContextMenu] Recognize failed:', error);
      this.showNotification('识别失败，请重试');
    }
  }

  // Convert URL to Blob
  private async urlToBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    return response.blob();
  }

  // Show notification
  private showNotification(message: string): void {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'app-icon.png',
      title: 'Select AI',
      message,
    });
  }

  // Destroy all menus
  destroy(): void {
    try {
      chrome.contextMenus.removeAll();
      console.log('[ContextMenu] Menus removed');
    } catch (error) {
      console.warn('[ContextMenu] Failed to remove menus:', error);
    }
  }
}

export const contextMenuService = new ContextMenuService();
