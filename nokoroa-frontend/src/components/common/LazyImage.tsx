'use client';

import { Box, Skeleton } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  height?:
    | number
    | string
    | { xs?: number | string; sm?: number | string; md?: number | string };
  width?: number | string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const LazyImage = ({
  src,
  alt,
  height = 280,
  width = '100%',
  className,
  onLoad,
  onError,
}: LazyImageProps) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // IntersectionObserver が無い環境では遅延させず即時表示に倒す
    // (スケルトンのまま画像が永久に出ないのを防ぐ)
    if (typeof IntersectionObserver === 'undefined') {
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      },
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // onLoad イベントと下の ref 経路の両方から呼ばれ得るため、通知は src につき 1 回に抑える
  const hasNotifiedLoadRef = useRef(false);

  // src が差し替わったら読み込み状態を仕切り直す。リセットしないと
  // 2 枚目以降の onLoad が発火せず、エラー時の /top.jpg 固定も解けない
  useEffect(() => {
    hasNotifiedLoadRef.current = false;
    setHasLoaded(false);
    setHasError(false);
  }, [src]);
  const handleImageLoad = () => {
    if (hasNotifiedLoadRef.current) {
      return;
    }
    hasNotifiedLoadRef.current = true;
    setHasLoaded(true);
    onLoad?.();
  };

  const attachImgRef = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) {
      handleImageLoad();
    }
    // handleImageLoad は hasNotifiedLoadRef で冪等のため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <Box
      ref={imgRef}
      sx={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
      }}
    >
      {!hasLoaded && (
        <Skeleton
          variant="rectangular"
          width={typeof width === 'object' ? '100%' : width}
          height={typeof height === 'object' ? 280 : height}
          animation="wave"
          // 交差前は <img> がマウントされないため、読み込み中も画像の存在と
          // 代替テキストが支援技術に伝わるようにしておく
          role="img"
          aria-label={alt}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      )}
      {isIntersecting && (
        <Box
          component="img"
          src={hasError ? '/top.jpg' : src}
          alt={alt}
          className={className}
          // キャッシュ済み画像等で load イベントを取りこぼしても表示されるよう、
          // ref 時点で読み込み完了していればその場で確定させる
          // (useCallback で安定化し、毎レンダーの detach/attach を避ける)
          ref={attachImgRef}
          onLoad={handleImageLoad}
          onError={handleImageError}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: hasLoaded ? 'block' : 'none',
          }}
        />
      )}
    </Box>
  );
};
