'use client';

import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';

import { EmptyState } from '@/components/common/EmptyState';
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
  /**
   * 意味検索で、類似度の下限を超える投稿が 1 件も無かったか。
   * このとき posts には上位数件が入っているので、そのまま並べず
   * 「関連が薄い」と断る必要がある。
   */
  lowRelevance?: boolean;
  isLoading: boolean;
  error?: Error;
  hasSearched: boolean;
  /**
   * 検索クエリ(自由文)が入力されているか。
   * 意味検索はクエリが空のままでも送信できるが、その場合 useSearchPosts は
   * フェッチせず結果 0 件になる。これを「関連が見つからなかった」と同じ
   * 案内にすると、利用者は言い回しを変え続けて永遠に空振りする。
   */
  hasQuery: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  mode?: SearchMode;
}

export const SearchResults = ({
  posts,
  total,
  aiAvailable,
  lowRelevance,
  isLoading,
  error,
  hasSearched,
  hasQuery,
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
    // そのフェッチが走らない状態を「関連が無い」と同じ案内にすると、
    // 言い回しを変えても結果が変わらず空振りし続けるため、先に切り分ける。
    if (mode === 'semantic' && !hasQuery) {
      return (
        <EmptyState
          message="探したいことを入力してください"
          description="「紅葉が見ごろの温泉」のように、文章で書くほど精度が上がります。"
        />
      );
    }

    // 意味検索は類似度の下限で足切りするため「0件」が普通に起きる。
    // キーワード検索と同じ文言だと、条件の問題なのか関連が無いのか区別できない。
    if (mode === 'semantic') {
      return (
        <EmptyState
          message="関連する投稿が見つかりませんでした"
          description="別の言い回しで試すか、キーワード検索に切り替えてみてください。"
        />
      );
    }

    return <EmptyState message="検索条件にマッチする投稿がありません" />;
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
        {mode === 'semantic' &&
          (lowRelevance ? (
            // 足切りで全滅したケース。0 件にはせず上位だけ見せているので、
            // 「関連が薄い」と先に断らないと精度が低いだけに見える。
            <Alert severity="warning" sx={{ mt: 2 }} icon={false}>
              類似度が高い投稿はありませんでした。関連が薄いかもしれませんが、近いものを表示します
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }} icon={false}>
              AI意味検索は関連度の高い順に上位のみを表示し、関連の薄い投稿は除いています
            </Alert>
          ))}
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
