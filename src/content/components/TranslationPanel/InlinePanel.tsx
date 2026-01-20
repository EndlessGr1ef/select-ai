import React, { useEffect } from 'react';
import { useTranslation } from '../../context/TranslationContext';
import { parseMarkdown } from '../../utils/markdown';
import { applyPlaceholderTranslation } from '../../utils/placeholder';
import type { PlaceholderTemplate } from '../../utils/placeholder';
import { Sparkles } from 'lucide-react';

interface InlinePanelProps {
  id: string;
  text: string;
  placeholder?: PlaceholderTemplate;
  inheritedStyles: string;
}

const InlinePanel: React.FC<InlinePanelProps> = ({
  id,
  text,
  placeholder,
  inheritedStyles,
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
    marginLeft: 6,
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
      contentDiv.style.display = 'inline';
      const loadingDiv = container.querySelector('.translation-loading') as HTMLElement;
      if (loadingDiv) loadingDiv.style.display = 'none';
    }
    if (container) {
      container.style.display = 'inline';
      setTimeout(() => container.classList.add('show'), 10);
    }
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
      className="select-ai-translation-container inline-mode"
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
      `}</style>
      <div
        className="translation-loading"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'inherit',
        }}
      >
        <Sparkles
          size={12}
          style={{
            animation: 'sparkle-pulse 1.5s ease-in-out infinite',
            opacity: 0.7,
          }}
        />
      </div>
      <span className="translation-content" style={{ display: 'none' }} />
    </span>
  );
};

export default InlinePanel;
