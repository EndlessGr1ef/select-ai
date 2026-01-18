import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getUILanguage, isBrowserChinese, detectTextLanguage } from '../utils/language';
import { translations } from '../utils/i18n';
import { SiteBlacklist } from '../utils/SiteBlacklist';
import { ContentPriority } from '../utils/ContentPriority';

const INLINE_DISPLAY_THRESHOLD = 100;

interface InlineTranslatorProps {
  blacklist: SiteBlacklist;
}

const InlineTranslator: React.FC<InlineTranslatorProps> = ({ blacklist }) => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const defaultTargetLang = isBrowserChinese() ? '中文' : 'English';
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const streamPortRef = useRef<chrome.runtime.Port | null>(null);
  const translationCache = useRef<Map<string, { text: string; originalHTML?: string }>>(new Map());
  const translatedIdsRef = useRef<Set<string>>(new Set());

  const [position, setPosition] = useState({ x: window.innerWidth - 48, y: window.innerHeight / 2 - 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ offsetX: number; offsetY: number; startX: number; startY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);
  const abortRef = useRef(false);

  const t = translations.content;

  useEffect(() => {
    setLang(getUILanguage());
  }, []);

  useEffect(() => {
    const getTargetLang = async () => {
      const result = await chrome.storage.local.get(['targetLanguage']);
      setTargetLang((result.targetLanguage as string) || defaultTargetLang);
    };
    getTargetLang();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.targetLanguage) {
        setTargetLang((changes.targetLanguage.newValue as string) || defaultTargetLang);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    wasDraggingRef.current = false;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      dragStartRef.current = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        startX: e.clientX,
        startY: e.clientY,
      };
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const distance = Math.sqrt(
        Math.pow(e.clientX - dragStartRef.current.startX, 2) +
        Math.pow(e.clientY - dragStartRef.current.startY, 2)
      );

      if (distance > 5) {
        wasDraggingRef.current = true;
      }

      setPosition({
        x: e.clientX - dragStartRef.current.offsetX,
        y: e.clientY - dragStartRef.current.offsetY,
      });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  const disconnectStreamPort = () => {
    if (streamPortRef.current) {
      streamPortRef.current.disconnect();
      streamPortRef.current = null;
    }
  };

  const hideAllTranslations = useCallback(() => {
    translatedIdsRef.current.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        container.classList.remove('show');
        container.style.display = 'none';
      }
    });
  }, []);

  const parseMarkdown = useCallback((text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');
  }, []);

  const applyTranslationToStructure = useCallback((originalHTML: string, translatedText: string): string => {
    if (!originalHTML.includes('<') || !originalHTML.includes('>')) {
      return translatedText;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(originalHTML, 'text/html');
      let originalText = '';
      const collectText = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          originalText += node.textContent || '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          for (const child of node.childNodes) {
            collectText(child);
          }
        }
      };
      collectText(doc.body);

      if (!originalText.trim()) {
        return translatedText;
      }

      const translateNodes = (node: Node, translatedIdx: { current: number }) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const textLen = node.textContent?.length || 0;
          if (textLen > 0) {
            const startIdx = translatedIdx.current;
            const endIdx = startIdx + textLen;
            if (startIdx < translatedText.length) {
              node.textContent = translatedText.slice(startIdx);
            }
            translatedIdx.current = endIdx;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          for (const child of Array.from(node.childNodes)) {
            translateNodes(child, translatedIdx);
          }
        }
      };

      translateNodes(doc.body, { current: 0 });
      return doc.body.innerHTML;
    } catch (e) {
      return translatedText;
    }
  }, []);

  const clearAllTranslations = useCallback(() => {
    translatedIdsRef.current.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        const parent = container.parentElement;
        if (parent?.hasAttribute('data-select-ai-inline-mode')) {
          parent.removeAttribute('data-select-ai-translated');
          parent.removeAttribute('data-select-ai-inline-mode');
        }
        container.remove();
      }
    });
    translatedIdsRef.current.clear();
    translationCache.current.clear();
  }, []);

  const showAllTranslations = useCallback(() => {
    translatedIdsRef.current.forEach(id => {
      const container = document.getElementById(id);
      const cachedTranslation = translationCache.current.get(id);
      if (container && cachedTranslation) {
        const contentDiv = container.querySelector('.translation-content') as HTMLElement;
        const loadingDiv = container.querySelector('.translation-loading') as HTMLElement;
        const isInlineMode = container.classList.contains('inline-mode');
        const originalHTML = container.getAttribute('data-original-html') || undefined;
        if (contentDiv) {
          const parsed = parseMarkdown(cachedTranslation.text);
          const finalHTML = originalHTML ? applyTranslationToStructure(originalHTML, parsed) : parsed;
          contentDiv.innerHTML = finalHTML;
          contentDiv.style.display = isInlineMode ? 'inline' : 'block';
          if (loadingDiv) loadingDiv.style.display = 'none';
        }
        container.style.display = isInlineMode ? 'inline' : 'block';
        setTimeout(() => container.classList.add('show'), 10);
      }
    });
  }, [parseMarkdown, applyTranslationToStructure]);

  const updateTranslation = useCallback((id: string, text: string, originalHTML?: string) => {
    const container = document.getElementById(id);
    if (container) {
      const contentDiv = container.querySelector('.translation-content') as HTMLElement;
      const loadingDiv = container.querySelector('.translation-loading') as HTMLElement;
      const isInlineMode = container.classList.contains('inline-mode');
      if (contentDiv) {
        const parsed = parseMarkdown(text);
        const finalHTML = originalHTML ? applyTranslationToStructure(originalHTML, parsed) : parsed;
        contentDiv.innerHTML = finalHTML;
        contentDiv.style.display = isInlineMode ? 'inline' : 'block';
        if (loadingDiv) loadingDiv.style.display = 'none';
        container.classList.add('show');
      }
    }
  }, [parseMarkdown, applyTranslationToStructure]);

  const getDirectTextContent = useCallback((element: Element): string => {
    let text = '';
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        if (['span', 'a', 'strong', 'b', 'em', 'i', 'code'].includes(tagName)) {
          const outerHTML = el.outerHTML;
          text += outerHTML;
        } else {
          text += el.textContent || '';
        }
      }
    }
    return text.trim();
  }, []);

  const hasNestedList = useCallback((element: Element): boolean => {
    return element.querySelector('ul, ol') !== null;
  }, []);

  const shouldUseInlineMode = useCallback((element: Element, text: string): boolean => {
    if (text.length > INLINE_DISPLAY_THRESHOLD) return false;

    const tagName = element.tagName.toLowerCase();
    const inlineSuitableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'dt', 'th', 'td', 'a'];
    if (!inlineSuitableTags.includes(tagName)) return false;

    const rect = element.getBoundingClientRect();
    const parentWidth = element.parentElement?.getBoundingClientRect().width || window.innerWidth;
    const estimatedTranslationWidth = rect.width * 0.9;
    const availableWidth = parentWidth - rect.width;

    return availableWidth >= parentWidth * 0.25 || availableWidth >= estimatedTranslationWidth + 40;
  }, []);

  const translateElement = useCallback(async (
    element: Element,
    id: string,
    directText?: string,
    originalHTML?: string
  ): Promise<void> => {
    const text = directText || element.textContent?.trim() || '';
    if (!text) {
      const container = document.getElementById(id);
      if (container) container.remove();
      return;
    }

    const detectedLang = detectTextLanguage(text);
    const isSameLang = (detectedLang === 'zh' && targetLang.startsWith('中文')) ||
      (detectedLang === 'en' && targetLang === 'English');

    if (isSameLang) {
      const container = document.getElementById(id);
      if (container) container.remove();
      return;
    }

    return new Promise((resolve) => {
      const payload = { selection: text, targetLang, uiLang: lang };

      let port: chrome.runtime.Port | null = null;
      let connected = false;
      let resolved = false;

      const cleanup = () => {
        if (port) {
          try {
            port.onMessage.removeListener(messageHandler);
            port.onDisconnect.removeListener(disconnectHandler);
          } catch (e) {
          }
        }
      };

      const disconnectHandler = () => {
        streamPortRef.current = null;
        cleanup();
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const messageHandler = (message: any) => {
        if (abortRef.current) {
          cleanup();
          if (!resolved) {
            resolved = true;
            try { port?.disconnect(); } catch (e) { }
            resolve();
          }
          return;
        }

        if (message?.type === 'delta') {
          fullTranslation += message.data || '';
          updateTranslation(id, fullTranslation, originalHTML);
        } else if (message?.type === 'done') {
          if (!resolved) {
            resolved = true;
            if (fullTranslation) {
              translationCache.current.set(id, { text: fullTranslation, originalHTML });
              translatedIdsRef.current.add(id);
            }
            cleanup();
            try {
              port?.disconnect();
            } catch (e) {
            }
            resolve();
          }
        } else if (message?.type === 'error') {
          if (!resolved) {
            resolved = true;
            cleanup();
            const container = document.getElementById(id);
            if (container) {
              container.innerHTML = `<span style="color: #dc2626;">${t.errorTitle[lang]} ${message.error || 'Translation error'}</span>`;
              container.classList.add('show');
            }
            try {
              port?.disconnect();
            } catch (e) {
            }
            resolve();
          }
        }
      };

      let fullTranslation = '';

      const tryConnect = (attempt: number) => {
        if (resolved || attempt > 3 || abortRef.current) {
          if (!resolved) {
            resolved = true;
            const container = document.getElementById(id);
            if (container) {
              container.innerHTML = `<span style="color: #dc2626;">${t.errorTitle[lang]} Connection failed</span>`;
              container.classList.add('show');
            }
          }
          resolve();
          return;
        }

        try {
          if (!chrome.runtime?.id) {
            throw new Error('Extension context invalidated');
          }

          port = chrome.runtime.connect({ name: 'ai-translate-stream' });

          if (!port) {
            throw new Error('Port is null');
          }

          connected = true;
          streamPortRef.current = port;

          port.onMessage.addListener(messageHandler);
          port.onDisconnect.addListener(disconnectHandler);

          setTimeout(() => {
            if (!connected || !port || resolved || abortRef.current) {
              return;
            }
            try {
              port.postMessage({ action: 'inlineTranslate', payload });
            } catch (e) {
              cleanup();
              if (!resolved) {
                setTimeout(() => {
                  if (!resolved) {
                    tryConnect(attempt + 1);
                  }
                }, 50 * Math.pow(2, Math.min(attempt, 5)) + Math.random() * 50);
              }
            }
          }, 10);
        } catch (e) {
          console.error(`[Inline Translate] Connection attempt ${attempt} failed:`, e);
          cleanup();
          if (!resolved) {
            setTimeout(() => {
              if (!resolved) {
                tryConnect(attempt + 1);
              }
            }, 50 * Math.pow(2, Math.min(attempt, 5)) + Math.random() * 50);
          }
        }
      };

      tryConnect(0);
    });
  }, [lang, targetLang, updateTranslation, t, abortRef]);

  const handleInlineTranslate = useCallback(async () => {
    abortRef.current = false;

    const sel = window.getSelection();
    const selectedText = sel?.toString().trim();

    let elementsToTranslate: Element[] = [];

    if (selectedText && selectedText.length > 0) {
      let node = sel?.anchorNode;
      while (node && node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      if (node && node instanceof Element) {
        elementsToTranslate = [node];
      }
    } else {
      const textSelectors = [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li',
        'td', 'th', 'dd', 'dt', 'blockquote', 'a'
      ].join(',');

      const settings = await chrome.storage.local.get(['translationBlacklistEnabled']);
      const isBlacklistEnabled = settings.translationBlacklistEnabled !== false;

      const allElements = Array.from(document.querySelectorAll(textSelectors))
        .filter(el => {
          if (isBlacklistEnabled) {
            if (blacklist.isElementBlocked(el)) return false;
          }

          if (el.hasAttribute('data-select-ai-translated')) return false;
          if (el.closest('[data-select-ai-translated]')) return false;

          const tagName = el.tagName.toLowerCase();
          if (tagName === 'li' && hasNestedList(el)) {
            const directText = getDirectTextContent(el);
            if (!directText) return false;
          }

          const text = el.textContent?.trim() || '';
          return text.length > 0 && text.length < 5000 && !el.querySelector('script, style');
        });

      const filteredElements: Element[] = [];
      for (const el of allElements) {
        const hasVisibleChildInList = allElements.some(otherEl =>
          otherEl !== el && el.contains(otherEl)
        );
        if (!hasVisibleChildInList) {
          filteredElements.push(el);
        }
      }

      elementsToTranslate = ContentPriority.sortByVisibility(filteredElements);
    }

    if (elementsToTranslate.length === 0) {
      alert(t.noSelection[lang]);
      return;
    }

    setIsTranslating(true);

    const items: { element: Element; id: string; text: string; originalHTML?: string }[] = [];

    for (const element of elementsToTranslate) {
      if (abortRef.current) break;
      const id = `translation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      const tagName = element.tagName.toLowerCase();
      const hasNested = tagName === 'li' && hasNestedList(element);
      const text = hasNested ? getDirectTextContent(element) : (element.textContent?.trim() || '');

      let originalHTML: string | undefined;
      if (hasNested) {
        originalHTML = getDirectTextContent(element);
      } else {
        const hasSpanChild = element.querySelector('span');
        if (hasSpanChild) {
          originalHTML = getDirectTextContent(element);
        }
      }

      if (!text) continue;

      items.push({ element, id, text, originalHTML });
    }

    if (abortRef.current) {
      setIsTranslating(false);
      clearAllTranslations();
      return;
    }

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

    const allPromises: Promise<void>[] = [];

    for (const item of items) {
      if (abortRef.current) break;

      const element = item.element;
      const id = item.id;
      const text = item.text;
      const tagName = element.tagName.toLowerCase();

      const useInlineMode = shouldUseInlineMode(element, text);
      const computedStyle = window.getComputedStyle(element);

      const inheritedStyles = `
        color: ${computedStyle.color};
        background-color: transparent;
        font-family: ${computedStyle.fontFamily};
        font-size: 0.9em;
        font-weight: ${computedStyle.fontWeight};
        line-height: ${computedStyle.lineHeight};
        text-align: ${computedStyle.textAlign};
        opacity: 1;
      `;

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
            <span style="font-size: 0.9em;">${t.translateLoading[lang]}</span>
          </div>
          <div class="translation-content" style="display: none; ${inheritedStyles}"></div>
        `;

        const isListItem = tagName === 'li' || tagName === 'dt' || tagName === 'dd';
        if (isListItem) {
          element.appendChild(container);
        } else if (element.parentElement) {
          element.parentElement.insertBefore(container, element.nextSibling);
        }
      }

      if (item.originalHTML) {
        container.setAttribute('data-original-html', item.originalHTML);
      }

      element.setAttribute('data-select-ai-translated', 'true');
      element.setAttribute('data-select-ai-inline-mode', useInlineMode ? 'true' : 'false');

      allPromises.push(translateElement(element, id, text, item.originalHTML));
    }

    Promise.allSettled(allPromises).then(() => {
      setIsTranslating(false);
    });

  }, [lang, t, translateElement, setIsTranslated, showAllTranslations, blacklist, getDirectTextContent, hasNestedList, targetLang, updateTranslation, shouldUseInlineMode, clearAllTranslations, abortRef]);

  useEffect(() => {
    return () => {
      disconnectStreamPort();
    };
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        ref={buttonRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isTranslating ? '#9ca3af' : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
          boxShadow: isTranslating ? '0 2px 8px rgba(156, 163, 175, 0.4)' : '0 2px 8px rgba(139, 92, 246, 0.5)',
          cursor: isDragging ? 'grabbing' : 'pointer',
          zIndex: 2147483646,
          display: isFullscreen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 14,
          border: 'none',
          transition: isDragging ? 'none' : 'transform 0.2s, box-shadow 0.2s, background-color 0.2s',
          touchAction: 'none',
        }}
        onMouseDown={isTranslating ? undefined : handleDragStart}
        onClick={() => {
          if (isDragging || wasDraggingRef.current) {
            wasDraggingRef.current = false;
            return;
          }

          if (isTranslating) {
            abortRef.current = true;
            setIsTranslating(false);
            return;
          }

          if (isTranslated && translatedIdsRef.current.size > 0) {
            hideAllTranslations();
            setIsTranslated(false);
          } else {
            const sel = window.getSelection();
            const selectedText = sel?.toString().trim();

            if (selectedText && selectedText.length > 0) {
              clearAllTranslations();
              handleInlineTranslate();
              setIsTranslated(true);
            } else {
              if (translationCache.current.size > 0) {
                showAllTranslations();
                setIsTranslated(true);
              } else {
                handleInlineTranslate();
                setIsTranslated(true);
              }
            }
          }
        }}
        onMouseOver={(e) => {
          if (!isTranslating && !isDragging) {
            e.currentTarget.style.transform = 'scale(1.15)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.5)';
          }
        }}
        onMouseOut={(e) => {
          if (!isTranslating && !isDragging) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.5)';
          }
        }}
        title={t.translateBtn[lang]}
      >
        {isTranslating ? (
          <span style={{
            width: 10,
            height: 10,
            border: '2px solid #fff',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}></span>
        ) : (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
            letterSpacing: 0.5,
          }}>
            {lang === 'zh' ? '译' : 'Tr'}
          </span>
        )}
      </div>
    </>
  );
};

export default InlineTranslator;
