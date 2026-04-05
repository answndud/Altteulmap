"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEventHandler } from "react";

export type MobileSheetMode = "peek" | "expanded";

type UseMobileSheetGestureOptions = {
  closeThreshold?: number;
  enabled: boolean;
  expandThreshold?: number;
  maxDownwardDrag?: number;
  maxUpwardDrag?: number;
  mode?: MobileSheetMode;
  onClose?: () => void;
  onCollapse?: () => void;
  onExpand?: () => void;
};

type MobileSheetGestureResult = {
  handlePointerCancel: PointerEventHandler<HTMLElement>;
  handlePointerDown: PointerEventHandler<HTMLElement>;
  handlePointerMove: PointerEventHandler<HTMLElement>;
  handlePointerUp: PointerEventHandler<HTMLElement>;
  isDragging: boolean;
  style: CSSProperties | undefined;
};

function isDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches;
}

export function useMobileSheetGesture({
  closeThreshold = 84,
  enabled,
  expandThreshold = 56,
  maxDownwardDrag = 180,
  maxUpwardDrag = 72,
  mode,
  onClose,
  onCollapse,
  onExpand,
}: UseMobileSheetGestureOptions): MobileSheetGestureResult {
  const activePointerIdRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetGesture = () => {
    activePointerIdRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  const resolveGesture = (deltaY: number) => {
    if (deltaY <= -expandThreshold && onExpand) {
      onExpand();
    } else if (deltaY >= closeThreshold) {
      if (mode === "expanded" && onCollapse) {
        onCollapse();
      } else if (onClose) {
        onClose();
      } else if (onCollapse) {
        onCollapse();
      }
    }

    resetGesture();
  };

  const handlePointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (!enabled || isDesktopViewport()) {
      return;
    }

    activePointerIdRef.current = event.pointerId;
    startYRef.current = event.clientY;
    currentYRef.current = event.clientY;
    setIsDragging(true);
    setDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove: PointerEventHandler<HTMLElement> = (event) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    currentYRef.current = event.clientY;
    const rawOffset = currentYRef.current - startYRef.current;
    const clampedOffset = Math.max(
      -maxUpwardDrag,
      Math.min(maxDownwardDrag, rawOffset),
    );
    setDragOffset(clampedOffset);
  };

  const handlePointerUp: PointerEventHandler<HTMLElement> = (event) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resolveGesture(currentYRef.current - startYRef.current);
  };

  const handlePointerCancel: PointerEventHandler<HTMLElement> = (event) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resetGesture();
  };

  const style = useMemo<CSSProperties | undefined>(() => {
    if (dragOffset === 0) {
      return undefined;
    }

    return {
      transform: `translateY(${dragOffset}px)`,
    };
  }, [dragOffset]);

  return {
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isDragging,
    style,
  };
}
