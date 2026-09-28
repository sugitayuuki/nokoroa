'use client';

import { Alert, Box, CircularProgress, Typography } from '@mui/material';

import { GRID_LAYOUT } from '@/constants/theme';

import { PostData } from '../../types/post';
import PostCard from './PostCard';

interface PostListProps {
  posts: PostData[];
  isLoading: boolean;
  error?: Error;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  lastElementRef?: (node: HTMLDivElement) => void;
  onLoadMore?: () => void;
}

export const PostList = ({
  posts,
  isLoading,
  error,
  isLoadingMore = false,
  lastElementRef,
  onLoadMore: _onLoadMore,
}: PostListProps) => {
  if (isLoading && posts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        投稿の読み込み中にエラーが発生しました。
      </Alert>
    );
  }

  if (posts.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          投稿がありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID_LAYOUT,
          gap: 4,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {posts.map((post, index) => (
          <div
            key={post.id}
            ref={
              index === posts.length - 1 && lastElementRef
                ? lastElementRef
                : null
            }
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
