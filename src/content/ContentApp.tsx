import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ContextExtractor } from '../utils/ContextExtractor';
import { getUILanguage } from '../utils/language';
import { translations } from '../utils/i18n';

const ContentApp: React.FC = () => {
  const [selection, setSelection] = useState<string>('');
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showDot, setShowDot] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState('MiniMax-M2.1');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  // Drag state for panel repositioning
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  const t = translations.content;

  useEffect(() => {
    setLang(getUILanguage());
  }, []);

  useEffect(() => {
    chrome.storage.local.get(['anthropicModel'], (result) => {
      if (result.anthropicModel) setModelName(result.anthropicModel as string);
    });
  }, []);

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

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
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
  }, [loading]);

  const handleTriggerQuery = () => {
    setShowDot(false);
    setShowPanel(true);
    setLoading(true);
    setError(null);
    setResult('');
    // Reset drag offset when panel opens
    setDragOffset({ x: 0, y: 0 });

    const sel = window.getSelection();
    const context = sel ? ContextExtractor.getContext(sel) : '';
    const pageUrl = window.location.href;
    const pageTitle = document.title;

    // Build and log the prompts that will be sent to LLM
    const MAX_CONTEXT_FOR_API = 2000;
    const contextForApi = context.length > MAX_CONTEXT_FOR_API
      ? context.substring(0, MAX_CONTEXT_FOR_API) + '...'
      : context;

    const systemPrompt = lang === 'zh'
      ? translations.background.prompt.zh
      : translations.background.prompt.en;

    const userPrompt = `<page>
  <url>${pageUrl}</url>
  <title>${pageTitle}</title>
</page>
<context>${contextForApi}</context>
<selection>${selection}</selection>

请解释上述选中内容。`;

    console.log('%c[AI Search] === LLM REQUEST ===', 'color: #3b82f6; font-weight: bold');
    console.log('%c[System Prompt]', 'color: #8b5cf6; font-weight: bold');
    console.log(systemPrompt);
    console.log('%c[User Prompt]', 'color: #8b5cf6; font-weight: bold');
    console.log(userPrompt);

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      setLoading(false);
      setError(t.extUpdated[lang]);
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { action: 'queryAI', payload: { selection, context, pageUrl, pageTitle, targetLang: lang } },
        (response) => {
          setLoading(false);

          // Check for Chrome runtime error first
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || '';
            console.error('[AI Search] Runtime error:', errorMsg);

            // Handle extension context invalidated error
            if (errorMsg.includes('Extension context invalidated') ||
                errorMsg.includes('message port closed')) {
              setError(t.extUpdated[lang]);
            } else {
              setError(errorMsg || '通信错误');
            }
            return;
          }

          if (response?.error) {
            console.error('%c[AI Search] Error:', 'color: #ef4444', response.error);
            setError(response.error);
          } else if (response?.data) {
            setResult(response.data);
          } else {
            console.warn('[AI Search] Empty response received');
            setError(t.noResponse[lang]);
          }
        }
      );
    } catch (e) {
      console.error('[AI Search] Send failed:', e);
      setLoading(false);
      const errorStr = String(e);
      if (errorStr.includes('Extension context invalidated')) {
        setError(t.extUpdated[lang]);
      } else {
        setError('发送请求失败: ' + errorStr);
      }
    }
  };

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
    left: Math.min(Math.max(10, position.x - 20), window.innerWidth - 420) + dragOffset.x,
    top: Math.min(position.y - window.scrollY + 5, window.innerHeight - 350) + dragOffset.y,
    zIndex: 2147483647,
    width: 400,
    maxWidth: 'calc(100vw - 20px)',
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: '#1f2937',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
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
  };

  const selectionTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 12,
    color: '#111827',
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
            <div style={selectionTitleStyle}>{selection}</div>

            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {loading ? (
                <div style={loadingStyle}>
                  <div style={spinnerStyle} />
                  <span>{t.loading[lang]}</span>
                </div>
              ) : error ? (
                <div style={errorStyle}>
                  <strong>{t.errorTitle[lang]}</strong> {error}
                </div>
              ) : (
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
                    {result}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {!loading && result && (
              <div style={footerStyle}>
                <button
                  style={actionButtonStyle}
                  onClick={() => navigator.clipboard.writeText(result)}
                  title={t.copyTitle[lang]}
                >
                  📋
                </button>
                <button style={actionButtonStyle} title={t.speakTitle[lang]}>🔊</button>
                <button style={actionButtonStyle} title={t.likeTitle[lang]}>👍</button>
                <button style={actionButtonStyle} title={t.dislikeTitle[lang]}>👎</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ContentApp;
