// Context Menu Service - Handles right-click menu for images
// OCR processing is delegated to the content script (service workers cannot run Tesseract.js)

class ContextMenuService {
  private menuId = 'select-ai-ocr-image';

  // Create context menus
  async createMenus(): Promise<void> {
    // Clean up existing menus first
    this.destroy();

    // Single menu item for image OCR + AI explanation
    chrome.contextMenus.create({
      id: this.menuId,
      title: '📷 AI 图片解释',
      contexts: ['image'],
    });

    // Add click listener
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === this.menuId) {
        this.delegateToContentScript(tab?.id, info.srcUrl);
      }
    });

    console.log('[ContextMenu] Menus created');
  }

  // Delegate OCR processing to content script (background cannot run Tesseract.js)
  private delegateToContentScript(
    tabId: number | undefined,
    imageUrl: string | undefined,
  ): void {
    if (!tabId || !imageUrl) return;

    chrome.tabs.sendMessage(tabId, {
      action: 'ocr-from-context-menu',
      imageUrl,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[ContextMenu] Failed to send to content script:', chrome.runtime.lastError.message);
        this.showNotification('操作失败，请刷新页面后重试');
      } else if (response?.error) {
        console.error('[ContextMenu] Content script error:', response.error);
        this.showNotification(response.error);
      }
    });
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
