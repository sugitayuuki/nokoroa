'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useInfiniteScroll } from './useInfiniteScroll';

interface PaginatedResponse<T> {
  posts: T[];
  hasMore: boolean;
}

interface UsePaginatedPostsOptions<T> {
  /**
   * 現在ページのレスポンス。未取得 (undefined) の間は前ページまでの
   * 累積を保持する。
   *
   * 重要: 取得フックに SWR の `keepPreviousData` を付けてはいけない。
   * 付けると未取得ページでも「前ページの data」が同一参照で返り、
   * 下の取り込み effect が page だけ進んだ時点でそれを現ページとして扱う。
   * lastLoadedPageRef が進み isLoadingMore が解除されるため、
   * observer が即再発火して 1 ページ分が黙って欠落する。
   * 「未取得なら undefined」という契約がこのフックの前提。
   */
  data?: PaginatedResponse<T>;
  /** data が何ページ目か (0 始まり)。0 のときは累積を置き換える */
  page: number;
  /** 次ページを要求する。hasMore かつ読み込み中でないときだけ呼ばれる */
  onPageChange: (nextPage: number) => void;
  /**
   * 取得側のエラー。真の間は observer 経由の自動読み込みを止め、
   * isLoadingMore を解除する。再取得自体は SWR の自動リトライ
   * (指数バックオフ)に委ねる — ここで page を進めると失敗ページを
   * 飛ばした欠落や、失敗リクエストの連打ループになる。
   */
  error?: unknown;
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
  error,
}: UsePaginatedPostsOptions<T>): UsePaginatedPostsResult<T> {
  const [posts, setPosts] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // 最後に「取り込みに成功した」ページ。loadMore はこの +1 を要求する。
  // page prop 基準にすると、取得失敗後の再試行が失敗ページを飛ばして
  // そのページの投稿が黙って欠落する
  const lastLoadedPageRef = useRef(-1);
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
    lastLoadedPageRef.current = page;
    setIsLoadingMore(false);
  }, [data, page, generation]);

  // 取得失敗時に「読み込み中」で固着させない(固着すると observer も
  // loadMore も無効化されたままリトライ不能になる)
  useEffect(() => {
    if (error) {
      setIsLoadingMore(false);
    }
  }, [error]);

  const loadMore = useCallback(() => {
    // error 中は observer と同じく発火させない(キー不変で fetch も起きず、
    // リトライ解決までスピナーだけが出る無駄な待ち状態になるため)
    if (!hasMore || isLoadingMore || error) return;
    setIsLoadingMore(true);
    onPageChange(lastLoadedPageRef.current + 1);
  }, [hasMore, isLoadingMore, onPageChange, error]);

  const reset = useCallback(() => {
    setPosts([]);
    setHasMore(false);
    setIsLoadingMore(false);
    lastLoadedPageRef.current = -1;
    setGeneration((prev) => prev + 1);
  }, []);

  const { lastElementRef } = useInfiniteScroll({
    // エラー中は自動読み込みを止める(SWR のリトライ成功で error が消えれば再開)。
    // 止めないと「解除 → observer 再発火 → 失敗」の連打ループになる
    hasMore: hasMore && !error,
    isLoading: isLoadingMore,
    onLoadMore: loadMore,
  });

  return { posts, hasMore, isLoadingMore, loadMore, lastElementRef, reset };
}
