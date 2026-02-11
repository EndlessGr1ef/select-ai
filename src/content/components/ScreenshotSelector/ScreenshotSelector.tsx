// Screenshot Selector Component - Allows user to select a rectangular area on screen

import { useState, useEffect, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import { useScreenshot } from './useScreenshot';
import { type ScreenshotSelectorProps, type Rect } from './types';

const ScreenshotSelector: FC<ScreenshotSelectorProps> = ({ onComplete, onCancel }) => {
  const [selecting, setSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const { captureScreenshot } = useScreenshot();

  // Calculate rectangle from start and current positions
  const getRect = (): Rect | null => {
    if (!startPos || !currentPos) return null;

    return {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(currentPos.x - startPos.x),
      height: Math.abs(currentPos.y - startPos.y),
    };
  };

  const rect = getRect();

  // Handle mouse down - start selection
  const handleMouseDown = (e: ReactMouseEvent) => {
    if (processing) return;
    setSelecting(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move - update selection
  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!selecting || processing) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse up - complete selection
  const handleMouseUp = async () => {
    if (!selecting || processing || !rect || rect.width < 10 || rect.height < 10) {
      // Reset if selection is too small
      if (selecting && rect && (rect.width < 10 || rect.height < 10)) {
        // Show brief error hint for too small selection
        setSelecting(false);
        setStartPos(null);
        setCurrentPos(null);
      } else {
        setSelecting(false);
        setStartPos(null);
        setCurrentPos(null);
      }
      return;
    }

    setProcessing(true);

    try {
      const blob = await captureScreenshot(rect);
      onComplete(blob);
    } catch (error) {
      console.error('[ScreenshotSelector] Capture failed:', error);
      // Reset state and call cancel to show error in ContentApp
      setProcessing(false);
      setSelecting(false);
      setStartPos(null);
      setCurrentPos(null);
      onCancel();
    }
  };

  // Handle ESC key - cancel selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Prevent page scrolling while selecting
  useEffect(() => {
    if (selecting) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [selecting]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        zIndex: 2147483647,
        cursor: processing ? 'wait' : 'crosshair',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Help text */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 8,
          fontSize: 14,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        {processing ? '正在截图识别...' : '拖拽鼠标选择识别区域 • 按 ESC 取消'}
      </div>

      {/* Selection rectangle */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <div
          style={{
            position: 'fixed',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            border: '2px solid #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'none',
            transition: processing ? 'none' : 'all 0.05s ease-out',
          }}
        >
          {/* Size label */}
          <div
            style={{
              position: 'absolute',
              top: rect.height < 60 ? -36 : 8,
              left: rect.width < 120 ? 8 : 8,
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}
          >
            {Math.round(rect.width)} × {Math.round(rect.height)} px
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenshotSelector;
