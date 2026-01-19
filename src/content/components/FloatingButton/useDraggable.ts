import { useState, useRef, useCallback, useEffect } from 'react';

export interface DragState {
  isDragging: boolean;
  position: { x: number; y: number };
}

export interface UseDraggableOptions {
  initialPosition?: { x: number; y: number };
  onDragEnd?: (position: { x: number; y: number }) => void;
}

export interface UseDraggableReturn {
  isDragging: boolean;
  position: { x: number; y: number };
  dragStartRef: React.MutableRefObject<{
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
  } | null>;
  buttonRef: React.RefObject<HTMLDivElement | null>;
  wasDraggingRef: React.MutableRefObject<boolean>;
  handleDragStart: (e: React.MouseEvent) => void;
}

export const useDraggable = (options: UseDraggableOptions = {}): UseDraggableReturn => {
  const { initialPosition = { x: window.innerWidth - 48, y: window.innerHeight / 2 - 24 }, onDragEnd } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const dragStartRef = useRef<{
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
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
  }, []);

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

      const newPosition = {
        x: e.clientX - dragStartRef.current.offsetX,
        y: e.clientY - dragStartRef.current.offsetY,
      };
      setPosition(newPosition);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      if (onDragEnd) {
        onDragEnd(position);
      }
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, position, onDragEnd]);

  return {
    isDragging,
    position,
    dragStartRef,
    buttonRef,
    wasDraggingRef,
    handleDragStart,
  };
};
