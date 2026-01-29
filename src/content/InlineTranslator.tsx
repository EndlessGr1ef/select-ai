import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TranslationProvider, useTranslation } from './context/TranslationContext';
import type { TranslationCacheEntry } from './context/TranslationContext';
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

// Generate a content hash for SPA change detection
function generateContentHash(): string {
  const selectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th';
  const elements = document.querySelectorAll(selectors);

  // Take first 50 elements' text content
  const contentSample = Array.from(elements)
    .slice(0, 50)
    .map(el => el.textContent?.trim().slice(0, 100)) // Limit each element to 100 chars
    .filter(Boolean)
    .join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < contentSample.length; i++) {
    const char = contentSample.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

const InlineTranslatorInner: React.FC<{ blacklist: SiteBlacklist }> = ({ blacklist }) => {
  const {
    targetLang,
    uiLang,
    isTranslating,
    setIsTranslating,
    abortRef,
    translationButtonEnabled,

    // Mode and visibility
    activeMode,
    isShowingTranslation,
    setActiveMode,
    setIsShowingTranslation,

    // Full page
    fullPageCache,
    fullPageIds,
    fullPageContentHash,
    setFullPageContentHash,
    hideFullPageTranslations,
    showFullPageTranslations,

    // Selection
    addSelectionCache,
    selectionCacheList,
    clearSelectionTranslations,

    // Clear all
    clearAllTranslations,
  } = useTranslation();

  const { translate, disconnect } = useTranslationStream();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isDragging, position, wasDraggingRef, handleDragStart, buttonRef } = useDraggable();

  // Current working cache and ids (for active translation)
  const currentCacheRef = useRef<Map<string, TranslationCacheEntry>>(new Map());
  const currentIdsRef = useRef<Set<string>>(new Set());

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
    // Remove from current working cache
    currentCacheRef.current.delete(id);
    currentIdsRef.current.delete(id);
  };

  const translateElement = async (
    element: Element,
    id: string,
    text: string,
    cache: Map<string, TranslationCacheEntry>,
    ids: Set<string>,
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
        cache.set(id, { text: data, originalHTML, placeholder: placeholderTemplate });
        ids.add(id);
        updateTranslation(id, data, placeholderTemplate, false);
      },
      onDone: (data) => {
        if (data) {
          cache.set(id, { text: data, originalHTML, placeholder: placeholderTemplate });
          ids.add(id);
          updateTranslation(id, data, placeholderTemplate, true);
        }
      },
      onError: (error) => {
        console.error('[Inline Translate] Stream error:', error);
        removeFailedTranslation(id, element);
      },
    });
  };

  // Translate elements and store in provided cache
  const doTranslate = useCallback(async (
    elementsToTranslate: Element[],
    cache: Map<string, TranslationCacheEntry>,
    ids: Set<string>
  ) => {
    // Inject styles if needed
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

      allPromises.push(translateElement(element, id, text, cache, ids, item.originalHTML));
    }

    await Promise.allSettled(allPromises);
    setIsTranslating(false);
  }, [targetLang, uiLang, abortRef, setIsTranslating]);

  // Handle full page translation
  const handleFullPageTranslate = useCallback(async () => {
    abortRef.current = false;

    const textSelectors = getTextSelectors();
    const isElementEligibleWithBlacklist = (el: Element) => {
      return isElementEligible(el, { blacklist, isBlacklistEnabled: true });
    };

    const allElements = Array.from(document.querySelectorAll(textSelectors))
      .filter(isElementEligibleWithBlacklist);
    let elementsToTranslate = ContentPriority.sortByVisibility(allElements);
    elementsToTranslate = filterVisibleElements(elementsToTranslate);

    if (elementsToTranslate.length === 0) {
      alert(t.noSelection[uiLang]);
      setIsTranslating(false);
      return;
    }

    // Check content hash for SPA detection
    const currentHash = generateContentHash();
    const hashChanged = currentHash !== fullPageContentHash;

    // If we have cache and hash is same, just show cached translations
    if (fullPageCache.size > 0 && !hashChanged) {
      showFullPageTranslations();
      setActiveMode('fullPage');
      setIsShowingTranslation(true);
      setIsTranslating(false);
      return;
    }

    // Content changed or no cache - need to re-translate
    // Clear old full page translations first
    if (fullPageIds.size > 0) {
      fullPageIds.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
          const parent = container.parentElement;
          if (parent) {
            parent.removeAttribute('data-select-ai-translated');
            parent.removeAttribute('data-select-ai-inline-mode');
          }
          container.remove();
        }
      });
      fullPageIds.clear();
      fullPageCache.clear();
    }

    // Update content hash
    setFullPageContentHash(currentHash);

    // Store refs for the translation
    currentCacheRef.current = fullPageCache;
    currentIdsRef.current = fullPageIds;

    await doTranslate(elementsToTranslate, fullPageCache, fullPageIds);

    setActiveMode('fullPage');
    setIsShowingTranslation(true);
  }, [blacklist, uiLang, abortRef, fullPageCache, fullPageIds, fullPageContentHash, setFullPageContentHash, showFullPageTranslations, setActiveMode, setIsShowingTranslation, setIsTranslating, doTranslate, t]);

  // Handle selection translation
  const handleSelectionTranslate = useCallback(async () => {
    abortRef.current = false;

    const sel = window.getSelection();
    const textSelectors = getTextSelectors();
    const isElementEligibleWithBlacklist = (el: Element) => {
      return isElementEligible(el, { blacklist, isBlacklistEnabled: true });
    };

    const range = sel?.getRangeAt(0);
    const commonAncestor = range?.commonAncestorContainer;
    const rootElement = commonAncestor
      ? (commonAncestor.nodeType === Node.ELEMENT_NODE
        ? (commonAncestor as Element)
        : commonAncestor.parentElement)
      : null;

    let elementsToTranslate: Element[] = [];

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
          // Silently ignore
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

    elementsToTranslate = filterVisibleElements(elementsToTranslate);

    if (elementsToTranslate.length === 0) {
      alert(t.noSelection[uiLang]);
      setIsTranslating(false);
      return;
    }

    // Create new selection cache entry (will auto-remove oldest if > 5)
    const { cache, ids } = addSelectionCache();

    // Store refs for the translation
    currentCacheRef.current = cache;
    currentIdsRef.current = ids;

    await doTranslate(elementsToTranslate, cache, ids);

    setActiveMode('selection');
    setIsShowingTranslation(true);
  }, [blacklist, uiLang, abortRef, addSelectionCache, setActiveMode, setIsShowingTranslation, setIsTranslating, doTranslate, t]);

  const handleButtonClick = useCallback(() => {
    if (isDragging || wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }

    // If currently translating, abort
    if (isTranslating) {
      abortRef.current = true;
      setIsTranslating(false);
      return;
    }

    const sel = window.getSelection();
    const selectedText = sel?.toString().trim();
    const hasSelection = selectedText && selectedText.length > 0;

    // Check if there are any translations on page
    const hasAnyTranslations = fullPageIds.size > 0 || selectionCacheList.some(entry => entry.ids.size > 0);

    if (hasSelection) {
      // Selection translation mode
      // Check if selected elements are already translated
      const range = sel?.getRangeAt(0);
      const commonAncestor = range?.commonAncestorContainer;
      const rootElement = commonAncestor
        ? (commonAncestor.nodeType === Node.ELEMENT_NODE
          ? (commonAncestor as Element)
          : commonAncestor.parentElement)
        : null;

      let hasTranslatedElements = false;
      if (rootElement) {
        // Check if root element or any child has translation
        if (rootElement.hasAttribute('data-select-ai-translated')) {
          hasTranslatedElements = true;
        } else {
          const translatedChildren = rootElement.querySelectorAll('[data-select-ai-translated]');
          if (translatedChildren.length > 0) {
            // Check if any translated element intersects with selection
            for (const el of translatedChildren) {
              try {
                if (range?.intersectsNode(el)) {
                  hasTranslatedElements = true;
                  break;
                }
              } catch {
                // Ignore
              }
            }
          }
        }
      }

      if (hasTranslatedElements) {
        // Clear selection translations (toggle off)
        clearSelectionTranslations();
      } else {
        // Hide full page translations (but keep cache)
        if (activeMode === 'fullPage' && isShowingTranslation) {
          hideFullPageTranslations();
        }

        setIsTranslating(true);
        handleSelectionTranslate();
      }
    } else {
      // No selection: toggle between translate all / clear all
      if (hasAnyTranslations) {
        // Clear all translations
        clearAllTranslations();
      } else {
        // No translations, start full page translation
        setIsTranslating(true);
        handleFullPageTranslate();
      }
    }
  }, [
    isDragging, isTranslating, activeMode, isShowingTranslation,
    fullPageIds, selectionCacheList, abortRef,
    hideFullPageTranslations, clearAllTranslations, clearSelectionTranslations,
    handleFullPageTranslate, handleSelectionTranslate,
    setIsTranslating
  ]);

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

  // If translation button is disabled in options, don't render anything
  if (!translationButtonEnabled) {
    return null;
  }

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
