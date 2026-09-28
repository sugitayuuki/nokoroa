'use client';

import SearchIcon from '@mui/icons-material/Search';
import { Box, Container, Typography } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { usePaginatedPosts } from '@/hooks/usePaginatedPosts';

import { SearchForm } from '../../components/search/SearchForm';
import { SearchResults } from '../../components/search/SearchResults';
import { useSearchPosts } from '../../hooks/useSearchPosts';
import { SearchFilters } from '../../types/search';

/** 1 ページあたりの取得件数 */
const PAGE_SIZE = 10;

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<SearchFilters>({});
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const tagParam = searchParams.get('tags');
    if (tagParam) {
      const initialFilters: SearchFilters = {
        tags: [tagParam],
        mode: 'keyword',
        limit: PAGE_SIZE,
        offset: 0,
      };
      setFilters(initialFilters);
      setHasSearched(true);
    }
  }, [searchParams]);

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
    onPageChange: (nextPage) =>
      setFilters((prev) => ({
        ...prev,
        offset: nextPage * (prev.limit || PAGE_SIZE),
      })),
  });

  const handleSearch = (newFilters: SearchFilters) => {
    const searchFilters = {
      ...newFilters,
      limit: PAGE_SIZE,
      offset: 0,
    };
    setFilters(searchFilters);
    setHasSearched(true);
    reset();
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
        data={data ? { ...data, posts: allPosts } : undefined}
        isLoading={isLoading}
        error={error}
        hasSearched={hasSearched}
        hasMore={hasMore}
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
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
