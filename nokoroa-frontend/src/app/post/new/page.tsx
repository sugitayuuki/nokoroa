'use client';

import { Box, CircularProgress, Container, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';

import { PostForm } from '../../../components/post/PostForm';
import { CreatePostData } from '../../../types/post';

export default function NewPostPage() {
  const router = useRouter();
  const { isAuthLoading, isReady } = useRequireAuth();

  const handleSubmit = async (data: CreatePostData) => {
    try {
      const response = await createApiRequest(API_CONFIG.endpoints.posts, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('認証が必要です。再度ログインしてください。');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create post');
      }

      const post = await response.json();
      toast.success('投稿を作成しました！');
      router.push(`/posts/${post.id}`);
    } catch (error) {
      // 投稿作成でエラーが発生した場合の処理
      toast.error(
        error instanceof Error ? error.message : '投稿の作成に失敗しました',
      );
    }
  };

  if (!isReady) {
    return isAuthLoading ? (
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
    ) : null;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          新しい投稿を作成
        </Typography>
      </Box>

      <PostForm onSubmit={handleSubmit} />
    </Container>
  );
}
