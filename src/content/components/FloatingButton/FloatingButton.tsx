import React from 'react';
import type { FloatingButtonProps } from './types';

const FloatingButton: React.FC<FloatingButtonProps> = ({
  ref,
  isTranslating,
  isDragging,
  position,
  onDragStart,
  onClick,
  onMouseOver,
  onMouseOut,
  uiLang,
  isFullscreen,
}) => {
  const buttonText = uiLang === 'zh' ? '译' : 'Tr';

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 27,
        height: 27,
        borderRadius: '50%',
        background: isTranslating
          ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
          : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #6366f1 100%)',
        boxShadow: isTranslating
          ? '0 2px 6px rgba(100, 116, 139, 0.4)'
          : '0 3px 9px rgba(139, 92, 246, 0.45)',
        cursor: isDragging ? 'grabbing' : 'pointer',
        zIndex: 2147483646,
        display: isFullscreen ? 'none' : 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        border: 'none',
        fontSize: uiLang === 'zh' ? 11 : 10,
        fontWeight: 600,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textShadow: '0 1px 1.5px rgba(0, 0, 0, 0.2)',
        transition: isDragging ? 'none' : 'all 0.2s ease',
        touchAction: 'none',
        userSelect: 'none',
      }}
      onMouseDown={isTranslating ? undefined : onDragStart}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      title={uiLang === 'zh' ? '翻译' : 'Translate'}
    >
      {isTranslating ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="select-ai-loading-spinner"
            style={{
              width: 14,
              height: 14,
              border: '2px solid rgba(255, 255, 255, 0.9)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'select-ai-spin 0.8s linear infinite',
            }}
          />
        </div>
      ) : (
        <span style={{
          animation: isDragging ? 'none' : 'pulse 2s ease-in-out infinite',
        }}>{buttonText}</span>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default FloatingButton;
