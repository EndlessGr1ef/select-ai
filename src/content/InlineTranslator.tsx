import React, { useState, useEffect, useCallback } from 'react';
import { TranslationProvider, useTranslation } from './context/TranslationContext';
import { FloatingButton, useDraggable } from './components/FloatingButton';
import { SiteBlacklist } from '../utils/SiteBlacklist';
import { translations } from '../utils/i18n';
import { detectTextLanguage } from '../utils/language';
import { buildPlaceholderTemplate, applyPlaceholderTranslation } from './utils/placeholder';
import {
  getDirectTextContent,
  getTextSelectors,
  isElementEligible,
  prepareTranslationItems,
  filterVisibleElements,
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
  const { isDragging, position, wasDraggingRef, handleDragStart, buttonRef } = useDraggable();

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

  const getComputedStyles = (element: Element): Record<string, string> => {
    const computedStyle = window.getComputedStyle(element);

    return {
      color: computedStyle.color,
      backgroundColor: 'transparent',
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
      lineHeight: computedStyle.lineHeight,
      textAlign: computedStyle.textAlign,
      opacity: '1',
    };
  };

  const createTranslationContainer = (
    element: Element,
    id: string,
    useInlineMode: boolean,
    inheritedStyles: Record<string, string>
  ): void => {
    const container = document.createElement('span');
    container.id = id;
    container.className = `select-ai-translation-container ${useInlineMode ? 'inline-mode' : 'block-mode'}`;

    // 应用通用样式
    Object.assign(container.style, inheritedStyles);

    if (useInlineMode) {
      container.style.display = 'none';
      container.style.opacity = '0';
      container.style.transition = 'opacity 0.3s ease';
      container.style.marginLeft = '0.4em';
      container.style.whiteSpace = 'normal';
      container.style.overflowWrap = 'break-word';
      container.style.maxWidth = '100%';

      const loadingSpan = document.createElement('span');
      loadingSpan.className = 'translation-loading';
      loadingSpan.style.display = 'inline-flex';
      loadingSpan.style.alignItems = 'center';
      loadingSpan.style.gap = '4px';
      Object.assign(loadingSpan.style, inheritedStyles);

      const spinner = document.createElement('span');
      spinner.style.width = '10px';
      spinner.style.height = '10px';
      spinner.style.border = '1.5px solid currentColor';
      spinner.style.borderTopColor = 'transparent';
      spinner.style.borderRadius = '50%';
      spinner.style.animation = 'spin 1s linear infinite';
      loadingSpan.appendChild(spinner);

      const contentSpan = document.createElement('span');
      contentSpan.className = 'translation-content';
      contentSpan.style.display = 'none';
      contentSpan.style.whiteSpace = 'normal';
      contentSpan.style.overflowWrap = 'break-word';
      Object.assign(contentSpan.style, inheritedStyles);

      container.appendChild(loadingSpan);
      container.appendChild(contentSpan);

      // 对于 <a> 标签，翻译容器应该插入到外部而不是内部，避免破坏链接结构
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'a' && element.parentElement) {
        element.parentElement.insertBefore(container, element.nextSibling);
      } else if (tagName === 'li' || tagName === 'dt' || tagName === 'dd') {
        const directText = getDirectTextContent(element);
        const listChild = element.querySelector(':scope > ul, :scope > ol');
        if (listChild && directText) {
          element.insertBefore(container, listChild);
        } else {
          element.appendChild(container);
        }
      } else {
        element.appendChild(container);
      }
    } else {
      container.style.display = 'none';
      container.style.opacity = '0';
      container.style.transition = 'opacity 0.3s ease';
      container.style.marginTop = '0.4em';
      container.style.marginBottom = '0.4em';
      container.style.width = '100%';
      Object.assign(container.style, inheritedStyles);

      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'translation-loading';
      loadingDiv.style.display = 'inline-flex';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.gap = '8px';
      Object.assign(loadingDiv.style, inheritedStyles);

      const spinner = document.createElement('span');
      spinner.style.width = '14px';
      spinner.style.height = '14px';
      spinner.style.border = '2px solid currentColor';
      spinner.style.borderTopColor = 'transparent';
      spinner.style.borderRadius = '50%';
      spinner.style.animation = 'spin 1s linear infinite';
      loadingDiv.appendChild(spinner);

      const loadingText = document.createElement('span');
      loadingText.style.fontSize = '0.9em';
      loadingText.textContent = t.translateLoading[uiLang];
      loadingDiv.appendChild(loadingText);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'translation-content';
      contentDiv.style.display = 'none';
      Object.assign(contentDiv.style, inheritedStyles);

      container.appendChild(loadingDiv);
      container.appendChild(contentDiv);

      const tagName = element.tagName.toLowerCase();
      const isListItem = tagName === 'li' || tagName === 'dt' || tagName === 'dd';
      const isTableCell = tagName === 'td' || tagName === 'th';
      if (isListItem) {
        const directText = getDirectTextContent(element);
        const listChild = element.querySelector(':scope > ul, :scope > ol');
        if (listChild && directText) {
          element.insertBefore(container, listChild);
        } else {
          element.appendChild(container);
        }
      } else if (isTableCell) {
        // 表格单元格：将翻译容器作为子元素
        element.appendChild(container);
      } else if (element.parentElement) {
        element.parentElement.insertBefore(container, element.nextSibling);
      }
    }
  };

  const updateTranslation = (
    id: string,
    text: string,
    placeholder?: ReturnType<typeof buildPlaceholderTemplate>,
    isFinal: boolean = false
  ) => {
    const container = document.getElementById(id);
    if (container) {
      const contentDiv = container.querySelector('.translation-content') as HTMLElement;
      if (contentDiv) {
        let html: string;
        if (placeholder) {
          html = applyPlaceholderTranslation(placeholder, text, parseMarkdown, { isFinal, fallbackToOriginal: true });
        } else {
          html = parseMarkdown(text);
        }
        contentDiv.innerHTML = html;
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
      element.removeAttribute('data-select-ai-translated');
      element.removeAttribute('data-select-ai-inline-mode');
      return;
    }

    await translate(translationInput, {
      targetLang,
      uiLang,
      onDelta: (data) => {
        translationCache.set(id, { text: data, originalHTML, placeholder: placeholderTemplate });
        translatedIds.add(id);
        updateTranslation(id, data, placeholderTemplate, false);
      },
      onDone: (data) => {
        if (data) {
          translationCache.set(id, { text: data, originalHTML, placeholder: placeholderTemplate });
          translatedIds.add(id);
          updateTranslation(id, data, placeholderTemplate, true);
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
        elementsToTranslate = ContentPriority.sortByVisibility(allElements);
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
      elementsToTranslate = ContentPriority.sortByVisibility(allElements);
    }

    if (elementsToTranslate.length === 0) {
      alert(t.noSelection[uiLang]);
      return;
    }

    // Filter out nested elements to avoid duplicate translations
    elementsToTranslate = filterVisibleElements(elementsToTranslate);

    if (elementsToTranslate.length === 0) {
      return;
    }
    const style = document.createElement('style');
    style.textContent = `
      @keyframes select-ai-spin {
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
        white-space: normal !important;
        word-wrap: break-word !important;
      }
      .select-ai-translation-container.inline-mode {
        vertical-align: baseline;
      }
      .select-ai-translation-container.block-mode {
        vertical-align: top;
      }
      .select-ai-translation-container br {
        display: inline;
        line-height: 1.4;
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
        setIsTranslating(true);
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
          setIsTranslating(true);
          handleInlineTranslate();
          setIsTranslated(true);
        }
      }
    }
  }, [isDragging, isTranslating, isTranslated, translatedIds, translationCache, abortRef, clearAllTranslations, handleInlineTranslate, setIsTranslating, setIsTranslated]);

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
        @keyframes select-ai-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .select-ai-loading-spinner {
          animation: select-ai-spin 0.8s linear infinite !important;
        }
      `}</style>

      <FloatingButton
        ref={buttonRef}
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
