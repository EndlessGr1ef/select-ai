import React, { useEffect } from 'react';
import { useTranslation } from '../../context/TranslationContext';
import { parseMarkdown } from '../../utils/markdown';
import { applyPlaceholderTranslation } from '../../utils/placeholder';
import type { PlaceholderTemplate } from '../../utils/placeholder';

interface BlockPanelProps {
  id: string;
  text: string;
  placeholder?: PlaceholderTemplate;
  inheritedStyles: string;
  loadingText: string;
}

const BlockPanel: React.FC<BlockPanelProps> = ({
  id,
  text,
  placeholder,
  inheritedStyles,
  loadingText,
}) => {
  const { translationCache, translatedIds } = useTranslation();

  useEffect(() => {
    if (text) {
      translationCache.set(id, { text, placeholder });
      translatedIds.add(id);
    }
  }, [id, text, placeholder, translationCache, translatedIds]);

  const containerStyle: React.CSSProperties = {
    display: 'none',
    opacity: 0,
    transition: 'opacity 0.3s ease',
    marginTop: 0.4,
    marginBottom: 0.4,
    width: '100%',
    backgroundColor: 'transparent',
    ...Object.fromEntries(
      inheritedStyles.split(';').filter(Boolean).map((rule) => {
        const [key, value] = rule.split(':');
        return [key?.trim(), value?.trim()];
      })
    ),
  };

  const updateTranslation = (fullText: string, isFinal: boolean) => {
    const container = document.getElementById(id);
    if (!container) return;
    const contentDiv = container.querySelector('.translation-content') as HTMLElement;
    if (contentDiv) {
      const finalHTML = placeholder
        ? applyPlaceholderTranslation(placeholder, fullText, parseMarkdown, { isFinal, fallbackToOriginal: true })
        : parseMarkdown(fullText);
      contentDiv.innerHTML = finalHTML;
      contentDiv.style.display = 'block';
      const loadingDiv = container.querySelector('.translation-loading') as HTMLElement;
      if (loadingDiv) loadingDiv.style.display = 'none';
    }
    container.style.display = 'block';
    setTimeout(() => container.classList.add('show'), 10);
  };

  useEffect(() => {
    const cached = translationCache.get(id);
    if (cached) {
      updateTranslation(cached.text, true);
    }
  }, [id, translationCache]);

  return (
    <span
      id={id}
      className="select-ai-translation-container block-mode"
      style={containerStyle}
    >
      <style>{`
        .select-ai-translation-container.show {
          opacity: 1 !important;
        }
        @keyframes sparkle-pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes spin-smooth {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        className="translation-loading"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          color: 'inherit',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin-smooth 1s linear infinite',
            opacity: 0.6,
          }}
        />
        <span style={{ fontSize: '0.9em', opacity: 0.8 }}>{loadingText}</span>
      </div>
      <div className="translation-content" style={{ display: 'none' }} />
    </span>
  );
};

export default BlockPanel;
