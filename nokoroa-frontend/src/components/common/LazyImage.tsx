'use client';

import { Box, Skeleton } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

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

  const handleImageLoad = () => {
    setHasLoaded(true);
    onLoad?.();
  };

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
