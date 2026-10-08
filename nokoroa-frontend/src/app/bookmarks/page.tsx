'use client';

import BookmarkIcon from '@mui/icons-material/Bookmark';
import { Alert, Box, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { PageSpinner } from '@/components/common/PageSpinner';
import { RetryableError } from '@/components/common/RetryableError';
import PostCard from '@/components/post/PostCard';
import { GRID_LAYOUT } from '@/constants/theme';
import { usePaginatedPosts } from '@/hooks/usePaginatedPosts';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getFavorites } from '@/lib/favorites';
import { FavoriteData } from '@/types/post';

/** 1 ページあたりの取得件数 */
const PAGE_SIZE = 20;

export default function BookmarksPage() {
  const { isAuthLoading, isAuthenticated, isReady } = useRequireAuth();
  const [page, setPage] = useState(0);
  // usePaginatedPosts は「未取得なら undefined」という契約なので、
  // ページ取得中は undefined に戻す必要がある。
  const [pageData, setPageData] = useState<{
    posts: FavoriteData[];
    hasMore: boolean;
  }>();
  const [total, setTotal] = useState<number>();
  const [error, setError] = useState<Error>();

  const loadPage = useCallback(async (nextPage: number) => {
    setError(undefined);
    setPageData(undefined);
    try {
      const response = await getFavorites(PAGE_SIZE, nextPage * PAGE_SIZE);
      setPageData({ posts: response.favorites, hasMore: response.hasMore });
      setTotal(response.total);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error('ブックマーク一覧の取得に失敗しました'),
      );
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadPage(page);
    }
  }, [isAuthenticated, page, loadPage]);

  const {
    posts: bookmarks,
    isLoadingMore,
    lastElementRef,
  } = usePaginatedPosts({
    data: pageData,
    page,
    error,
    onPageChange: setPage,
  });

  if (!isReady) {
    return isAuthLoading ? <PageSpinner /> : null;
  }

  // 全面表示は「まだ 1 件も無い」ときだけ。2 ページ目以降の進捗と失敗は
  // 末尾の isLoadingMore / Alert が担当する (一覧ページ共通の扱い)。
  const hasBookmarks = bookmarks.length > 0;

  if (!pageData && !error && !hasBookmarks) {
    return <PageSpinner />;
  }

  if (error && !hasBookmarks) {
    return (
      <RetryableError
        message="ブックマークの読み込みに失敗しました"
        onRetry={() => void loadPage(page)}
      />
    );
  }

  if (!hasBookmarks) {
    return <EmptyState message="ブックマークした投稿がありません" />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <BookmarkIcon sx={{ color: '#1976d2', fontSize: '2rem' }} />
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          ブックマーク ({total ?? bookmarks.length}件)
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
        {bookmarks.map((favorite, index) => (
          <Box
            key={favorite.id}
            ref={index === bookmarks.length - 1 ? lastElementRef : null}
          >
            {/* ブックマーク一覧なので全件がブックマーク済み。
                カード毎の状態問い合わせを省く */}
            <PostCard post={favorite.post} isBookmarked />
          </Box>
        ))}
      </Box>

      {isLoadingMore && <PageSpinner variant="inline" />}

      {/* 累積がある状態での失敗は一覧を残したまま末尾で知らせる
          (page.tsx / SearchResults と同じ扱い) */}
      {error && hasBookmarks && (
        <Alert severity="error" sx={{ mt: 4 }}>
          続きの読み込みに失敗しました。もう一度お試しください。
        </Alert>
      )}
    </Box>
  );
}
