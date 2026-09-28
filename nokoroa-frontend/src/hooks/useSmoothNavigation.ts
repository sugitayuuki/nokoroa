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

      // プログレスバーを出してから即座に遷移する
      // (遷移完了時に NavigationProvider が pathname 変化で false に戻す)
      setIsNavigating(true);
      router.push(href, { scroll: options?.scroll ?? false });
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
      router.replace(href, { scroll: options?.scroll ?? false });
    },
    [router, pathname, setIsNavigating],
  );

  const back = useCallback(() => {
    setIsNavigating(true);
    router.back();
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
