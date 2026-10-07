'use client';

import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';

import PostCard from '@/components/post/PostCard';
import { GRID_LAYOUT } from '@/constants/theme';

import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SearchFetchError } from '../../hooks/useSearchPosts';
import { SearchMode, SearchResponse } from '../../types/search';

interface SearchResultsProps {
  /**
   * 表示する投稿。usePaginatedPosts が持つ累積をそのまま渡す。
   *
   * SWR の data を経由して渡してはいけない。検索は offset を変えて
   * SWR キーを変えるため、2 ページ目の取得中は data が undefined になり、
   * 累積ごと一覧が画面から消える。累積の正は常に呼び出し側のフックにある。
   */
  posts: SearchResponse['posts'];
  /** 総件数。ページ送り中は直前のレスポンスの値を使い続ける */
  total?: number;
  /** 意味検索で AI が利用できなかったか */
  aiAvailable?: boolean;
  isLoading: boolean;
  error?: Error;
  hasSearched: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  mode?: SearchMode;
}

export const SearchResults = ({
  posts,
  total,
  aiAvailable,
  isLoading,
  error,
  hasSearched,
  hasMore,
  isLoadingMore,
  onLoadMore,
  mode,
}: SearchResultsProps) => {
  const { lastElementRef } = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore,
  });
  // isLoading / error は SWR のキー単位なので、全面表示に使うのは
  // 「まだ 1 件も無い」ときだけ。2 ページ目以降の進捗と失敗は
  // 末尾の isLoadingMore / error が担当する。
  const hasResults = posts.length > 0;

  if (isLoading && !hasResults) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !hasResults) {
    if (
      mode === 'semantic' &&
      error instanceof SearchFetchError &&
      error.status === 401
    ) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          AI意味検索を利用するにはログインが必要です。
        </Alert>
      );
    }
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        検索中にエラーが発生しました。もう一度お試しください。
      </Alert>
    );
  }

  if (!hasSearched) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          検索条件を入力して投稿を検索してみてください。
        </Typography>
      </Box>
    );
  }

  if (mode === 'semantic' && aiAvailable === false) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        AI意味検索が一時的に利用できません。少し時間をおいて再度お試しください。
      </Alert>
    );
  }

  if (!hasResults) {
    // `total === undefined` をスピナー扱いにしてはいけない。
    // useSearchPosts は semantic でクエリが空のとき url を null にしてフェッチせず、
    // SearchForm はその状態でも送信できるため、未確定が永続してスピナーが
    // 止まらなくなる。
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          検索条件にマッチする投稿がありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          検索結果
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {total ?? posts.length}件の投稿が見つかりました
        </Typography>
        {mode === 'semantic' && (
          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
            AI意味検索は類似度が高い上位 {posts.length} 件のみ表示します
          </Alert>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID_LAYOUT,
          gap: 4,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {posts.map((post, index) => (
          <div
            key={post.id}
            ref={index === posts.length - 1 ? lastElementRef : null}
          >
            <PostCard post={post} />
          </div>
        ))}
      </Box>

      {isLoadingMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/*
        累積がある状態での失敗は結果を残したまま末尾で知らせる。
        ここで伝えないと、追加ページが取れていないのに
        「最後まで見た」のと区別がつかない。
      */}
      {error && (
        <Alert severity="error" sx={{ mt: 4 }}>
          続きの読み込みに失敗しました。もう一度お試しください。
        </Alert>
      )}
    </Box>
  );
};
