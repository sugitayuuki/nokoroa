'use client';

import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import {
  addFavorite,
  checkFavoriteStatus,
  removeFavorite,
} from '@/lib/favorites';
import { useAuth } from '@/providers/AuthProvider';

interface BookmarkButtonProps {
  postId: number;
  initialBookmarkCount?: number;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
}

export default function BookmarkButton({
  postId,
  initialBookmarkCount = 0,
  size = 'medium',
  showCount = true,
}: BookmarkButtonProps) {
  const { isAuthenticated } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);
  const [isLoading, setIsLoading] = useState(false);

  const loadBookmarkStatus = useCallback(async () => {
    try {
      const status = await checkFavoriteStatus(postId);
      setIsBookmarked(status.isFavorited);
    } catch {
      // ブックマーク状態の取得でエラーが発生した場合の処理
      // エラーが発生した場合は false として扱う
      setIsBookmarked(false);
    }
  }, [postId]);

  useEffect(() => {
    if (isAuthenticated) {
      loadBookmarkStatus();
    }
  }, [isAuthenticated, postId, loadBookmarkStatus]);

  const handleBookmarkToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('ブックマーク機能を利用するにはログインが必要です');
      return;
    }

    // 既にローディング中の場合は処理しない（連続クリック防止）
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    // 楽観的更新 - すぐにUIを更新
    const prevBookmarked = isBookmarked;
    const prevCount = bookmarkCount;

    setIsBookmarked(!isBookmarked);
    setBookmarkCount(
      isBookmarked ? (prev) => Math.max(0, prev - 1) : (prev) => prev + 1,
    );

    try {
      if (prevBookmarked) {
        await removeFavorite(postId);
        // toast.success('お気に入りから削除しました');
      } else {
        await addFavorite(postId);
        // toast.success('お気に入りに追加しました');
      }
    } catch (error) {
      // エラー時は元に戻す
      setIsBookmarked(prevBookmarked);
      setBookmarkCount(prevCount);

      // 認証エラーの場合は状態を元に戻さない（リロードを避ける）
      if ((error as Error).message?.includes('認証')) {
        toast.error('認証が無効です。再度ログインしてください。');
      } else {
        toast.error((error as Error).message || 'エラーが発生しました');
      }
      // ブックマーク操作でエラーが発生した場合の処理
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip
        title={isBookmarked ? 'ブックマークから削除' : 'ブックマークに追加'}
      >
        <IconButton
          onClick={handleBookmarkToggle}
          disabled={isLoading}
          size={size}
          sx={{
            color: isBookmarked ? '#1976d2' : 'text.secondary',
            '&:hover': {
              color: '#1976d2',
              bgcolor: 'rgba(25, 118, 210, 0.1)',
            },
            '&:disabled': {
              opacity: 0.6,
            },
          }}
        >
          {isBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
        </IconButton>
      </Tooltip>
      {showCount && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontSize: size === 'small' ? '0.75rem' : '0.875rem',
          }}
        >
          {bookmarkCount}
        </Typography>
      )}
    </Box>
  );
}
