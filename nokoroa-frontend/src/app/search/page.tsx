'use client';

import SearchIcon from '@mui/icons-material/Search';
import { Box, Container, Typography } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SearchForm } from '../../components/search/SearchForm';
import { SearchResults } from '../../components/search/SearchResults';
import { useSearchPosts } from '../../hooks/useSearchPosts';
import { PostData } from '../../types/post';
import { SearchFilters } from '../../types/search';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<SearchFilters>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [allPosts, setAllPosts] = useState<PostData[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const tagParam = searchParams.get('tags');
    if (tagParam) {
      const initialFilters: SearchFilters = {
        tags: [tagParam],
        mode: 'keyword',
        limit: 10,
        offset: 0,
      };
      setFilters(initialFilters);
      setHasSearched(true);
    }
  }, [searchParams]);

  const { data, isLoading, error } = useSearchPosts(filters, hasSearched);

  useEffect(() => {
    if (data) {
      if (filters.offset === 0 || !filters.offset) {
        setAllPosts(data.posts);
      } else {
        setAllPosts((prev) => [...prev, ...data.posts]);
      }
      setHasMore(data.hasMore);
      setIsLoadingMore(false);
    }
  }, [data, filters.offset]);

  const handleSearch = (newFilters: SearchFilters) => {
    const searchFilters = {
      ...newFilters,
      limit: 10,
      offset: 0,
    };
    setFilters(searchFilters);
    setHasSearched(true);
    setAllPosts([]);
  };

  const handleLoadMore = async () => {
    if (hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setFilters((prev) => ({
        ...prev,
        offset: (prev.offset || 0) + (prev.limit || 10),
      }));
    }
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
        onLoadMore={handleLoadMore}
        mode={filters.mode}
      />
    </Container>
  );
}
