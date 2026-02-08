import React from 'react';
import { createRoot } from 'react-dom/client';
import ContentApp from './ContentApp';
import InlineTranslator from './InlineTranslator';
import { SiteBlacklist } from '../utils/SiteBlacklist';
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
