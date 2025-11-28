'use client';

import { Box, Container, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { PostList } from '../../components/post/PostList';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { usePosts } from '../../hooks/usePosts';
import { PostData } from '../../types/post';

export default function PostsPage() {
  const [page, setPage] = useState(0);
  const [allPosts, setAllPosts] = useState<PostData[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, error } = usePosts({ page, limit: 10 });

  useEffect(() => {
    if (data) {
      if (page === 0) {
        setAllPosts(data.posts);
      } else {
        setAllPosts((prev) => [...prev, ...data.posts]);
      }
      setHasMore(data.hasMore);
      setIsLoadingMore(false);
    }
  }, [data, page]);

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setPage((prev) => prev + 1);
    }
  };

  const { lastElementRef } = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: handleLoadMore,
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          投稿一覧
        </Typography>
      </Box>

      <PostList
        posts={allPosts}
        isLoading={isLoading && page === 0}
        error={error}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        lastElementRef={lastElementRef}
      />
    </Container>
  );
}
