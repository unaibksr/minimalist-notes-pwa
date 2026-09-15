import { useCallback, useRef } from 'react';
import type React from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface UseSwipeOptions {
  /** Called when a deliberate swipe in one of the tracked directions completes. */
  onSwipe: (direction: SwipeDirection) => void;
  /** Minimum horizontal travel (px) required to count as a swipe. */
  threshold?: number;
  /** Maximum vertical drift (px) tolerated before the gesture is treated as a scroll. */
  maxVertical?: number;
  /** When false the gesture is ignored entirely (e.g. on desktop). */
  enabled?: boolean;
  /**
   * When true, a swipe is ignored if the user already has text selected.
   * Useful on the editor so selecting text never navigates away.
   */
  ignoreWhenTextSelected?: boolean;
}

/**
 * Lightweight, dependency-free touch swipe detector.
 *
 * It only fires for gestures that are clearly horizontal (the horizontal
 * distance dominates the vertical distance) so that vertical scrolling and
 * diagonal drags never trigger navigation. Once a gesture is recognised as a
 * vertical scroll it is abandoned for the rest of the touch.
 */
export function useSwipe({
  onSwipe,
  threshold = 60,
  maxVertical = 60,
  enabled = true,
  ignoreWhenTextSelected = false,
}: UseSwipeOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      if (ignoreWhenTextSelected) {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim()) {
          tracking.current = false;
          return;
        }
      }
      const touch = e.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      tracking.current = true;
    },
    [enabled, ignoreWhenTextSelected]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      // As soon as vertical movement dominates, this is a scroll, not a swipe.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
        tracking.current = false;
      }
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      tracking.current = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;

      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > maxVertical) return;
      if (Math.abs(dx) < Math.abs(dy)) return;

      onSwipe(dx < 0 ? 'left' : 'right');
    },
    [enabled, threshold, maxVertical, onSwipe]
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}