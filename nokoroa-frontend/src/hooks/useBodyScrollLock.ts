import { useEffect, useRef } from 'react';

interface ScrollLockState {
  overflow: string;
  position: string;
  top: string;
  width: string;
  scrollY: number;
}

export const useBodyScrollLock = (isLocked: boolean) => {
  const originalStateRef = useRef<ScrollLockState | null>(null);

  useEffect(() => {
    if (!isLocked) return;

    // 現在のスタイルを保存
    const scrollY = window.scrollY;
    originalStateRef.current = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      scrollY,
    };

    // スクロールをロック
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      if (originalStateRef.current) {
        // 元のスタイルに戻す
        document.body.style.overflow = originalStateRef.current.overflow;
        document.body.style.position = originalStateRef.current.position;
        document.body.style.top = originalStateRef.current.top;
        document.body.style.width = originalStateRef.current.width;

        // スクロール位置を復元
        window.scrollTo(0, originalStateRef.current.scrollY);

        // 参照をクリア
        originalStateRef.current = null;
      }
    };
  }, [isLocked]);
};
