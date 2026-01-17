import React from 'react';
import { createRoot } from 'react-dom/client';
import ContentApp from './ContentApp';
import InlineTranslator from './InlineTranslator';
import { SiteBlacklist } from '../utils/SiteBlacklist';
import './content.css';

const rootId = 'ai-selection-search-root';
let rootElement = document.getElementById(rootId);

// Initialize blacklist and check if functionality should be displayed
async function initApp() {
  const blacklist = new SiteBlacklist();
  await blacklist.load();

  // Check if current selection is within blacklisted elements (async)
  const isSelectionBlocked = async (): Promise<boolean> => {
    const isEnabled = await blacklist.isBlacklistEnabled();
    if (!isEnabled) return false;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const range = sel.getRangeAt(0);
    const selectedNode = range.startContainer;

    // Check if selected node's parent element matches blacklist
    let currentElement: Element | null = null;
    if (selectedNode.nodeType === Node.TEXT_NODE) {
      currentElement = selectedNode.parentElement;
    } else if (selectedNode.nodeType === Node.ELEMENT_NODE) {
      currentElement = selectedNode as Element;
    }

    while (currentElement) {
      if (blacklist.isElementBlocked(currentElement)) {
        return true;
      }
      currentElement = currentElement.parentElement;
    }

    return false;
  };

  // Render app, pass isSelectionBlocked function
  createRoot(rootElement!).render(
    <React.StrictMode>
      <ContentApp isSelectionBlocked={isSelectionBlocked} />
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
