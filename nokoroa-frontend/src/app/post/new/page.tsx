'use client';

import { Box, Container, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'react-toastify';

import { API_CONFIG } from '@/lib/apiConfig';

import { PostForm } from '../../../components/post/PostForm';
import { useAuth } from '../../../providers/AuthProvider';
import { CreatePostData } from '../../../types/post';
import { getToken } from '../../../utils/auth';

export default function NewPostPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const API_URL = API_CONFIG.BASE_URL;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (data: CreatePostData) => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('認証トークンが見つかりません');
      }

      const response = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

  if (!isAuthenticated) {
    return null;
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
