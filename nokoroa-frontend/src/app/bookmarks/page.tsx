'use client';

import BookmarkIcon from '@mui/icons-material/Bookmark';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import BookmarkButton from '@/components/bookmarks/BookmarkButton';
import { getFavorites } from '@/lib/favorites';
import { useAuth } from '@/providers/AuthProvider';
import { FavoriteData } from '@/types/post';
import { formatDistanceToNow } from '@/utils/dateFormat';
import { getTagColor } from '@/utils/tagColors';

export default function BookmarksPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteData[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadFavorites();
    }
  }, [isAuthenticated]);

  const loadFavorites = async () => {
    try {
      setError(null);
      setFavoritesLoading(true);
      const response = await getFavorites(20, 0);
      setFavorites(response.favorites);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'ブックマーク一覧の取得に失敗しました',
      );
    } finally {
      setFavoritesLoading(false);
    }
  };

  if (loading) {
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

  if (!isAuthenticated) {
    return null;
  }

  if (favoritesLoading) {
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

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          ブックマークの読み込みに失敗しました
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Box>
    );
  }

  if (favorites.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          ブックマークした投稿がありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <BookmarkIcon sx={{ color: '#1976d2', fontSize: '2rem' }} />
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          ブックマーク ({favorites.length}件)
        </Typography>
      </Box>

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
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <Box
                component={Link}
                href={`/posts/${favorite.post.id}`}
                sx={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <CardMedia
                  component="img"
                  height="280"
                  image={favorite.post.imageUrl || '/top.jpg'}
                  alt={favorite.post.title}
                />
              </Box>
              <CardContent sx={{ flexGrow: 1, bgcolor: 'background.paper' }}>
                <Stack spacing={2}>
                  <Box
                    component={Link}
                    href={`/posts/${favorite.post.id}`}
                    sx={{
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
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
                      {formatDistanceToNow(favorite.post.createdAt)}
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
    </Box>
  );
}
