import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getUILanguage, isBrowserChinese, detectTextLanguage } from '../utils/language';
import { translations } from '../utils/i18n';
import { SiteBlacklist } from '../utils/SiteBlacklist';
import { ContentPriority } from '../utils/ContentPriority';

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
  const translationCache = useRef<Map<string, string>>(new Map());
  const translatedIdsRef = useRef<Set<string>>(new Set());

  // Drag state
  const [position, setPosition] = useState({ x: window.innerWidth - 48, y: window.innerHeight / 2 - 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ offsetX: number; offsetY: number; startX: number; startY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);

  const t = translations.content;

  useEffect(() => {
    setLang(getUILanguage());
  }, []);

  // Load target language settings
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

  // Drag handling
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

      // Check if significant drag occurred (moved more than 5 pixels)
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

  // Hide all translation containers
  const hideAllTranslations = useCallback(() => {
    translatedIdsRef.current.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        container.classList.remove('show');
        container.style.display = 'none';
      }
    });
  }, []);

  // Clear all translation containers and cache
  const clearAllTranslations = useCallback(() => {
    translatedIdsRef.current.forEach(id => {
      const container = document.getElementById(id);
      if (container) container.remove();
    });
    translatedIdsRef.current.clear();
    translationCache.current.clear();
  }, []);

  // Show all translation containers (restore from cache)
  const showAllTranslations = useCallback(() => {
    translatedIdsRef.current.forEach(id => {
      const container = document.getElementById(id);
      const cachedTranslation = translationCache.current.get(id);
      if (container && cachedTranslation) {
        const contentDiv = container.querySelector('.translation-content') as HTMLElement;
        const loadingDiv = container.querySelector('.translation-loading') as HTMLElement;
        if (contentDiv) {
          const parsed = parseMarkdown(cachedTranslation);
          contentDiv.innerHTML = parsed;
          contentDiv.style.display = 'block';
          if (loadingDiv) loadingDiv.style.display = 'none';
        }
        container.style.display = 'block';
        setTimeout(() => container.classList.add('show'), 10);
      }
    });
  }, []);

  // Update translation content
  const updateTranslation = useCallback((id: string, text: string) => {
    const container = document.getElementById(id);
    if (container) {
      const contentDiv = container.querySelector('.translation-content') as HTMLElement;
      const loadingDiv = container.querySelector('.translation-loading') as HTMLElement;
      if (contentDiv) {
        const parsed = parseMarkdown(text);
        contentDiv.innerHTML = parsed;
        contentDiv.style.display = 'block';
        if (loadingDiv) loadingDiv.style.display = 'none';
        container.classList.add('show');
      }
    }
  }, []);

  // Simple markdown parsing
  const parseMarkdown = useCallback((text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');
  }, []);

  // Translate single paragraph
  const translateElement = useCallback(async (
    element: Element,
    id: string
  ): Promise<void> => {
    const text = element.textContent?.trim() || '';
    if (!text) {
      const container = document.getElementById(id);
      if (container) container.remove();
      return;
    }

    // Detect text language, skip if same as target language
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
            // Ignore cleanup errors
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
        if (message?.type === 'delta') {
          fullTranslation += message.data || '';
          updateTranslation(id, fullTranslation);
        } else if (message?.type === 'done') {
          if (!resolved) {
            resolved = true;
            // Save translation result to cache
            if (fullTranslation) {
              translationCache.current.set(id, fullTranslation);
              translatedIdsRef.current.add(id);
            }
            cleanup();
            try {
              port?.disconnect();
            } catch (e) {
              // Ignore disconnect errors
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
              // Ignore disconnect errors
            }
            resolve();
          }
        }
      };

      let fullTranslation = '';

      const tryConnect = (attempt: number) => {
        if (resolved || attempt > 3) {
          if (!resolved) {
            resolved = true;
            const container = document.getElementById(id);
            if (container) {
              container.innerHTML = `<span style="color: #dc2626;">${t.errorTitle[lang]} Connection failed after ${attempt} attempts</span>`;
              container.classList.add('show');
            }
          }
          resolve();
          return;
        }

        try {
          // Check if chrome.runtime is available
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
            if (!connected || !port || resolved) {
              return;
            }
            try {
              port.postMessage({ action: 'inlineTranslate', payload });
            } catch (e) {
              console.error('[Inline Translate] Send error:', e);
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
  }, [lang, targetLang, updateTranslation, t]);

  // Page inline translation handler
  const handleInlineTranslate = useCallback(async () => {
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
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'td', 'th', 'dd', 'dt', 'blockquote', 'article',
        '.post', '.content', '.article', '.entry'
      ].join(',');

      const allElements = Array.from(document.querySelectorAll(textSelectors))
        .filter(el => {
          // Exclude elements in blacklist
          if (blacklist.isElementBlocked(el)) return false;

          // Skip already translated elements
          if (el.hasAttribute('data-select-ai-translated')) return false;

          // Skip elements with translated ancestors (avoid duplicate translation)
          if (el.closest('[data-select-ai-translated]')) return false;

          const text = el.textContent?.trim() || '';
          return text.length > 0 && text.length < 5000 &&
                 !ContentPriority.isExcluded(el) &&
                 !el.querySelector('script, style');
        });

      // Sort by main content priority (elements in main content area first)
      elementsToTranslate = ContentPriority.sortByMainContentPriority(allElements);
    }

    if (elementsToTranslate.length === 0) {
      alert(t.noSelection[lang]);
      return;
    }

    setIsTranslating(true);

    const elementIds: string[] = [];

    // Create container for each element
    for (const element of elementsToTranslate) {
      const id = `translation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      elementIds.push(id);

      // Inherit parent element styles
      const computedStyle = window.getComputedStyle(element);
      const inheritedStyles = `
        color: ${computedStyle.color};
        background-color: ${computedStyle.backgroundColor};
        font-family: ${computedStyle.fontFamily};
        font-size: ${computedStyle.fontSize};
        font-weight: ${computedStyle.fontWeight};
        line-height: ${computedStyle.lineHeight};
        text-align: ${computedStyle.textAlign};
      `;

      const container = document.createElement('div');
      container.id = id;
      container.className = 'select-ai-translation-container';
      container.style.cssText = `
        display: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        margin-top: 0.5em;
        margin-bottom: 0.5em;
        ${inheritedStyles}
      `;

      container.innerHTML = `
        <div class="translation-loading" style="display: inline-flex; align-items: center; gap: 8px; ${inheritedStyles}">
          <span style="width: 16px; height: 16px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
          <span>${t.translateLoading[lang]}</span>
        </div>
        <div class="translation-content" style="display: none; ${inheritedStyles}"></div>
      `;

      if (element.parentElement) {
        element.parentElement.insertBefore(container, element.nextSibling);
      }

      // Mark element as translated to avoid duplicate translation
      element.setAttribute('data-select-ai-translated', 'true');
    }

    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .select-ai-translation-container.show {
        display: block !important;
        opacity: 1 !important;
      }
    `;
    if (!document.head.querySelector('#select-ai-translation-style')) {
      style.id = 'select-ai-translation-style';
      document.head.appendChild(style);
    }

    if (!chrome.runtime?.id) {
      setIsTranslating(false);
      for (const id of elementIds) {
        const container = document.getElementById(id);
        if (container) {
          container.innerHTML = `<span style="color: #dc2626;">${t.extUpdated[lang]}</span>`;
          container.classList.add('show');
        }
      }
      return;
    }

    const MAX_CONCURRENT = 10;
    // Dynamic batch interval - reduce delay to improve parallel efficiency
    const batchDelay = 100;

    // Process each batch in parallel
    for (let i = 0; i < elementsToTranslate.length; i += MAX_CONCURRENT) {
      const batch = elementsToTranslate.slice(i, i + MAX_CONCURRENT);
      const batchIds = elementIds.slice(i, i + MAX_CONCURRENT);

      // Launch all translation requests in parallel
      const promises = batch.map((element, index) => translateElement(element, batchIds[index]));
      await Promise.all(promises);

      // Short delay between batches to avoid too many requests
      if (i + MAX_CONCURRENT < elementsToTranslate.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    setIsTranslating(false);
  }, [lang, t, translateElement, setIsTranslated, showAllTranslations, blacklist]);

  // Cleanup function
  useEffect(() => {
    return () => {
      disconnectStreamPort();
    };
  }, []);

  // Fullscreen detection
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

      {/* Inline translation button - floating at bottom-right, draggable */}
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
          cursor: isDragging ? 'grabbing' : (isTranslating ? 'not-allowed' : 'grab'),
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
          if (isTranslating || isDragging || wasDraggingRef.current) {
            wasDraggingRef.current = false;
            return;
          }

          if (isTranslated && translatedIdsRef.current.size > 0) {
            // Only hide translation containers, keep cache for restore on next click
            hideAllTranslations();
            setIsTranslated(false);
          } else {
            const sel = window.getSelection();
            const selectedText = sel?.toString().trim();

            if (selectedText && selectedText.length > 0) {
              // Has selected text: clear old cache, re-translate
              clearAllTranslations();
              handleInlineTranslate();
              setIsTranslated(true);
            } else {
              // No selected text: restore from cache or perform translation
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
