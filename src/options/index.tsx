import React from 'react';
import { createRoot } from 'react-dom/client';
import OptionsApp from './OptionsApp';
import '../index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>
  );
}
