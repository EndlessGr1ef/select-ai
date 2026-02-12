import React from 'react';
import { createRoot } from 'react-dom/client';
import ContentApp from './ContentApp';
import InlineTranslator from './InlineTranslator';
import { SiteBlacklist } from '../utils/SiteBlacklist';
import { ocrService } from '../services/ocrService';
import './content.css';

const rootId = 'ai-selection-search-root';
let rootElement = document.getElementById(rootId);

// Initialize blacklist for inline translation filtering
async function initApp() {
  const blacklist = new SiteBlacklist();
  await blacklist.load();

  // Render apps: selection explain is not blocked by blacklist
  createRoot(rootElement!).render(
    <React.StrictMode>
      <ContentApp />
      <InlineTranslator blacklist={blacklist} />
    </React.StrictMode>
  );
}

if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = rootId;
  document.body.appendChild(rootElement);
  initApp();
}

// Listen for messages from background service worker (context menu actions)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'ocr-from-context-menu') {
    // Perform OCR in content script (background service worker cannot run Tesseract.js)
    handleContextMenuOCR(message.imageUrl)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: String(err) }));
    return true; // Keep message channel open for async response
  } else if (message.action === 'start-screenshot') {
    // Trigger screenshot mode via custom event
    window.dispatchEvent(new CustomEvent('select-ai-start-screenshot'));
    sendResponse({ success: true });
    return true;
  }
});

// Handle context menu OCR: fetch image, run Tesseract, dispatch result
async function handleContextMenuOCR(imageUrl: string): Promise<void> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
  const imageBlob = await response.blob();

  const settings = await ocrService.loadSettings();
  const ocrResult = await ocrService.recognize(imageBlob, settings.ocrLanguages);

  if (!ocrResult.text.trim()) {
    throw new Error('未识别到文字');
  }

  // Dispatch unified image explain event with OCR text
  window.dispatchEvent(new CustomEvent('select-ai-image-explain', {
    detail: { imageText: ocrResult.text, source: 'context-menu' },
  }));
}
