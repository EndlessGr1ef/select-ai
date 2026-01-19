import React from 'react';
import type { FloatingButtonProps } from './types';

const FloatingButton: React.FC<FloatingButtonProps> = ({
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
  return (
    <div
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
      onMouseDown={isTranslating ? undefined : onDragStart}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      title={uiLang === 'zh' ? '翻译' : 'Translate'}
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
          {uiLang === 'zh' ? '译' : 'Tr'}
        </span>
      )}
    </div>
  );
};

export default FloatingButton;
