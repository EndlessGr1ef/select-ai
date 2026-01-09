import React from 'react';
import { createRoot } from 'react-dom/client';
import ContentApp from './ContentApp';
import './content.css';

const rootId = 'ai-selection-search-root';
let rootElement = document.getElementById(rootId);

if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = rootId;
  
  // Don't use shadow DOM for event handling - it blocks document-level events
  // Just append directly to body for now
  document.body.appendChild(rootElement);
  
  createRoot(rootElement).render(
    <React.StrictMode>
      <ContentApp />
    </React.StrictMode>
  );
}
