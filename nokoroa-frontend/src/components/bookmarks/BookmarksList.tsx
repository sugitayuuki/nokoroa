'use client';

import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { getFavorites } from '@/lib/favorites';
import { FavoriteData } from '@/types/post';
import { getTagColor } from '@/utils/tagColors';

import BookmarkButton from './BookmarkButton';

export default function BookmarksList() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async (offset = 0) => {
    try {
      setError(null);
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      const response = await getFavorites(10, offset);

      if (offset === 0) {
        setFavorites(response.favorites);
      } else {
        setFavorites((prev) => [...prev, ...response.favorites]);
      }

      setHasMore(response.hasMore);
    } catch (error) {
      setError(
        (error as Error).message || 'お気に入り一覧の取得に失敗しました',
      );
      toast.error((error as Error).message || 'エラーが発生しました');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    loadFavorites(favorites.length);
  };

  const handlePostClick = (postId: number) => {
    router.push(`/posts/${postId}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (favorites.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          お気に入りの投稿がありません
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          気になる投稿を見つけたら♡ボタンでお気に入りに追加しましょう
        </Typography>
        <Button
          variant="contained"
          onClick={() => router.push('/')}
          sx={{
            bgcolor: '#9c27b0',
            '&:hover': { bgcolor: '#7b1fa2' },
          }}
        >
          投稿を探す
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        お気に入り ({favorites.length}件)
      </Typography>

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
        {favorites.map((favorite) => (
          <Box key={favorite.id}>
            <Card
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
              onClick={() => handlePostClick(favorite.post.id)}
            >
              <CardMedia
                component="img"
                height="280"
                image={favorite.post.imageUrl || '/top.jpg'}
                alt={favorite.post.title}
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
                      {favorite.post.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {new Date(favorite.post.createdAt).toLocaleDateString(
                        'ja-JP',
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        },
                      )}
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
                    {favorite.post.content}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: 'wrap', gap: 1 }}
                  >
                    {favorite.post.location && (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 24,
                          px: 1,
                          fontSize: '0.8125rem',
                          borderRadius: '12px',
                          bgcolor: 'primary.light',
                          color: 'primary.contrastText',
                          gap: 0.5,
                        }}
                      >
                        <LocationOnIcon sx={{ fontSize: 16 }} />
                        {favorite.post.location}
                      </Box>
                    )}
                    {(favorite.post.tags || []).map((tag, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 24,
                          px: 1,
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          borderRadius: '12px',
                          backgroundColor: getTagColor(tag),
                          color: '#fff',
                        }}
                      >
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </Box>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        src={favorite.post.author.avatar || undefined}
                        sx={{ width: 32, height: 32 }}
                      >
                        {!favorite.post.author.avatar &&
                          favorite.post.author.name?.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" color="text.secondary">
                        {favorite.post.author.name}
                      </Typography>
                    </Box>
                    <Box onClick={(e) => e.stopPropagation()}>
                      <BookmarkButton
                        postId={favorite.post.id}
                        initialBookmarkCount={
                          favorite.post.favoritesCount ||
                          favorite.post._count?.favorites ||
                          0
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
      </Box>

      {hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            onClick={handleLoadMore}
            disabled={loadingMore}
            variant="outlined"
            sx={{ minWidth: 120 }}
          >
            {loadingMore ? <CircularProgress size={20} /> : 'もっと見る'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
