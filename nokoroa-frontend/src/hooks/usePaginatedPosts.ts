'use client';

import { useCallback, useEffect, useState } from 'react';

import { useInfiniteScroll } from './useInfiniteScroll';

interface PaginatedResponse<T> {
  posts: T[];
  hasMore: boolean;
}

interface UsePaginatedPostsOptions<T> {
  /**
   * 現在ページのレスポンス。未取得 (undefined) の間は前ページまでの
   * 累積を保持する。
   */
  data?: PaginatedResponse<T>;
  /** data が何ページ目か (0 始まり)。0 のときは累積を置き換える */
  page: number;
  /** 次ページを要求する。hasMore かつ読み込み中でないときだけ呼ばれる */
  onPageChange: (nextPage: number) => void;
}

interface UsePaginatedPostsResult<T> {
  /** 1 ページ目からの累積 (id 重複は除外済み) */
  posts: T[];
  hasMore: boolean;
  isLoadingMore: boolean;
  /** 次ページ読み込みのトリガ。ボタン等から手動で叩ける */
  loadMore: () => void;
  /**
   * 一覧の最終要素に付けると、画面内に入った時点で loadMore が走る。
   * 自前で監視する一覧 (SearchResults 等) では使わなくてよい。
   */
  lastElementRef: (node: HTMLDivElement) => void;
  /** 検索条件を変えるなど、累積を捨てて 1 ページ目から組み直すとき呼ぶ */
  reset: () => void;
}

/**
 * ページ送り一覧の「累積 posts + hasMore + isLoadingMore + loadMore」を 1 か所にまとめる。
 *
 * ページ番号自体は呼び出し側が持つ (取得フックへ渡す条件の形が
 * ページ番号 / offset とページごとに異なるため)。このフックは受け取った
 * data を page に応じて置き換え / 追記し、無限スクロールの監視まで面倒を見る。
 */
export function usePaginatedPosts<T extends { id: number }>({
  data,
  page,
  onPageChange,
}: UsePaginatedPostsOptions<T>): UsePaginatedPostsResult<T> {
  const [posts, setPosts] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // reset 後に同一データ (SWR キャッシュヒットで参照が変わらない) が
  // 再適用されるよう、世代カウンタを取り込みの依存に含める
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!data) return;

    setPosts((prev) => {
      if (page === 0) return data.posts;
      const existingIds = new Set(prev.map((item) => item.id));
      return [
        ...prev,
        ...data.posts.filter((item) => !existingIds.has(item.id)),
      ];
    });
    setHasMore(data.hasMore);
    setIsLoadingMore(false);
  }, [data, page, generation]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    onPageChange(page + 1);
  }, [hasMore, isLoadingMore, onPageChange, page]);

  const reset = useCallback(() => {
    setPosts([]);
    setHasMore(false);
    setIsLoadingMore(false);
    setGeneration((prev) => prev + 1);
  }, []);

  const { lastElementRef } = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: loadMore,
  });

  return { posts, hasMore, isLoadingMore, loadMore, lastElementRef, reset };
}
