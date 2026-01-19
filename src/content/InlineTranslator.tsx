import React, { useState, useEffect, useCallback } from 'react';
import { TranslationProvider, useTranslation } from './context/TranslationContext';
import { FloatingButton, useDraggable } from './components/FloatingButton';
import { SiteBlacklist } from '../utils/SiteBlacklist';
import { translations } from '../utils/i18n';
import { detectTextLanguage } from '../utils/language';
import { buildPlaceholderTemplate } from './utils/placeholder';
import {
  getTextSelectors,
  isElementEligible,
  filterVisibleElements,
  prepareTranslationItems,
} from './utils/elementDetection';
import { useTranslationStream } from './hooks/useTranslationStream';
import { ContentPriority } from '../utils/ContentPriority';
import { parseMarkdown } from './utils/markdown';

interface InlineTranslatorProps {
  blacklist: SiteBlacklist;
}

const InlineTranslatorInner: React.FC<{ blacklist: SiteBlacklist }> = ({ blacklist }) => {
  const {
    targetLang,
    uiLang,
    isTranslating,
    isTranslated,
    setIsTranslating,
    setIsTranslated,
    clearAllTranslations,
    translationCache,
    translatedIds,
    abortRef,
  } = useTranslation();

  const { translate, disconnect } = useTranslationStream();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isDragging, position, wasDraggingRef, handleDragStart } = useDraggable();

  const t = translations.content;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const getComputedStyles = (element: Element): string => {
    const computedStyle = window.getComputedStyle(element);
    return `
      color: ${computedStyle.color};
      background-color: transparent;
      font-family: ${computedStyle.fontFamily};
      font-size: 0.9em;
      font-weight: ${computedStyle.fontWeight};
      line-height: ${computedStyle.lineHeight};
      text-align: ${computedStyle.textAlign};
      opacity: 1;
    `;
  };

  const createTranslationContainer = (
    element: Element,
    id: string,
    useInlineMode: boolean,
    inheritedStyles: string
  ): void => {
    const container = document.createElement('span');
    container.id = id;
    container.className = `select-ai-translation-container ${useInlineMode ? 'inline-mode' : 'block-mode'}`;

    if (useInlineMode) {
      container.style.cssText = `
        display: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        margin-left: 6px;
        ${inheritedStyles}
      `;

      container.innerHTML = `
        <span class="translation-loading" style="display: inline-flex; align-items: center; gap: 4px; ${inheritedStyles}">
          <span style="width: 10px; height: 10px; border: 1.5px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
        </span>
        <span class="translation-content" style="display: none; ${inheritedStyles}"></span>
      `;

      element.appendChild(container);
    } else {
      container.style.cssText = `
        display: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        margin-top: 0.4em;
        margin-bottom: 0.4em;
        width: 100%;
        ${inheritedStyles}
      `;

      container.innerHTML = `
        <div class="translation-loading" style="display: inline-flex; align-items: center; gap: 8px; ${inheritedStyles}">
          <span style="width: 14px; height: 14px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
          <span style="font-size: 0.9em;">${t.translateLoading[uiLang]}</span>
        </div>
        <div class="translation-content" style="display: none; ${inheritedStyles}"></div>
      `;

      const tagName = element.tagName.toLowerCase();
      const isListItem = tagName === 'li' || tagName === 'dt' || tagName === 'dd';
      if (isListItem) {
        element.appendChild(container);
      } else if (element.parentElement) {
        element.parentElement.insertBefore(container, element.nextSibling);
      }
    }
  };

  const updateTranslation = (id: string, text: string) => {
    const container = document.getElementById(id);
    if (container) {
      const contentDiv = container.querySelector('.translation-content') as HTMLElement;
      if (contentDiv) {
        contentDiv.innerHTML = parseMarkdown(text);
        contentDiv.style.display = container.classList.contains('inline-mode') ? 'inline' : 'block';
        const loadingDiv = container.querySelector('.translation-loading') as HTMLElement;
        if (loadingDiv) loadingDiv.style.display = 'none';
      }
      container.classList.add('show');
    }
  };

  const removeFailedTranslation = (id: string, element: Element) => {
    const container = document.getElementById(id);
    if (container) {
      container.remove();
    }
    element.removeAttribute('data-select-ai-translated');
    element.removeAttribute('data-select-ai-inline-mode');
  };

  const translateElement = async (
    element: Element,
    id: string,
    text: string,
    originalHTML?: string
  ): Promise<void> => {
    if (!text) {
      const container = document.getElementById(id);
      if (container) container.remove();
      return;
    }

    const placeholderTemplate = originalHTML ? (buildPlaceholderTemplate(originalHTML) || undefined) : undefined;
    const textForLanguage = placeholderTemplate?.plainText || element.textContent?.trim() || text;
    const translationInput = placeholderTemplate?.translationInput || text;

    const detectedLang = detectTextLanguage(textForLanguage);
    const isSameLang = (detectedLang === 'zh' && targetLang.startsWith('中文')) ||
      (detectedLang === 'en' && targetLang === 'English');

    if (isSameLang) {
      const container = document.getElementById(id);
      if (container) container.remove();
      return;
    }

    await translate(translationInput, {
      targetLang,
      uiLang,
      onDelta: (data) => {
        translationCache.set(id, { text: data, originalHTML, placeholder: placeholderTemplate });
        translatedIds.add(id);
        updateTranslation(id, data);
      },
      onDone: (data) => {
        if (data) {
          translationCache.set(id, { text: data, originalHTML, placeholder: placeholderTemplate });
          translatedIds.add(id);
          updateTranslation(id, data);
        }
      },
      onError: (error) => {
        console.error('[Inline Translate] Stream error:', error);
        removeFailedTranslation(id, element);
      },
    });
  };

  const handleInlineTranslate = useCallback(async () => {
    abortRef.current = false;

    const sel = window.getSelection();
    const selectedText = sel?.toString().trim();

    let elementsToTranslate: Element[] = [];
    const textSelectors = getTextSelectors();

    const isElementEligibleWithBlacklist = (el: Element) => {
      return isElementEligible(el, { blacklist, isBlacklistEnabled: true });
    };

    if (selectedText && selectedText.length > 0) {
      const range = sel?.getRangeAt(0);
      const commonAncestor = range?.commonAncestorContainer;
      const rootElement = commonAncestor
        ? (commonAncestor.nodeType === Node.ELEMENT_NODE
          ? (commonAncestor as Element)
          : commonAncestor.parentElement)
        : null;

      if (range && rootElement) {
        const inRangeElements: Element[] = [];
        if (rootElement.matches(textSelectors)) {
          inRangeElements.push(rootElement);
        }

        const candidates = Array.from(rootElement.querySelectorAll(textSelectors));
        for (const el of candidates) {
          try {
            if (range.intersectsNode(el)) {
              inRangeElements.push(el);
            }
          } catch {
            // Silently ignore errors from intersectsNode for incompatible node types
          }
        }

        const allElements = inRangeElements.filter(isElementEligibleWithBlacklist);
        const filteredElements = filterVisibleElements(allElements);
        elementsToTranslate = ContentPriority.sortByVisibility(filteredElements);
      }

      if (elementsToTranslate.length === 0) {
        let node = sel?.anchorNode;
        while (node && node.nodeType === Node.TEXT_NODE) {
          node = node.parentElement;
        }
        if (node && node instanceof Element && isElementEligibleWithBlacklist(node)) {
          elementsToTranslate = [node];
        }
      }
    } else {
      const allElements = Array.from(document.querySelectorAll(textSelectors))
        .filter(isElementEligibleWithBlacklist);
      const filteredElements = filterVisibleElements(allElements);
      elementsToTranslate = ContentPriority.sortByVisibility(filteredElements);
    }

    if (elementsToTranslate.length === 0) {
      alert(t.noSelection[uiLang]);
      return;
    }

    setIsTranslating(true);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .select-ai-translation-container.block-mode.show {
        display: block !important;
        opacity: 1 !important;
        width: 100%;
      }
      .select-ai-translation-container.inline-mode.show {
        display: inline !important;
        opacity: 0.9 !important;
        vertical-align: baseline !important;
      }
      .select-ai-translation-container.inline-mode {
        vertical-align: baseline;
      }
      .select-ai-translation-container.block-mode {
        vertical-align: top;
      }
    `;
    if (!document.head.querySelector('#select-ai-translation-style')) {
      style.id = 'select-ai-translation-style';
      document.head.appendChild(style);
    }

    if (!chrome.runtime?.id) {
      setIsTranslating(false);
      return;
    }

    const items = prepareTranslationItems(elementsToTranslate);
    const allPromises: Promise<void>[] = [];

    for (const item of items) {
      if (abortRef.current) break;

      const element = item.element;
      const id = item.id;
      const text = item.text;
      const useInlineMode = item.useInlineMode;
      const inheritedStyles = getComputedStyles(element);

      createTranslationContainer(element, id, useInlineMode, inheritedStyles);

      if (item.originalHTML) {
        const container = document.getElementById(id);
        if (container) {
          container.setAttribute('data-original-html', item.originalHTML);
        }
      }

      element.setAttribute('data-select-ai-translated', 'true');
      element.setAttribute('data-select-ai-inline-mode', useInlineMode ? 'true' : 'false');

      allPromises.push(translateElement(element, id, text, item.originalHTML));
    }

    Promise.allSettled(allPromises).then(() => {
      setIsTranslating(false);
    });
  }, [blacklist, targetLang, uiLang, abortRef, translationCache, translatedIds]);

  const handleButtonClick = useCallback(() => {
    if (isDragging || wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }

    if (isTranslating) {
      abortRef.current = true;
      setIsTranslating(false);
      return;
    }

    if (isTranslated && translatedIds.size > 0) {
      clearAllTranslations();
      setIsTranslated(false);
    } else {
      const sel = window.getSelection();
      const selectedText = sel?.toString().trim();

      if (selectedText && selectedText.length > 0) {
        clearAllTranslations();
        handleInlineTranslate();
        setIsTranslated(true);
      } else {
        if (translationCache.size > 0) {
          translatedIds.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
              container.style.display = container.classList.contains('inline-mode') ? 'inline' : 'block';
              setTimeout(() => container.classList.add('show'), 10);
            }
          });
          setIsTranslated(true);
        } else {
          handleInlineTranslate();
          setIsTranslated(true);
        }
      }
    }
  }, [isDragging, isTranslating, isTranslated, translatedIds, translationCache, abortRef, clearAllTranslations, handleInlineTranslate]);

  const handleMouseOver = (e: React.MouseEvent) => {
    if (!isTranslating && !isDragging) {
      const target = e.currentTarget as HTMLElement;
      target.style.transform = 'scale(1.15)';
      target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.5)';
    }
  };

  const handleMouseOut = (e: React.MouseEvent) => {
    if (!isTranslating && !isDragging) {
      const target = e.currentTarget as HTMLElement;
      target.style.transform = 'scale(1)';
      target.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.5)';
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <FloatingButton
        isTranslating={isTranslating}
        isDragging={isDragging}
        position={position}
        onDragStart={handleDragStart}
        onClick={handleButtonClick}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        uiLang={uiLang}
        isFullscreen={isFullscreen}
      />
    </>
  );
};

const InlineTranslator: React.FC<InlineTranslatorProps> = ({ blacklist }) => {
  return (
    <TranslationProvider>
      <InlineTranslatorInner blacklist={blacklist} />
    </TranslationProvider>
  );
};

export default InlineTranslator;
