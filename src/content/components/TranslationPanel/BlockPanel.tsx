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
      <div
        className="translation-loading"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.9em' }}>{loadingText}</span>
      </div>
      <div className="translation-content" style={{ display: 'none' }} />
    </span>
  );
};

export default BlockPanel;
