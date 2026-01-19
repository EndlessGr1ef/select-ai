import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../../context/TranslationContext';
import { applyPlaceholderTranslation } from '../../utils/placeholder';
import { parseMarkdown } from '../../utils/markdown';
import type { PlaceholderTemplate } from '../../utils/placeholder';

interface TranslationContentProps {
  id: string;
  placeholder?: PlaceholderTemplate;
  inheritedStyles: string;
  isInlineMode: boolean;
  loadingText?: string;
}

const TranslationContent: React.FC<TranslationContentProps> = ({
  id,
  placeholder,
  inheritedStyles,
  isInlineMode,
  loadingText,
}) => {
  const { translationCache, isTranslating } = useTranslation();
  const contentRef = useRef<HTMLSpanElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const updateContent = useCallback((text: string, isFinal: boolean) => {
    const contentDiv = contentRef.current;
    if (contentDiv) {
      const finalHTML = placeholder
        ? applyPlaceholderTranslation(placeholder, text, parseMarkdown, { isFinal, fallbackToOriginal: true })
        : parseMarkdown(text);
      contentDiv.innerHTML = finalHTML;
      contentDiv.style.display = isInlineMode ? 'inline' : 'block';
      if (loadingRef.current) loadingRef.current.style.display = 'none';
    }
  }, [placeholder, isInlineMode]);

  useEffect(() => {
    const cachedTranslation = translationCache.get(id);
    if (cachedTranslation) {
      updateContent(cachedTranslation.text, true);
    }
  }, [id, translationCache, updateContent]);

  useEffect(() => {
    if (isTranslating) {
      const cachedTranslation = translationCache.get(id);
      if (cachedTranslation) {
        updateContent(cachedTranslation.text, false);
      }
    }
  }, [isTranslating, id, translationCache, updateContent]);

  const containerStyle: React.CSSProperties = {
    display: 'none',
    opacity: 0,
    transition: 'opacity 0.3s ease',
    marginLeft: isInlineMode ? 6 : 0,
    marginTop: isInlineMode ? 0 : 0.4,
    marginBottom: isInlineMode ? 0 : 0.4,
    width: isInlineMode ? 'auto' : '100%',
  };

  return (
    <span
      id={id}
      className={`select-ai-translation-container ${isInlineMode ? 'inline-mode' : 'block-mode'}`}
      style={containerStyle}
    >
      <div
        ref={loadingRef}
        className="translation-loading"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isInlineMode ? 4 : 8,
          ...Object.fromEntries(
            inheritedStyles.split(';').filter(Boolean).map((rule) => {
              const [key, value] = rule.split(':');
              return [key?.trim(), value?.trim()];
            })
          ),
        }}
      >
        <span
          style={{
            width: isInlineMode ? 10 : 14,
            height: isInlineMode ? 10 : 14,
            border: `2px solid currentColor`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        {!isInlineMode && loadingText && <span style={{ fontSize: '0.9em' }}>{loadingText}</span>}
      </div>
      <span
        ref={contentRef}
        className="translation-content"
        style={{ display: 'none' }}
      />
    </span>
  );
};

export default TranslationContent;
