import { useState, useEffect, useRef, type FC, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { ContextExtractor } from '../utils/ContextExtractor';
import { containsKanji, getUILanguage, isLikelyJapanese } from '../utils/language';
import { translations } from '../utils/i18n';
import { ScreenshotSelector } from './components/ScreenshotSelector';
import { ocrService } from '../services/ocrService';

// Get extension icon URL for content script context
const appIconUrl = chrome.runtime.getURL('app-icon.png');

type Provider = 'openai' | 'anthropic' | 'minimax' | 'deepseek' | 'glm';
type PanelLayoutMode = 'auto' | 'user';

const ContentApp: FC = () => {
  const [selection, setSelection] = useState<string>('');
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showDot, setShowDot] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [kanaText, setKanaText] = useState('');
  const [kanaLoading, setKanaLoading] = useState(false);
  const [kanaRubyEnabled, setKanaRubyEnabled] = useState(true);
  const [modelName, setModelName] = useState('deepseek-chat');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [targetLang, setTargetLang] = useState('中文');
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [contextMaxTokens, setContextMaxTokens] = useState(5000);
  const [sourceLang, setSourceLang] = useState<string | null>(null);
  
  // Screenshot mode state
  const [screenshotMode, setScreenshotMode] = useState(false);

  const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const getViewportBounds = () => {
    const viewport = window.visualViewport;
    return {
      width: Math.floor(viewport?.width ?? window.innerWidth),
      height: Math.floor(viewport?.height ?? window.innerHeight),
    };
  };

  const getPanelConstraints = () => {
    const safeMargin = 12;
    const { width, height } = getViewportBounds();
    const usableWidth = Math.max(240, Math.floor(width - safeMargin * 2));
    const usableHeight = Math.max(220, Math.floor(height - safeMargin * 2));
    const minWidth = Math.min(320, usableWidth);
    const minHeight = Math.min(260, usableHeight);
    // Updated max size: 600x700 for better readability
    const maxWidth = Math.max(minWidth, Math.min(600, Math.floor(width * 0.55)));
    const maxHeight = Math.max(minHeight, Math.min(700, Math.floor(height * 0.75)));
    return {
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      safeMargin,
      viewportWidth: width,
      viewportHeight: height,
    };
  };

  const getDefaultPanelSize = () => {
    const { minWidth, minHeight, maxWidth, maxHeight, viewportHeight, viewportWidth } = getPanelConstraints();
    return {
      width: Math.round(clampValue(viewportWidth * 0.22, minWidth, maxWidth)),
      height: Math.round(clampValue(viewportHeight * 0.5, minHeight, maxHeight)),
    };
  };

  // Resize state for panel
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>(() => getDefaultPanelSize());
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null>(null);
  const [isUserSized, setIsUserSized] = useState(false);
  const [isUserMoved, setIsUserMoved] = useState(false);
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startWidth: number; startHeight: number; startX: number; startY: number } | null>(null);

  // Drag state for panel repositioning
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const selectionIdleTimerRef = useRef<number | null>(null);
  const selectionUpdateRafRef = useRef<number | null>(null);
  const selectionVersionRef = useRef(0);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const streamPortRef = useRef<chrome.runtime.Port | null>(null);
  const kanaStreamPortRef = useRef<chrome.runtime.Port | null>(null);
  const autoResizeRafRef = useRef<number | null>(null);
  const panelSizeRef = useRef(panelSize);
  const dragOffsetRef = useRef(dragOffset);
  const positionRef = useRef(position);
  const showPanelRef = useRef(showPanel);
  const selectionRectRef = useRef<{ height: number } | null>(null);
  const isUserSizedRef = useRef(isUserSized);
  const isUserMovedRef = useRef(isUserMoved);
  const voicesLoadedRef = useRef(false);
  // Ref for hover delay timer to prevent accidental trigger
  const hoverTimerRef = useRef<number | null>(null);

  const t = translations.content;

  useEffect(() => {
    setLang(getUILanguage());
  }, []);

  // Preload speech synthesis voices
  useEffect(() => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;

    const loadVoices = () => {
      const voices = synthesis.getVoices();
      if (voices.length > 0) {
        voicesLoadedRef.current = true;
      }
    };

    // Try to load immediately
    loadVoices();

    // Also listen for voiceschanged event (needed on some browsers)
    synthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      synthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  useEffect(() => {
    panelSizeRef.current = panelSize;
  }, [panelSize]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    showPanelRef.current = showPanel;
  }, [showPanel]);

  useEffect(() => {
    isUserSizedRef.current = isUserSized;
  }, [isUserSized]);

  useEffect(() => {
    isUserMovedRef.current = isUserMoved;
  }, [isUserMoved]);

  const defaultModels: Record<Provider, string> = {
    minimax: 'MiniMax-M2.1',
    deepseek: 'deepseek-chat',
    glm: 'glm-4.7',
    anthropic: 'claude-sonnet-4-5',
    openai: 'gpt-4o',
  };

  // Load provider, model name, output language, and context settings
  useEffect(() => {
    const getProviderConfig = async () => {
      const result = await chrome.storage.local.get(['selectedProvider', 'targetLanguage', 'kanaRubyEnabled', 'contextMaxTokens']);
      const providerValue = (result.selectedProvider as Provider) || 'deepseek';
      const modelKey = `${providerValue}Model`;
      const modelResult = await chrome.storage.local.get([modelKey]);
      setModelName((modelResult[modelKey] as string) || defaultModels[providerValue]);
      setTargetLang((result.targetLanguage as string) || '中文');
      setKanaRubyEnabled(result.kanaRubyEnabled !== false);
      setContextMaxTokens((result.contextMaxTokens as number) || 5000);
    };
    getProviderConfig();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.targetLanguage) {
        setTargetLang((changes.targetLanguage.newValue as string) || '中文');
      }
      if (changes.kanaRubyEnabled) {
        setKanaRubyEnabled(changes.kanaRubyEnabled.newValue !== false);
      }
      if (changes.contextMaxTokens) {
        setContextMaxTokens((changes.contextMaxTokens.newValue as number) || 5000);
      }
      if (changes.selectedProvider) {
        const providerValue = (changes.selectedProvider.newValue as Provider) || 'deepseek';
        const modelKey = `${providerValue}Model`;
        chrome.storage.local.get([modelKey], (modelResult) => {
          setModelName((modelResult[modelKey] as string) || defaultModels[providerValue]);
        });
      }
      if (changes.openaiModel || changes.anthropicModel || changes.minimaxModel || changes.deepseekModel || changes.glmModel) {
        chrome.storage.local.get(['selectedProvider'], (result) => {
          const providerValue = (result.selectedProvider as Provider) || 'deepseek';
          const modelKey = `${providerValue}Model`;
          chrome.storage.local.get([modelKey], (modelResult) => {
            setModelName((modelResult[modelKey] as string) || defaultModels[providerValue]);
          });
        });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const disconnectStreamPort = () => {
    if (streamPortRef.current) {
      streamPortRef.current.disconnect();
      streamPortRef.current = null;
    }
  };

  const disconnectKanaStreamPort = () => {
    if (kanaStreamPortRef.current) {
      kanaStreamPortRef.current.disconnect();
      kanaStreamPortRef.current = null;
    }
  };

  const shouldRequestKana = (text: string, contextText: string): boolean => {
    return kanaRubyEnabled && containsKanji(text) && isLikelyJapanese(contextText || text);
  };

  const getLocalContextFromSelection = (sel: Selection | null, maxChars = 300): string => {
    if (!sel || sel.rangeCount === 0) return selection;
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE
      ? (container as Element)
      : container.parentElement;
    const text = element?.textContent?.trim() || selection;
    if (!text) return selection;
    const normalizedSelection = selection.trim();
    if (!normalizedSelection) return text.slice(0, maxChars);
    const index = text.indexOf(normalizedSelection);
    if (index === -1) return text.slice(0, maxChars);
    const start = Math.max(0, index - Math.floor(maxChars / 2));
    const end = Math.min(text.length, index + normalizedSelection.length + Math.floor(maxChars / 2));
    return text.slice(start, end);
  };

  // Drag handlers for panel repositioning
  const handleDragStart = (e: ReactMouseEvent) => {
    // Ignore if target is a button (close button)
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    e.preventDefault();
    setIsDragging(true);
    setIsUserMoved(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: dragOffset.x,
      offsetY: dragOffset.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      setDragOffset({
        x: dragStartRef.current.offsetX + deltaX,
        y: dragStartRef.current.offsetY + deltaY,
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

  // Resize handlers for panel
  const handleResizeStart = (e: ReactMouseEvent, direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setIsUserSized(true);
    setIsUserMoved(true);

    const panelRect = panelRef.current?.getBoundingClientRect();
    if (!panelRect) return;

    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWidth: panelSize.width,
      startHeight: panelSize.height,
      startX: dragOffset.x,
      startY: dragOffset.y,
    };
  };

  useEffect(() => {
    if (!isResizing || !resizeDirection) return;

    const handleResizeMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const deltaX = e.clientX - resizeStartRef.current.mouseX;
      const deltaY = e.clientY - resizeStartRef.current.mouseY;

      let newWidth = resizeStartRef.current.startWidth;
      let newHeight = resizeStartRef.current.startHeight;
      let newOffsetX = resizeStartRef.current.startX;
      let newOffsetY = resizeStartRef.current.startY;

      const { minWidth, maxWidth, minHeight, maxHeight } = getPanelConstraints();

      if (resizeDirection.includes('e')) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartRef.current.startWidth + deltaX));
      } else if (resizeDirection.includes('w')) {
        const potentialWidth = resizeStartRef.current.startWidth - deltaX;
        if (potentialWidth >= minWidth && potentialWidth <= maxWidth) {
          newWidth = potentialWidth;
          newOffsetX = resizeStartRef.current.startX + deltaX;
        }
      }

      if (resizeDirection.includes('s')) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartRef.current.startHeight + deltaY));
      } else if (resizeDirection.includes('n')) {
        const potentialHeight = resizeStartRef.current.startHeight - deltaY;
        if (potentialHeight >= minHeight && potentialHeight <= maxHeight) {
          newHeight = potentialHeight;
          newOffsetY = resizeStartRef.current.startY + deltaY;
        }
      }

      setPanelSize({ width: newWidth, height: newHeight });
      setDragOffset({ x: newOffsetX, y: newOffsetY });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      setResizeDirection(null);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, resizeDirection]);

  useEffect(() => {
    const selectionIdleDelay = 400;

    const isSelectionInsideOverlay = (sel: Selection | null) => {
      if (!sel) return false;
      const overlayRoot = document.getElementById('ai-selection-search-root');
      if (!overlayRoot) return false;
      const anchorNode = sel.anchorNode;
      const focusNode = sel.focusNode;
      return (
        (anchorNode && overlayRoot.contains(anchorNode)) ||
        (focusNode && overlayRoot.contains(focusNode))
      );
    };

    const updateFromSelection = () => {
      if (isResizing || isDragging) return;
      const sel = window.getSelection();
      // Ignore selections inside extension overlay to avoid panel reposition
      if (isSelectionInsideOverlay(sel)) return;
      // Do not react to new page selections while panel is open
      if (showPanelRef.current) {
        setShowDot(false);
        return;
      }
      if (!sel || sel.rangeCount === 0) {
        setShowDot(false);
        if (!loading && !showPanelRef.current) setShowPanel(false);
        selectionRectRef.current = null;
        return;
      }

      const text = sel.toString().trim();
      if (!text) {
        setShowDot(false);
        if (!loading && !showPanelRef.current) setShowPanel(false);
        selectionRectRef.current = null;
        return;
      }

      const range = sel.getRangeAt(0);
      let rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const rects = range.getClientRects();
        rect = rects.length > 0 ? rects[0] : rect;
      }

      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const anchorNode = sel.anchorNode || sel.focusNode;
        const anchorElement = anchorNode
          ? (anchorNode.nodeType === Node.ELEMENT_NODE
            ? (anchorNode as Element)
            : (anchorNode.parentElement as Element | null))
          : null;
        if (anchorElement) {
          rect = anchorElement.getBoundingClientRect();
        }
      }

      if (!rect || (rect.width === 0 && rect.height === 0)) {
        if (lastPointerRef.current) {
          setSelection(text);
          selectionRectRef.current = {
            height: 0,
          };
          setPosition({
            x: lastPointerRef.current.x + window.scrollX,
            y: lastPointerRef.current.y + window.scrollY,
          });
          setShowDot(true);
          if (!showPanelRef.current) setShowPanel(false);
        }
        return;
      }

      setSelection(text);
      selectionRectRef.current = {
        height: rect.height || 0,
      };
      setPosition({
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
      });
      setShowDot(true);
      if (!showPanelRef.current) setShowPanel(false);
    };

    const scheduleSelectionUpdate = () => {
      selectionVersionRef.current += 1;
      const currentVersion = selectionVersionRef.current;
      if (selectionIdleTimerRef.current) window.clearTimeout(selectionIdleTimerRef.current);
      selectionIdleTimerRef.current = window.setTimeout(() => {
        if (selectionVersionRef.current !== currentVersion) return;
        if (selectionUpdateRafRef.current) cancelAnimationFrame(selectionUpdateRafRef.current);
        selectionUpdateRafRef.current = requestAnimationFrame(updateFromSelection);
      }, selectionIdleDelay);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dotRef.current?.contains(e.target as Node) || panelRef.current?.contains(e.target as Node)) {
        return;
      }
      if (showPanelRef.current) return;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      scheduleSelectionUpdate();
    };

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (isSelectionInsideOverlay(sel)) return;
      if (showPanelRef.current) return;
      scheduleSelectionUpdate();
    };

    // Capture to handle pages that stop mouseup propagation (e.g., GitHub code views)
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('selectionchange', handleSelectionChange, true);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('selectionchange', handleSelectionChange, true);
      if (selectionIdleTimerRef.current) window.clearTimeout(selectionIdleTimerRef.current);
      if (selectionUpdateRafRef.current) cancelAnimationFrame(selectionUpdateRafRef.current);
    };
  }, [loading, isResizing, isDragging]);

  // Hover delay handlers to prevent accidental triggers when mouse passes over dot
  const handleDotMouseEnter = () => {
    // Clear any existing timer
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    // Start delay timer - only trigger if mouse stays on dot for 100ms
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      handleTriggerQuery();
    }, 100);
  };

  const handleDotMouseLeave = () => {
    // Cancel trigger if mouse leaves before delay completes
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleCloseMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPanel(false);
  };

  // Trigger AI query; optional overrides for OCR/context-menu text
  const handleTriggerQuery = async (overrides?: { text: string; context: string; imageText?: string; imageSource?: 'image-ocr' | 'screenshot-ocr' }) => {
    // Clear hover timer when triggered
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    const queryText = overrides?.text ?? selection;
    if (overrides?.text) {
      setSelection(overrides.text);
      // Position panel at upper-center of viewport for OCR results
      const { width, height } = getViewportBounds();
      const ocrPos = { x: width / 2 + window.scrollX, y: height / 3 + window.scrollY };
      setPosition(ocrPos);
      positionRef.current = ocrPos;
      selectionRectRef.current = { height: 0 };
    }

    setShowDot(false);
    setShowPanel(true);
    setLoading(true);
    setResult('');
    setKanaText('');
    setKanaLoading(false);
    setIsTextExpanded(false);
    setDragOffset({ x: 0, y: 0 });
    const defaultSize = getDefaultPanelSize();
    const initialLayout = getPanelLayout({
      position: positionRef.current,
      dragOffset: { x: 0, y: 0 },
      panelSize: defaultSize,
      mode: 'auto',
    });
    setPanelSize({ width: defaultSize.width, height: initialLayout.height });
    setIsUserSized(false);
    setIsUserMoved(false);
    setSourceLang(null);
    disconnectKanaStreamPort();

    const sel = window.getSelection();
    const context = overrides?.context ?? (sel ? ContextExtractor.getContext(sel, contextMaxTokens) : '');
    const pageUrl = window.location.href;
    const pageTitle = document.title;

    if (!chrome.runtime?.id) {
      setLoading(false);
      console.error('[AI Search] Extension context invalidated');
      return;
    }

    try {
      const payload = {
        selection: queryText, context, pageUrl, pageTitle, targetLang, uiLang: lang,
        ...(overrides?.imageText ? { imageText: overrides.imageText } : {}),
        ...(overrides?.imageSource ? { imageSource: overrides.imageSource } : {}),
      };

      disconnectStreamPort();
      const port = chrome.runtime.connect({ name: 'ai-stream' });
      streamPortRef.current = port;

      let accumulatedResult = '';
      port.onMessage.addListener((message) => {
        if (message?.type === 'delta') {
          accumulatedResult += (message.data || '');
          setResult(accumulatedResult);
          setLoading(false);
          // Try to extract source language from accumulated result
          const detectedLang = extractSourceLang(accumulatedResult);
          if (detectedLang) {
            setSourceLang(detectedLang);
          }
        } else if (message?.type === 'done') {
          setLoading(false);
        } else if (message?.type === 'error') {
          setLoading(false);
          const errorMessage = message.error || 'Streaming error';
          setResult(`**Error:** ${errorMessage}`);
          console.error('[AI Search] Stream error:', errorMessage);
        }
      });

      port.onDisconnect.addListener(() => {
        streamPortRef.current = null;
        setLoading(false);
      });

      port.postMessage({ action: 'queryAIStream', payload });

      if (shouldRequestKana(queryText, overrides?.context || getLocalContextFromSelection(sel))) {
        setKanaLoading(true);
        const kanaPort = chrome.runtime.connect({ name: 'ai-kana-stream' });
        kanaStreamPortRef.current = kanaPort;

        kanaPort.onMessage.addListener((message) => {
          if (message?.type === 'delta') {
            setKanaText((prev) => prev + (message.data || ''));
            setKanaLoading(false);
          } else if (message?.type === 'done') {
            setKanaLoading(false);
          } else if (message?.type === 'error') {
            setKanaLoading(false);
            console.error('[AI Search] Kana stream error:', message.error || 'Streaming error');
          }
        });

        kanaPort.onDisconnect.addListener(() => {
          kanaStreamPortRef.current = null;
          setKanaLoading(false);
        });

        kanaPort.postMessage({ action: 'queryKana', payload: { text: queryText, uiLang: lang } });
      }
      return;
    } catch (e) {
      console.error('[AI Search] Send failed:', e);
      setLoading(false);
      const errorStr = String(e);
      setResult(`**Error:** ${errorStr}`);
    }
  };

  useEffect(() => {
    if (!showPanel) {
      disconnectStreamPort();
      disconnectKanaStreamPort();
      setLoading(false);
      setKanaLoading(false);
      setIsUserSized(false);
    }
  }, [showPanel]);

  const getPanelLayout = (input: {
    position: { x: number; y: number };
    dragOffset: { x: number; y: number };
    panelSize: { width: number; height: number };
    mode: PanelLayoutMode;
  }) => {
    const { safeMargin, viewportWidth, viewportHeight } = getPanelConstraints();
    const selectionGap = 8;
    const selectionTop = input.position.y - window.scrollY;
    const selectionHeight = selectionRectRef.current?.height ?? 0;
    const selectionBottom = selectionTop + selectionHeight;

    let nextHeight = input.panelSize.height;
    let baseTop = selectionBottom + selectionGap;

    if (input.mode === 'auto') {
      const spaceAbove = Math.max(0, selectionTop - safeMargin);
      const spaceBelow = Math.max(0, viewportHeight - selectionBottom - selectionGap - safeMargin);

      if (spaceBelow < nextHeight && spaceAbove >= nextHeight) {
        baseTop = selectionTop - selectionGap - nextHeight;
      } else if (spaceBelow < nextHeight) {
        const preferAbove = spaceAbove >= spaceBelow;
        const availableSpace = preferAbove ? spaceAbove : spaceBelow;
        nextHeight = Math.max(0, Math.min(nextHeight, availableSpace));
        baseTop = preferAbove
          ? selectionTop - selectionGap - nextHeight
          : selectionBottom + selectionGap;
      }
    }

    const rawLeft = input.position.x - 20 + input.dragOffset.x;
    const rawTop = baseTop + input.dragOffset.y;
    const minVisiblePart = 50;

    const minLeft = input.mode === 'auto'
      ? safeMargin
      : safeMargin - input.panelSize.width + minVisiblePart;
    const maxLeft = input.mode === 'auto'
      ? Math.max(minLeft, viewportWidth - safeMargin - input.panelSize.width)
      : viewportWidth - minVisiblePart;

    const minTop = safeMargin;
    const maxTop = input.mode === 'auto'
      ? Math.max(minTop, viewportHeight - safeMargin - nextHeight)
      : viewportHeight - minVisiblePart;

    return {
      left: clampValue(rawLeft, minLeft, maxLeft),
      top: clampValue(rawTop, minTop, maxTop),
      height: nextHeight,
      rawLeft,
      rawTop,
    };
  };

  // Balanced auto-resize: expand both width and height proportionally
  useEffect(() => {
    if (!showPanel || isResizing || isUserSized) return;
    if (autoResizeRafRef.current) cancelAnimationFrame(autoResizeRafRef.current);

    autoResizeRafRef.current = requestAnimationFrame(() => {
      autoResizeRafRef.current = null;
      const scrollContainer = scrollContainerRef.current;
      const panel = panelRef.current;
      if (!scrollContainer || !panel) return;

      const { minWidth, maxWidth, minHeight, maxHeight } = getPanelConstraints();
      const extraHeight = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);

      // No overflow, no need to resize
      if (extraHeight < 2) return;

      const currentWidth = panelSize.width;
      const currentHeight = panelSize.height;
      const aspectRatio = currentHeight / currentWidth;

      let nextWidth = currentWidth;
      let nextHeight = currentHeight;

      // Balanced expansion strategy
      if (aspectRatio > 1.5 && currentWidth < maxWidth) {
        // Aspect ratio too tall, prioritize width increase
        const widthIncrement = Math.min(40, maxWidth - currentWidth);
        nextWidth = currentWidth + widthIncrement;
        // Also increase height slightly
        nextHeight = clampValue(currentHeight + extraHeight * 0.3, minHeight, maxHeight);
      } else {
        // Balanced increase of both dimensions
        const widthIncrement = Math.min(20, extraHeight * 0.3, maxWidth - currentWidth);
        nextWidth = currentWidth + widthIncrement;
        nextHeight = clampValue(currentHeight + extraHeight * 0.7, minHeight, maxHeight);
      }

      nextWidth = clampValue(nextWidth, minWidth, maxWidth);
      nextHeight = clampValue(nextHeight, minHeight, maxHeight);

      const mode: PanelLayoutMode = isUserMoved ? 'user' : 'auto';
      const layout = getPanelLayout({
        position: positionRef.current,
        dragOffset: dragOffsetRef.current,
        panelSize: { width: nextWidth, height: nextHeight },
        mode,
      });
      const finalHeight = mode === 'auto' ? layout.height : nextHeight;

      if (nextWidth !== currentWidth || finalHeight !== currentHeight) {
        setPanelSize({ width: nextWidth, height: finalHeight });
      }
    });

    return () => {
      if (autoResizeRafRef.current) cancelAnimationFrame(autoResizeRafRef.current);
    };
  }, [result, loading, isTextExpanded, showPanel, isResizing, isUserSized, isUserMoved, panelSize]);

  useEffect(() => {
    const handleViewportResize = () => {
      if (!showPanelRef.current) return;
      const { minWidth, maxWidth, maxHeight } = getPanelConstraints();
      const currentSize = panelSizeRef.current;
      const nextWidth = clampValue(currentSize.width, minWidth, maxWidth);
      const nextHeight = Math.min(currentSize.height, maxHeight);

      const currentOffset = dragOffsetRef.current;
      const currentPosition = positionRef.current;
      const mode: PanelLayoutMode = (!isUserSizedRef.current && !isUserMovedRef.current) ? 'auto' : 'user';
      const layout = getPanelLayout({
        position: currentPosition,
        dragOffset: currentOffset,
        panelSize: { width: nextWidth, height: nextHeight },
        mode,
      });

      if (nextWidth !== currentSize.width || layout.height !== currentSize.height) {
        setPanelSize({ width: nextWidth, height: layout.height });
      }

      const nextOffsetX = currentOffset.x + (layout.left - layout.rawLeft);
      const nextOffsetY = currentOffset.y + (layout.top - layout.rawTop);

      if (nextOffsetX !== currentOffset.x || nextOffsetY !== currentOffset.y) {
        setDragOffset({ x: nextOffsetX, y: nextOffsetY });
      }
    };

    window.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  // Stable ref to latest handleTriggerQuery for use in event listeners
  const handleTriggerQueryRef = useRef(handleTriggerQuery);
  useEffect(() => {
    handleTriggerQueryRef.current = handleTriggerQuery;
  });

  // Listen for OCR and context-menu events dispatched from ImageTextDetector / index.tsx
  useEffect(() => {
    const handleOCRTranslate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.text) return;
      handleTriggerQueryRef.current({ text: detail.text, context: detail.context || '' });
    };
    const handleOCRExplain = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.text) return;
      handleTriggerQueryRef.current({ text: detail.text, context: detail.context || '' });
    };
    // Unified image explain event from context menu OCR
    const handleImageExplain = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.imageText) return;
      handleTriggerQueryRef.current({
        text: detail.imageText,
        context: '',
        imageText: detail.imageText,
        imageSource: 'image-ocr',
      });
    };

    window.addEventListener('select-ai-translate-text', handleOCRTranslate);
    window.addEventListener('select-ai-explain-text', handleOCRExplain);
    window.addEventListener('select-ai-image-explain', handleImageExplain);

    return () => {
      window.removeEventListener('select-ai-translate-text', handleOCRTranslate);
      window.removeEventListener('select-ai-explain-text', handleOCRExplain);
      window.removeEventListener('select-ai-image-explain', handleImageExplain);
    };
  }, []);

  // Listen for screenshot message via custom event (from index.tsx)
  useEffect(() => {
    const handleStartScreenshot = () => {
      setScreenshotMode(true);
    };

    window.addEventListener('select-ai-start-screenshot', handleStartScreenshot);
    
    return () => {
      window.removeEventListener('select-ai-start-screenshot', handleStartScreenshot);
    };
  }, []); // Empty deps - only add listener once on mount

  // Handle screenshot complete
  const handleScreenshotComplete = async (blob: Blob) => {
    setScreenshotMode(false);

    try {
      // Show panel in loading state first
      const { width, height } = getViewportBounds();
      const centerPos = { 
        x: width / 2 + window.scrollX, 
        y: height / 3 + window.scrollY 
      };
      setPosition(centerPos);
      positionRef.current = centerPos;
      selectionRectRef.current = { height: 0 };
      setShowDot(false);
      setShowPanel(true);
      setLoading(true);
      setResult('');
      setSelection('识别中...');

      console.log('[ContentApp] Starting OCR recognition...');

      // OCR recognition
      const settings = await ocrService.loadSettings();
      console.log('[ContentApp] OCR settings:', settings);

      if (!settings.ocrLanguages || settings.ocrLanguages.length === 0) {
        setLoading(false);
        setResult('**错误:** 请先在设置页面选择并下载语言包');
        setSelection('未配置语言包');
        return;
      }

      const ocrResult = await ocrService.recognize(blob, settings.ocrLanguages);
      console.log('[ContentApp] OCR result:', ocrResult);

      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        setLoading(false);
        setResult('**提示:** 未识别到文字，请重新截图');
        setSelection('未识别到文字');
        return;
      }

      // Trigger AI translation/explanation
      handleTriggerQueryRef.current({
        text: ocrResult.text,
        context: '',
        imageText: ocrResult.text,
        imageSource: 'screenshot-ocr',
      });
    } catch (error) {
      console.error('[ContentApp] Screenshot OCR failed:', error);
      setLoading(false);
      
      // More detailed error message
      let errorMessage = '截图识别失败';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = '语言包加载失败，请检查网络连接或在设置页面重新下载语言包';
        } else if (error.message.includes('language')) {
          errorMessage = '语言包未找到，请在设置页面下载所需语言包';
        } else {
          errorMessage = error.message;
        }
      }
      
      setResult(`**错误:** ${errorMessage}`);
      setSelection('识别失败');
    }
  };

  // Handle screenshot cancel
  const handleScreenshotCancel = () => {
    setScreenshotMode(false);
  };

  useEffect(() => {
    return () => {
      disconnectStreamPort();
      disconnectKanaStreamPort();
      // Clean up hover timer on unmount
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Styles
  // Dot always positioned at top-left of selection
  const dotStyle: CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y - window.scrollY,
    transform: 'translate(-100%, -100%)',
    cursor: 'pointer',
    zIndex: 2147483647,
    padding: 3,
  };

  const dotInnerStyle: CSSProperties = {
    width: 10,
    height: 10,
    background: 'linear-gradient(135deg, #ef4444 0%, #8b5cf6 100%)',
    borderRadius: '50%',
    boxShadow: '0 1px 6px rgba(139, 92, 246, 0.5)',
    transition: 'transform 0.15s',
  };

  const allowAutoPlacement = !isDragging && !isResizing && !isUserSized && !isUserMoved;
  const panelLayout = getPanelLayout({
    position,
    dragOffset,
    panelSize,
    mode: allowAutoPlacement ? 'auto' : 'user',
  });

  useEffect(() => {
    if (!showPanel || isResizing || isDragging || isUserSized || isUserMoved) return;
    if (panelLayout.height !== panelSize.height) {
      setPanelSize({ width: panelSize.width, height: panelLayout.height });
    }
  }, [
    showPanel,
    isResizing,
    isDragging,
    isUserSized,
    isUserMoved,
    panelLayout.height,
    panelSize.width,
    panelSize.height,
  ]);

  const panelStyle: CSSProperties = {
    position: 'fixed',
    left: panelLayout.left,
    top: panelLayout.top,
    zIndex: 2147483647,
    width: panelSize.width,
    height: panelLayout.height,
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: '#1f2937',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #f3f4f6',
    cursor: 'move',
    userSelect: 'none',
  };

  const modelBadgeStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#374151',
  };

  const closeButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    fontSize: 18,
    padding: 4,
  };

  const contentStyle: CSSProperties = {
    padding: 16,
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  const selectionTitleStyle: CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
    color: '#111827',
    lineHeight: 1.5,
  };

  const kanaTextStyle: CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
  };

  const selectionContainerStyle: CSSProperties = {
    padding: 12,
    marginBottom: 12,
  };

  const toggleButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#3b82f6',
    fontSize: 12,
    padding: '4px 0',
    marginTop: 4,
    textDecoration: 'underline',
  };

  const dividerStyle: CSSProperties = {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  };

  const resultStyle: CSSProperties = {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#374151',
  };

  const loadingStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#6b7280',
    padding: '20px 0',
  };

  const spinnerStyle: CSSProperties = {
    width: 18,
    height: 18,
    border: '2px solid #e5e7eb',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid #f3f4f6',
  };

  const actionButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const resizeHandleStyle: CSSProperties = {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 10,
  };

  const cornerSize = 12;
  const edgeSize = 6;

  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const sanitizeRubyMarkup = (value: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${value}</div>`, 'text/html');
      const container = doc.body.firstChild;
      if (!container) return escapeHtml(value);

      const allowedTags = new Set(['RUBY', 'RT', 'RP']);
      const build = (node: ChildNode): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          return escapeHtml(node.textContent || '');
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const element = node as HTMLElement;
        const tagName = element.tagName;
        const inner = Array.from(element.childNodes).map(build).join('');
        if (!allowedTags.has(tagName)) {
          return inner;
        }
        const lowerTag = tagName.toLowerCase();
        return `<${lowerTag}>${inner}</${lowerTag}>`;
      };

      return Array.from(container.childNodes).map(build).join('');
    } catch {
      return escapeHtml(value);
    }
  };

  // Parse XML response from AI and format for display
  const parseXmlResponse = (text: string, uiLang: 'zh' | 'en'): string => {
    // Remove source_lang tag first (used for TTS, not displayed)
    const cleanedText = text.replace(/<source_lang>[\s\S]*?(?:<\/source_lang>|$)/gi, '').trim();

    // Support streaming for <base> and <context> tags
    const baseMatch = cleanedText.match(/<base>([\s\S]*?)(?:<\/base>|$)/i);
    const contextMatch = cleanedText.match(/<context>([\s\S]*?)(?:<\/context>|$)/i);

    if (baseMatch || contextMatch) {
      const baseLabel = uiLang === 'zh' ? '基础含义' : 'Base meaning';
      const contextLabel = uiLang === 'zh' ? '上下文含义' : 'Contextual meaning';

      let formatted = '';
      if (baseMatch) {
        formatted += `**${baseLabel}:** ${baseMatch[1].trim()}\n\n`;
      }
      if (contextMatch) {
        formatted += `**${contextLabel}:** ${contextMatch[1].trim()}`;
      }
      return formatted.trim();
    }
    return cleanedText;
  };

  // Extract source language from AI response
  const extractSourceLang = (text: string): string | null => {
    const match = text.match(/<source_lang>([a-z]{2,5})<\/source_lang>/i);
    return match ? match[1].toLowerCase() : null;
  };

  // Map short language code to TTS language code
  const mapLangCodeToTTS = (code: string): string => {
    const map: Record<string, string> = {
      'en': 'en-US',
      'ja': 'ja-JP',
      'zh': 'zh-CN',
      'ko': 'ko-KR',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'es': 'es-ES',
      'it': 'it-IT',
      'pt': 'pt-BR',
      'ru': 'ru-RU',
    };
    return map[code] || 'en-US';
  };

  // Detect language for TTS (fallback)
  const detectLanguageForTTS = (text: string): string => {
    // Japanese detection (contains hiragana/katakana or identified as Japanese)
    if (isLikelyJapanese(text)) return 'ja-JP';
    // Chinese detection
    const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
    const chineseRatio = chineseChars.length / text.length;
    if (chineseRatio > 0.1) return 'zh-CN';
    // Default to English
    return 'en-US';
  };

  // Strip markdown symbols for speech
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/^\s*>/gm, '')
      .replace(/---/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Map target language name to TTS language code
  const getTargetLangTTSCode = (target: string): string => {
    const langMap: Record<string, string> = {
      '中文': 'zh-CN',
      '简体中文': 'zh-CN',
      '繁體中文': 'zh-TW',
      'Chinese': 'zh-CN',
      '英语': 'en-US',
      '英文': 'en-US',
      'English': 'en-US',
      '日语': 'ja-JP',
      '日本語': 'ja-JP',
      'Japanese': 'ja-JP',
      '韩语': 'ko-KR',
      '한국어': 'ko-KR',
      'Korean': 'ko-KR',
      '法语': 'fr-FR',
      'French': 'fr-FR',
      '德语': 'de-DE',
      'German': 'de-DE',
      '西班牙语': 'es-ES',
      'Spanish': 'es-ES',
    };
    return langMap[target] || 'en-US';
  };

  // Get the best available voice for a language
  const getBestVoice = (langCode: string): SpeechSynthesisVoice | null => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return null;

    const voices = synthesis.getVoices();
    if (!voices.length) return null;

    // Filter voices matching the language
    const langPrefix = langCode.split('-')[0].toLowerCase();
    const matchingVoices = voices.filter(v =>
      v.lang.toLowerCase().startsWith(langPrefix)
    );

    if (!matchingVoices.length) return null;

    // Quality indicators in voice names (higher priority first)
    const qualityKeywords = [
      'premium', 'enhanced', 'neural', 'natural', 'wavenet', 'studio',
      // macOS high-quality voices
      'samantha', 'alex', 'karen', 'daniel', 'moira', 'tessa', 'fiona',
      // Common high-quality voice names
      'zira', 'david', 'mark', 'hazel', 'george', 'susan', 'linda',
    ];

    // Score each voice based on quality indicators
    const scoredVoices = matchingVoices.map(voice => {
      let score = 0;
      const nameLower = voice.name.toLowerCase();

      // Check for quality keywords
      for (const keyword of qualityKeywords) {
        if (nameLower.includes(keyword)) {
          score += 10;
        }
      }

      // Prefer local voices over remote (often higher quality on modern OS)
      if (voice.localService) {
        score += 5;
      }

      // Prefer voices with exact language match
      if (voice.lang.toLowerCase() === langCode.toLowerCase()) {
        score += 3;
      }

      return { voice, score };
    });

    // Sort by score descending
    scoredVoices.sort((a, b) => b.score - a.score);

    return scoredVoices[0]?.voice || matchingVoices[0];
  };

  // Speak text with best available voice
  const speakWithBestVoice = (text: string, langCode: string) => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;

    synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;

    // Try to get the best voice
    const bestVoice = getBestVoice(langCode);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    // Adjust speech parameters for more natural sound
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;

    synthesis.speak(utterance);
  };

  // Speech synthesis handler for translation result
  const handleSpeak = () => {
    if (!result) return;

    const parsedResult = parseXmlResponse(result, lang);
    const textToSpeak = stripMarkdown(parsedResult);
    speakWithBestVoice(textToSpeak, getTargetLangTTSCode(targetLang));
  };

  // Speech synthesis handler for original text
  const handleSpeakOriginal = () => {
    if (!selection) return;

    // Priority: AI-detected language > local detection
    const langCode = sourceLang
      ? mapLangCodeToTTS(sourceLang)
      : detectLanguageForTTS(selection);

    speakWithBestVoice(selection, langCode);
  };

  // Stop speech when panel closes
  useEffect(() => {
    if (!showPanel) {
      window.speechSynthesis?.cancel();
    }
  }, [showPanel]);

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .select-ai-kana ruby {
          ruby-position: over;
          ruby-align: center;
        }

        .select-ai-kana rt {
          font-size: 0.7em;
          color: #9ca3af;
        }
      `}</style>

      {showDot && (
        <div
          ref={dotRef}
          style={dotStyle}
          onMouseEnter={handleDotMouseEnter}
          onMouseLeave={handleDotMouseLeave}
        >
          <div style={dotInnerStyle} />
        </div>
      )}

      {showPanel && (
        <div ref={panelRef} style={panelStyle}>
          {/* Resize handles - corners */}
          <div
            style={{ ...resizeHandleStyle, top: 0, left: 0, width: cornerSize, height: cornerSize, cursor: 'nw-resize' }}
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          <div
            style={{ ...resizeHandleStyle, top: 0, right: 0, width: cornerSize, height: cornerSize, cursor: 'ne-resize' }}
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            style={{ ...resizeHandleStyle, bottom: 0, left: 0, width: cornerSize, height: cornerSize, cursor: 'sw-resize' }}
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div
            style={{ ...resizeHandleStyle, bottom: 0, right: 0, width: cornerSize, height: cornerSize, cursor: 'se-resize' }}
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />

          {/* Resize handles - edges */}
          <div
            style={{ ...resizeHandleStyle, top: 0, left: cornerSize, right: cornerSize, height: edgeSize, cursor: 'n-resize' }}
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />
          <div
            style={{ ...resizeHandleStyle, bottom: 0, left: cornerSize, right: cornerSize, height: edgeSize, cursor: 's-resize' }}
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div
            style={{ ...resizeHandleStyle, left: 0, top: cornerSize, bottom: cornerSize, width: edgeSize, cursor: 'w-resize' }}
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div
            style={{ ...resizeHandleStyle, right: 0, top: cornerSize, bottom: cornerSize, width: edgeSize, cursor: 'e-resize' }}
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />

          <div style={headerStyle} onMouseDown={handleDragStart}>
            <img
              src={appIconUrl}
              alt="Select AI"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                objectFit: 'contain',
              }}
            />

            <div style={modelBadgeStyle}>
              <span style={{
                width: 8,
                height: 8,
                backgroundColor: '#22c55e',
                borderRadius: '50%'
              }} />
              {modelName}
            </div>

            <button
              style={closeButtonStyle}
              onClick={() => setShowPanel(false)}
              onMouseDown={handleCloseMouseDown}
              onMouseOver={(e) => (e.currentTarget.style.color = '#374151')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#9ca3af')}
            >
              ✕
            </button>
          </div>

          <div style={contentStyle}>
            <div style={selectionContainerStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  {sourceLang === 'ja' && kanaLoading && !kanaText && (
                    <div style={kanaTextStyle}>
                      {lang === 'zh' ? '平假名生成中...' : 'Generating hiragana...'}
                    </div>
                  )}
                  {sourceLang === 'ja' && kanaText && (isTextExpanded || selection.length <= 150) ? (
                    <div
                      className="select-ai-kana"
                      style={selectionTitleStyle}
                      dangerouslySetInnerHTML={{ __html: sanitizeRubyMarkup(kanaText) }}
                    />
                  ) : (
                    <div style={selectionTitleStyle}>
                      {selection.length > 150 && !isTextExpanded
                        ? selection.substring(0, 120) + '...'
                        : selection}
                    </div>
                  )}
                  {selection.length > 150 && (
                    <button
                      style={toggleButtonStyle}
                      onClick={() => setIsTextExpanded(!isTextExpanded)}
                      onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
                      onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      {isTextExpanded ? (lang === 'zh' ? '收起' : 'Collapse') : (lang === 'zh' ? '展开全文' : 'Expand')}
                    </button>
                  )}
                </div>
                <button
                  style={{
                    ...actionButtonStyle,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                  onClick={handleSpeakOriginal}
                  title={t.speakOriginalTitle[lang]}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  🔊
                </button>
              </div>
            </div>

            <div style={dividerStyle} />

            <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <>
                {loading && !result && (
                  <div style={loadingStyle}>
                    <div style={spinnerStyle} />
                    <span>{t.loading[lang]}</span>
                  </div>
                )}
                {(!loading || result) && (
                  <div style={resultStyle}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p style={{ margin: '0 0 6px 0', lineHeight: 1.6 }}>{children}</p>,
                        strong: ({ children }) => <strong style={{ fontWeight: 600, color: '#111827' }}>{children}</strong>,
                        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                        ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                        code: ({ children }) => (
                          <code style={{
                            backgroundColor: '#f3f4f6',
                            padding: '1px 5px',
                            borderRadius: 3,
                            fontSize: 13,
                            fontFamily: 'Monaco, Consolas, monospace'
                          }}>{children}</code>
                        ),
                        pre: ({ children }) => (
                          <pre style={{
                            backgroundColor: '#f3f4f6',
                            padding: 10,
                            borderRadius: 6,
                            overflow: 'auto',
                            fontSize: 13,
                            margin: '6px 0',
                            fontFamily: 'Monaco, Consolas, monospace'
                          }}>{children}</pre>
                        ),
                        h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 4px' }}>{children}</h1>,
                        h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 3px' }}>{children}</h2>,
                        h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 2px' }}>{children}</h3>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#3b82f6', textDecoration: 'underline' }}>{children}</a>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote style={{
                            borderLeft: '3px solid #e5e7eb',
                            paddingLeft: 10,
                            margin: '4px 0',
                            color: '#6b7280'
                          }}>{children}</blockquote>
                        ),
                        br: () => <br style={{ lineHeight: 0.5 }} />,
                      }}
                    >
                      {parseXmlResponse(result, lang)}
                    </ReactMarkdown>
                  </div>
                )}
              </>
            </div>

            {!loading && result && (
              <div style={footerStyle}>
                <button
                  style={actionButtonStyle}
                  onClick={() => navigator.clipboard.writeText(parseXmlResponse(result, lang))}
                  title={t.copyTitle[lang]}
                >
                  📋
                </button>
                <button style={actionButtonStyle} onClick={handleSpeak} title={t.speakTitle[lang]}>🔊</button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Screenshot selector */}
      {screenshotMode && (
        <ScreenshotSelector
          onComplete={handleScreenshotComplete}
          onCancel={handleScreenshotCancel}
        />
      )}
    </>
  );
};

export default ContentApp;
