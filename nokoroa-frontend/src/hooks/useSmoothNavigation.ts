'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { useNavigation } from '@/providers/NavigationProvider';

export function useSmoothNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { setIsNavigating } = useNavigation();

  const push = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      // 現在のパスと同じ場合はナビゲーションを実行しない
      if (pathname === href) {
        return;
      }

      setIsNavigating(true);

      // 少し遅延を加えてからナビゲーション実行
      setTimeout(() => {
        router.push(href, { scroll: options?.scroll ?? false });
      }, 100);
    },
    [router, pathname, setIsNavigating],
  );

  const replace = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      // 現在のパスと同じ場合はナビゲーションを実行しない
      if (pathname === href) {
        return;
      }

      setIsNavigating(true);

      setTimeout(() => {
        router.replace(href, { scroll: options?.scroll ?? false });
      }, 100);
    },
    [router, pathname, setIsNavigating],
  );

  const back = useCallback(() => {
    setIsNavigating(true);

    setTimeout(() => {
      router.back();
    }, 100);
  }, [router, setIsNavigating]);

  // スクロールを有効にして遷移するヘルパー関数
  const pushWithScroll = useCallback(
    (href: string) => {
      push(href, { scroll: true });
    },
    [push],
  );

  const replaceWithScroll = useCallback(
    (href: string) => {
      replace(href, { scroll: true });
    },
    [replace],
  );

  return {
    push,
    replace,
    back,
    pushWithScroll,
    replaceWithScroll,
  };
}
