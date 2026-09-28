'use client';

import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';

import PostCard from '@/components/post/PostCard';
import { GRID_LAYOUT } from '@/constants/theme';

import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SearchFetchError } from '../../hooks/useSearchPosts';
import { SearchMode, SearchResponse } from '../../types/search';

interface SearchResultsProps {
  data?: SearchResponse;
  isLoading: boolean;
  error?: Error;
  hasSearched: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  mode?: SearchMode;
}

export const SearchResults = ({
  data,
  isLoading,
  error,
  hasSearched,
  hasMore,
  isLoadingMore,
  onLoadMore,
  mode,
}: SearchResultsProps) => {
  const { lastElementRef } = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore,
  });
  if (isLoading && (!data || data.posts.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    if (
      mode === 'semantic' &&
      error instanceof SearchFetchError &&
      error.status === 401
    ) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          AI意味検索を利用するにはログインが必要です。
        </Alert>
      );
    }
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        検索中にエラーが発生しました。もう一度お試しください。
      </Alert>
    );
  }

  if (!hasSearched) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          検索条件を入力して投稿を検索してみてください。
        </Typography>
      </Box>
    );
  }

  if (mode === 'semantic' && data?.aiAvailable === false) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        AI意味検索が一時的に利用できません。少し時間をおいて再度お試しください。
      </Alert>
    );
  }

  if (!data || data.posts.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          検索条件にマッチする投稿がありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          検索結果
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data.total}件の投稿が見つかりました
        </Typography>
        {mode === 'semantic' && (
          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
            AI意味検索は類似度が高い上位 {data.posts.length} 件のみ表示します
          </Alert>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID_LAYOUT,
          gap: 4,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {data.posts.map((post, index) => (
          <div
            key={post.id}
            ref={index === data.posts.length - 1 ? lastElementRef : null}
          >
            <PostCard post={post} />
          </div>
        ))}
      </Box>

      {isLoadingMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, py: 4 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};
