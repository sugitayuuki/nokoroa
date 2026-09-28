'use client';

import BookmarkIcon from '@mui/icons-material/Bookmark';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import PostCard from '@/components/post/PostCard';
import { GRID_LAYOUT } from '@/constants/theme';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getFavorites } from '@/lib/favorites';
import { FavoriteData } from '@/types/post';

export default function BookmarksPage() {
  const { isAuthLoading, isAuthenticated, isReady } = useRequireAuth();
  const [favorites, setFavorites] = useState<FavoriteData[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          gridTemplateColumns: GRID_LAYOUT,
          gap: 4,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {favorites.map((favorite) => (
          <Box key={favorite.id}>
            {/* ブックマーク一覧なので全件がブックマーク済み。
                カード毎の状態問い合わせを省く */}
            <PostCard post={favorite.post} isBookmarked />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
