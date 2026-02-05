import React from 'react';
import { createRoot } from 'react-dom/client';
import ContentApp from './ContentApp';
import InlineTranslator from './InlineTranslator';
import { SiteBlacklist } from '../utils/SiteBlacklist';
import { imageTextDetector } from './ImageTextDetector';
import { ocrService } from '../services/ocrService';
import './content.css';

const rootId = 'ai-selection-search-root';
let rootElement = document.getElementById(rootId);

// Initialize blacklist for inline translation filtering
async function initApp() {
  const blacklist = new SiteBlacklist();
  await blacklist.load();

  // Load OCR settings and enable if needed
  const ocrSettings = await ocrService.loadSettings();
  if (ocrSettings.ocrEnabled) {
    imageTextDetector.setEnabled(true);
  }

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

// Listen for messages from OCR detector
window.addEventListener('message', (event) => {
  if (event.data.type === 'select-ai-translate') {
    // Dispatch custom event for translation
    window.dispatchEvent(new CustomEvent('select-ai-translate-text', { detail: event.data }));
  } else if (event.data.type === 'select-ai-explain') {
    window.dispatchEvent(new CustomEvent('select-ai-explain-text', { detail: event.data }));
  }
});
