import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ContextExtractor } from '../utils/ContextExtractor';
import { getUILanguage, isBrowserChinese } from '../utils/language';
import { translations } from '../utils/i18n';

type Provider = 'openai' | 'anthropic' | 'minimax' | 'deepseek' | 'glm';

const ContentApp: React.FC = () => {
  const [selection, setSelection] = useState<string>('');
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showDot, setShowDot] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultTargetLang = isBrowserChinese() ? '中文' : 'English';
  const [modelName, setModelName] = useState('gpt-4o');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [isTextExpanded, setIsTextExpanded] = useState(false);

  // Resize state for panel
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({ width: 400, height: 450 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null>(null);
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startWidth: number; startHeight: number; startX: number; startY: number } | null>(null);

  // Drag state for panel repositioning
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const streamPortRef = useRef<chrome.runtime.Port | null>(null);

  const t = translations.content;

  useEffect(() => {
    setLang(getUILanguage());
  }, []);

  const defaultModels: Record<Provider, string> = {
    minimax: 'MiniMax-M2.1',
    deepseek: 'deepseek-chat',
    glm: 'glm-4.7',
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4o',
  };

  // Load provider, model name, and output language
  useEffect(() => {
    const getProviderConfig = async () => {
      const result = await chrome.storage.local.get(['selectedProvider', 'targetLanguage']);
      const providerValue = (result.selectedProvider as Provider) || 'openai';
      const modelKey = `${providerValue}Model`;
      const modelResult = await chrome.storage.local.get([modelKey]);
      setModelName((modelResult[modelKey] as string) || defaultModels[providerValue]);
      setTargetLang((result.targetLanguage as string) || defaultTargetLang);
    };
    getProviderConfig();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.targetLanguage) {
        setTargetLang((changes.targetLanguage.newValue as string) || defaultTargetLang);
      }
      if (changes.selectedProvider) {
        const providerValue = (changes.selectedProvider.newValue as Provider) || 'openai';
        const modelKey = `${providerValue}Model`;
        chrome.storage.local.get([modelKey], (modelResult) => {
          setModelName((modelResult[modelKey] as string) || defaultModels[providerValue]);
        });
      }
      if (changes.openaiModel || changes.anthropicModel || changes.minimaxModel || changes.deepseekModel || changes.glmModel) {
        chrome.storage.local.get(['selectedProvider'], (result) => {
          const providerValue = (result.selectedProvider as Provider) || 'openai';
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

  // Drag handlers for panel repositioning
  const handleDragStart = (e: React.MouseEvent) => {
    // Prevent text selection during drag
    e.preventDefault();
    setIsDragging(true);
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
  const handleResizeStart = (e: React.MouseEvent, direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    
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

      // Handle horizontal resize
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(300, Math.min(800, resizeStartRef.current.startWidth + deltaX));
      } else if (resizeDirection.includes('w')) {
        const potentialWidth = resizeStartRef.current.startWidth - deltaX;
        if (potentialWidth >= 300 && potentialWidth <= 800) {
          newWidth = potentialWidth;
          newOffsetX = resizeStartRef.current.startX + deltaX;
        }
      }

      // Handle vertical resize
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(300, Math.min(700, resizeStartRef.current.startHeight + deltaY));
      } else if (resizeDirection.includes('n')) {
        const potentialHeight = resizeStartRef.current.startHeight - deltaY;
        if (potentialHeight >= 300 && potentialHeight <= 700) {
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
    const handleMouseUp = (e: MouseEvent) => {
      if (isResizing || isDragging) return;
      // Ignore if clicking on our own elements
      if (dotRef.current?.contains(e.target as Node) || panelRef.current?.contains(e.target as Node)) {
        return;
      }

      const sel = window.getSelection();
      const text = sel?.toString().trim();

      if (text && text.length > 0) {
        const range = sel?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();

        if (rect) {
          setSelection(text);
          setPosition({
            x: rect.left + window.scrollX,  // Left edge of selection
            y: rect.top + window.scrollY    // Top edge of selection
          });
          setShowDot(true);
          setShowPanel(false);
        }
      } else {
        if (!panelRef.current?.contains(e.target as Node)) {
          setShowDot(false);
          if (!loading) setShowPanel(false);
        }
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [loading, isResizing, isDragging]);

  const handleTriggerQuery = () => {
    setShowDot(false);
    setShowPanel(true);
    setLoading(true);
    setError(null);
    setResult('');
    setIsTextExpanded(false);
    // Reset drag offset and size when panel opens
    setDragOffset({ x: 0, y: 0 });
    setPanelSize({ width: 400, height: 450 });

    const sel = window.getSelection();
    const context = sel ? ContextExtractor.getContext(sel) : '';
    const pageUrl = window.location.href;
    const pageTitle = document.title;

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      setLoading(false);
      setError(t.extUpdated[lang]);
      return;
    }

    try {
      const payload = { selection, context, pageUrl, pageTitle, targetLang, uiLang: lang };

      disconnectStreamPort();
      const port = chrome.runtime.connect({ name: 'ai-stream' });
      streamPortRef.current = port;

      port.onMessage.addListener((message) => {
        if (message?.type === 'delta') {
          setResult((prev) => prev + (message.data || ''));
          setLoading(false);
        } else if (message?.type === 'done') {
          setLoading(false);
        } else if (message?.type === 'error') {
          setLoading(false);
          setError(message.error || 'Streaming error');
        }
      });

      port.onDisconnect.addListener(() => {
        streamPortRef.current = null;
        setLoading(false);
      });

      port.postMessage({ action: 'queryAIStream', payload });
      return;
    } catch (e) {
      console.error('[AI Search] Send failed:', e);
      setLoading(false);
      const errorStr = String(e);
      if (errorStr.includes('Extension context invalidated')) {
        setError(t.extUpdated[lang]);
      } else {
        setError('Request failed: ' + errorStr);
      }
    }
  };

  useEffect(() => {
    if (!showPanel) {
      disconnectStreamPort();
      setLoading(false);
    }
  }, [showPanel]);

  useEffect(() => {
    return () => {
      disconnectStreamPort();
    };
  }, []);

  // Styles
  const dotStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y - window.scrollY,
    transform: 'translate(-100%, -100%)',  // Position to top-left corner
    cursor: 'pointer',
    zIndex: 2147483647,
    padding: 3,
  };

  const dotInnerStyle: React.CSSProperties = {
    width: 10,  // Reduced from 14px (about 1/4 smaller)
    height: 10,
    background: 'linear-gradient(135deg, #ef4444 0%, #8b5cf6 100%)',
    borderRadius: '50%',
    boxShadow: '0 1px 6px rgba(139, 92, 246, 0.5)',
    transition: 'transform 0.15s',
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(Math.max(10, position.x - 20), window.innerWidth - panelSize.width - 20) + dragOffset.x,
    top: Math.min(position.y - window.scrollY + 5, window.innerHeight - panelSize.height - 20) + dragOffset.y,
    zIndex: 2147483647,
    width: panelSize.width,
    height: panelSize.height,
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

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #f3f4f6',
    cursor: 'move',
    userSelect: 'none',
  };

  const modelBadgeStyle: React.CSSProperties = {
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

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    fontSize: 18,
    padding: 4,
  };

  const contentStyle: React.CSSProperties = {
    padding: 16,
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  const selectionTitleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
    color: '#111827',
    lineHeight: 1.5,
  };

  const selectionContainerStyle: React.CSSProperties = {
    padding: 12,
    marginBottom: 12,
  };

  const toggleButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#3b82f6',
    fontSize: 12,
    padding: '4px 0',
    marginTop: 4,
    textDecoration: 'underline',
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  };

  const resultStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#374151',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#6b7280',
    padding: '20px 0',
  };

  const spinnerStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    border: '2px solid #e5e7eb',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid #f3f4f6',
  };

  const actionButtonStyle: React.CSSProperties = {
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

  // Resize handle styles
  const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 10,
  };

  const cornerSize = 12;
  const edgeSize = 6;

  // Parse XML response from AI and format for display
  const parseXmlResponse = (text: string, uiLang: 'zh' | 'en'): string => {
    const baseMatch = text.match(/<base>([\s\S]*?)<\/base>/);
    const contextMatch = text.match(/<context>([\s\S]*?)<\/context>/);
    
    if (baseMatch || contextMatch) {
      const baseLabel = uiLang === 'zh' ? '基础含义' : 'Base meaning';
      const contextLabel = uiLang === 'zh' ? '上下文含义' : 'Contextual meaning';
      
      let formatted = '';
      if (baseMatch) formatted += `**${baseLabel}:** ${baseMatch[1].trim()}\n\n`;
      if (contextMatch) formatted += `**${contextLabel}:** ${contextMatch[1].trim()}`;
      return formatted;
    }
    return text; // fallback to original if parsing fails
  };

  // Strip markdown symbols for speech
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/#{1,6}\s+/g, '') // Remove headings
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italic
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // Remove code blocks and inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Remove images, keep alt text
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .replace(/^\s*>/gm, '') // Remove blockquotes
      .replace(/---/g, '') // Remove horizontal rules
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  };

  // Speech synthesis handler
  const handleSpeak = () => {
    if (!result) return;
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;

    // Cancel any ongoing speech
    synthesis.cancel();

    const parsedResult = parseXmlResponse(result, lang);
    const textToSpeak = stripMarkdown(parsedResult);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    synthesis.speak(utterance);
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
      `}</style>

      {showDot && (
        <div
          ref={dotRef}
          style={dotStyle}
          onMouseEnter={handleTriggerQuery}
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
            <div style={{
              width: 28,
              height: 28,
              backgroundColor: '#ec4899',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600
            }}>
              AI
            </div>

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
              onMouseOver={(e) => (e.currentTarget.style.color = '#374151')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#9ca3af')}
            >
              ✕
            </button>
          </div>

          <div style={contentStyle}>
            <div style={selectionContainerStyle}>
              <div style={selectionTitleStyle}>
                {selection.length > 150 && !isTextExpanded
                  ? selection.substring(0, 120) + '...'
                  : selection}
              </div>
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

            <div style={dividerStyle} />

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {error ? (
                <div style={errorStyle}>
                  <strong>{t.errorTitle[lang]}</strong> {error}
                </div>
              ) : (
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
              )}
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
    </>
  );
};

export default ContentApp;
