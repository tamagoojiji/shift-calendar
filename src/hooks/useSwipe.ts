import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipe(onLeft: () => void, onRight: () => void, threshold = 50): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    // 横方向の移動が縦より大きい場合のみスワイプ判定
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx < 0) onLeft();  // 左スワイプ → 次月
      else onRight();         // 右スワイプ → 前月
    }
  }, [onLeft, onRight, threshold]);

  return { onTouchStart, onTouchEnd };
}
