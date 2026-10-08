'use client';

import SearchIcon from '@mui/icons-material/Search';
import { Box, CircularProgress, Container, Typography } from '@mui/material';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { usePaginatedPosts } from '@/hooks/usePaginatedPosts';

import { SearchForm } from '../../components/search/SearchForm';
import { SearchResults } from '../../components/search/SearchResults';
import { useSearchPosts } from '../../hooks/useSearchPosts';
import { SearchFilters } from '../../types/search';

/** 1 ページあたりの取得件数 */
const PAGE_SIZE = 10;

/**
 * URL のクエリから初期検索条件を組む。
 * マウント後の useEffect で入れると SearchForm が空 filters を初期値として
 * 確定させてしまい、結果だけ絞られてフォームにタグが出ない状態になるため、
 * 初期化時点で決める。
 */
function initialFiltersFromParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): SearchFilters {
  const tagParam = params.get('tags');
  if (!tagParam) return {};
  return { tags: [tagParam], mode: 'keyword', limit: PAGE_SIZE, offset: 0 };
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<SearchFilters>(() =>
    initialFiltersFromParams(searchParams),
  );
  const [hasSearched, setHasSearched] = useState(
    () => !!searchParams.get('tags'),
  );

  const { data, isLoading, error } = useSearchPosts(filters, hasSearched);

  // 検索 API は offset 指定なので、累積側が扱うページ番号へ読み替える
  const pageSize = filters.limit || PAGE_SIZE;
  const page = Math.floor((filters.offset || 0) / pageSize);

  const {
    posts: allPosts,
    hasMore,
    isLoadingMore,
    loadMore,
    reset,
  } = usePaginatedPosts({
    data,
    page,
    error,
    onPageChange: (nextPage) =>
      setFilters((prev) => ({
        ...prev,
        offset: nextPage * (prev.limit || PAGE_SIZE),
      })),
  });

  // 件数などのメタ情報は data から直接読むとページ送り中に消えるため、
  // 直前のレスポンスの値を保持しておく(一覧は allPosts が正)。
  const [resultMeta, setResultMeta] = useState<{
    total: number;
    aiAvailable?: boolean;
  }>();
  // 同条件の再検索では SWR キーが変わらず data の参照も変わらないため、
  // [data] だけを依存にすると setResultMeta(undefined) を取り消せない。
  // usePaginatedPosts の generation と同じ役割。
  const [metaGeneration, setMetaGeneration] = useState(0);

  useEffect(() => {
    if (data) {
      setResultMeta({ total: data.total, aiAvailable: data.aiAvailable });
    }
  }, [data, metaGeneration]);

  /** 新しい検索条件を適用する。累積とメタ情報を両方捨てて組み直す。 */
  const startNewSearch = useCallback(
    (next: SearchFilters) => {
      setFilters(next);
      setHasSearched(true);
      setResultMeta(undefined);
      setMetaGeneration((prev) => prev + 1);
      reset();
    },
    [reset],
  );

  // 同じページに留まったまま ?tags= が変わる経路(タグチップの連続クリック等)に追従する。
  // 初期値は useState 側で入れているので、ここは変化したときだけを担う。
  // 適用済みタグを永久保持すると「?tags=A → フォーム検索 → 再び ?tags=A」で
  // 再適用されなくなるため、handleSearch 側で null に戻している。
  const appliedTagParamRef = useRef(searchParams.get('tags'));
  useEffect(() => {
    const tagParam = searchParams.get('tags');
    if (tagParam && tagParam !== appliedTagParamRef.current) {
      appliedTagParamRef.current = tagParam;
      startNewSearch(initialFiltersFromParams(searchParams));
    }
  }, [searchParams, startNewSearch]);

  const handleSearch = (newFilters: SearchFilters) => {
    // URL のタグ条件から離れるので、適用済みマークを捨てる
    appliedTagParamRef.current = null;
    startNewSearch({ ...newFilters, limit: PAGE_SIZE, offset: 0 });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <SearchIcon sx={{ fontSize: 'inherit', color: '#ff9800' }} />
          投稿を検索
        </Typography>
        <SearchForm onSearch={handleSearch} initialFilters={filters} />
      </Box>

      <SearchResults
        // 一覧は累積を持つ usePaginatedPosts から直接渡す。
        // SWR の data はページごとにキーが変わって undefined になるため、
        // これを経由すると 2 ページ目の取得中に結果が全部消える。
        posts={allPosts}
        total={resultMeta?.total}
        aiAvailable={resultMeta?.aiAvailable}
        isLoading={isLoading}
        error={error}
        hasSearched={hasSearched}
        hasMore={hasMore && !error}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        mode={filters.mode}
      />
    </Container>
  );
}

/**
 * useSearchParams は Suspense 境界の内側で使う必要がある
 * (Next.js 15 では境界が無いと prerender エラーになる)。
 */
export default function SearchPage() {
  return (
    <Suspense
      // 空の fallback だとプリレンダ HTML が空になり、ディープリンク時に
      // ハイドレーション完了まで白画面が出る。スピナーを見せる
      fallback={
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
