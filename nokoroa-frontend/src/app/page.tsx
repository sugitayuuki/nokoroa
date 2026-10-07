'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useState } from 'react';

import PostCard from '@/components/post/PostCard';
import { GRID_LAYOUT } from '@/constants/theme';
import { usePaginatedPosts } from '@/hooks/usePaginatedPosts';
import { usePosts } from '@/hooks/usePosts';
import { useAuth } from '@/providers/AuthProvider';
import { useDialog } from '@/providers/DialogProvider';

export default function TopPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openSignup } = useDialog();
  const [page, setPage] = useState(0);

  const {
    data: posts,
    isLoading: postsLoading,
    error,
  } = usePosts({ limit: 12, page });

  const {
    posts: allPosts,
    isLoadingMore,
    lastElementRef,
  } = usePaginatedPosts({ data: posts, page, onPageChange: setPage, error });

  if (isLoading) {
    return (
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
    );
  }

  if (isAuthenticated) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID_LAYOUT,
          gap: 4,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {/*
          全面スピナー・エラー・空表示は「まだ 1 件も積めていない初回」に限る。
          SWR の isLoading / error はキー単位なので、2 ページ目の取得中や失敗で
          これらを出すと usePaginatedPosts が保持している累積まで画面から消え、
          ページ送りごとに一覧が点滅してスクロール位置が飛ぶ。
          2 ページ目以降の進捗は末尾の isLoadingMore スピナーが担当する。
        */}
        {postsLoading && allPosts.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 4,
              gridColumn: '1 / -1',
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {!postsLoading && error && allPosts.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center', gridColumn: '1 / -1' }}>
            <Typography variant="h6" color="error">
              投稿の読み込みに失敗しました
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error.message}
            </Typography>
          </Box>
        )}
        {!postsLoading && !error && allPosts.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center', gridColumn: '1 / -1' }}>
            <Typography variant="h6" color="text.secondary">
              投稿がありません
            </Typography>
          </Box>
        )}
        {allPosts.map((post, index) => (
          <Box
            key={post.id}
            ref={index === allPosts.length - 1 ? lastElementRef : null}
          >
            <PostCard post={post} />
          </Box>
        ))}

        {isLoadingMore && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 4,
              py: 4,
              gridColumn: '1 / -1',
            }}
          >
            <CircularProgress />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        minHeight: '80vh',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
          },
        }}
      >
        <Box
          component="img"
          src="/top.jpg"
          alt="旅の風景"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      </Box>

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={4}
          alignItems="center"
        >
          <Paper
            elevation={0}
            sx={{
              flexBasis: { md: '50%' },
              p: 4,
              textAlign: 'center',
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(26, 26, 26, 0.85)'
                  : 'rgba(255, 255, 255, 0.85)',
              borderRadius: 3,
              backdropFilter: 'blur(10px)',
              border: (theme) =>
                theme.palette.mode === 'dark'
                  ? '1px solid rgba(255, 255, 255, 0.1)'
                  : '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 8px 32px rgba(0, 0, 0, 0.3)'
                  : '0 8px 32px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 400,
                mb: 3,
                color: 'text.primary',
                fontSize: { xs: '2.5rem', md: '3rem' },
                fontFamily: 'serif',
              }}
            >
              Nokoroa
            </Typography>

            <Typography
              variant="body1"
              sx={{
                mb: 4,
                color: 'text.secondary',
                lineHeight: 1.6,
                fontWeight: 400,
                fontSize: '1rem',
              }}
            >
              旅の思い出を記録し、大切な人と共有するアプリ。あなたの素敵な
              <br />
              旅の体験をカタチにしましょう。
            </Typography>

            <Box sx={{ mt: 4 }}>
              <Button
                onClick={openSignup}
                variant="contained"
                size="large"
                sx={{
                  mr: 2,
                  bgcolor: '#9c27b0',
                  color: 'white',
                  borderRadius: 1,
                  px: 3,
                  py: 1,
                  fontWeight: 500,
                  fontSize: '1rem',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#7b1fa2',
                  },
                }}
              >
                アカウント作成
              </Button>
              <Button
                component={Link}
                href="/about"
                scroll={false}
                variant="outlined"
                size="large"
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  borderRadius: 1,
                  px: 3,
                  py: 1,
                  fontWeight: 500,
                  fontSize: '1rem',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    bgcolor: 'primary.main',
                    color: 'white',
                  },
                }}
              >
                詳しく見る
              </Button>
            </Box>
          </Paper>

          <Box
            sx={{
              flexBasis: { md: '50%' },
              display: 'flex',
              flexDirection: 'column',
              alignItems: { xs: 'center', md: 'flex-end' },
              justifyContent: 'center',
              pr: { md: 4 },
              mt: { xs: 4, md: 0 },
              textAlign: { xs: 'center', md: 'right' },
            }}
          >
            <Typography
              variant="h2"
              sx={{
                fontWeight: 400,
                color: 'white',
                textShadow:
                  '3px 3px 12px rgba(0, 0, 0, 0.9), 1px 1px 6px rgba(0, 0, 0, 0.8)',
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                lineHeight: 1.2,
                mb: 3,
                fontFamily: 'serif',
              }}
            >
              思い出を共有しよう。
            </Typography>

            <Typography
              variant="h5"
              sx={{
                color: 'white',
                textShadow:
                  '2px 2px 8px rgba(0, 0, 0, 0.9), 1px 1px 4px rgba(0, 0, 0, 0.7)',
                fontSize: { xs: '1.2rem', md: '1.4rem' },
                fontWeight: 400,
                lineHeight: 1.4,
                fontFamily: 'serif',
                transform: { xs: 'none', md: 'translateX(-20px)' },
              }}
            >
              旅の軌跡を、大切な人と。
            </Typography>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
