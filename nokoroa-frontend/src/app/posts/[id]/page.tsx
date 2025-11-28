'use client';

import { Box, Container } from '@mui/material';
import { useParams } from 'next/navigation';

import { PostDetail } from '../../../components/post/PostDetail';
import { usePost } from '../../../hooks/usePost';

export default function PostDetailPage() {
  const params = useParams();
  const postId = parseInt(params.id as string);
  const { data: post, isLoading, error } = usePost(postId);

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center' }}>読み込み中...</Box>
      </Container>
    );
  }

  if (error || !post) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center' }}>投稿が見つかりませんでした。</Box>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="md"
      sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 1, sm: 2, md: 3 } }}
    >
      <PostDetail post={post} />
    </Container>
  );
}
