'use client';

import LocationOnIcon from '@mui/icons-material/LocationOn';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import BookmarkButton from '@/components/bookmarks/BookmarkButton';
import { LazyImage } from '@/components/common/LazyImage';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePosts } from '@/hooks/usePosts';
import { useAuth } from '@/providers/AuthProvider';
import { useDialog } from '@/providers/DialogProvider';
import { PostData } from '@/types/post';
import { formatDistanceToNow } from '@/utils/dateFormat';
import { getTagColor } from '@/utils/tagColors';

export default function TopPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { openSignup } = useDialog();
  const [page, setPage] = useState(0);
  const [allPosts, setAllPosts] = useState<PostData[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const {
    data: posts,
    isLoading: postsLoading,
    error,
  } = usePosts({ limit: 12, page });

  useEffect(() => {
    if (posts) {
      if (page === 0) {
        setAllPosts(posts.posts);
      } else {
        setAllPosts((prev) => [...prev, ...posts.posts]);
      }
      setHasMore(posts.hasMore);
      setIsLoadingMore(false);
    }
  }, [posts, page]);

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
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(3, 1fr)',
          },
          gap: 4,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {postsLoading && (
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
        {!postsLoading && error && (
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
        {!postsLoading &&
          allPosts.map((post, index) => (
            <Box
              key={post.id}
              ref={index === allPosts.length - 1 ? lastElementRef : null}
            >
              <Card
                component={Link}
                href={`/posts/${post.id}`}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  overflow: 'hidden',
                  minWidth: 320,
                  maxWidth: 400,
                  mx: 'auto',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
                  },
                }}
              >
                <LazyImage
                  src={post.imageUrl || '/top.jpg'}
                  alt={post.title}
                  height={280}
                />
                <CardContent sx={{ flexGrow: 1, bgcolor: 'background.paper' }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography
                        variant="h6"
                        component="h2"
                        gutterBottom
                        sx={{
                          fontWeight: 600,
                          color: 'text.primary',
                        }}
                      >
                        {post.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {formatDistanceToNow(post.createdAt)}
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {post.content}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ flexWrap: 'wrap', gap: 1 }}
                    >
                      {post.location && (
                        <Chip
                          icon={<LocationOnIcon />}
                          label={post.location}
                          size="small"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          sx={{
                            bgcolor: 'primary.light',
                            color: 'primary.contrastText',
                            cursor: 'default',
                          }}
                        />
                      )}
                      {(post.tags || []).map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag.startsWith('#') ? tag : `#${tag}`}
                          size="small"
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(
                              `/search?tags=${encodeURIComponent(tag)}`,
                            );
                          }}
                          sx={{
                            backgroundColor: getTagColor(tag),
                            color: '#fff',
                            fontWeight: 500,
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: getTagColor(tag),
                              filter: 'brightness(0.9)',
                            },
                          }}
                        />
                      ))}
                    </Stack>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 1,
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Avatar
                          src={post.author.avatar || undefined}
                          sx={{ width: 32, height: 32 }}
                        >
                          {!post.author.avatar && post.author.name?.charAt(0)}
                        </Avatar>
                        <Typography variant="body2" color="text.secondary">
                          {post.author.name}
                        </Typography>
                      </Box>
                      <Box onClick={(e) => e.stopPropagation()}>
                        <BookmarkButton
                          postId={post.id}
                          initialBookmarkCount={
                            post.favoritesCount || post._count?.favorites || 0
                          }
                          size="small"
                        />
                      </Box>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
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
              Nokora
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
