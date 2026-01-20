import React from 'react';

export interface FloatingButtonProps {
  isTranslating: boolean;
  isDragging: boolean;
  position: { x: number; y: number };
  onDragStart: (e: React.MouseEvent) => void;
  onClick: () => void;
  onMouseOver: (e: React.MouseEvent) => void;
  onMouseOut: (e: React.MouseEvent) => void;
  uiLang: 'zh' | 'en';
  isFullscreen: boolean;
  ref: React.RefObject<HTMLDivElement | null>;
}
