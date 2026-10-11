// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchResults } from '@/components/search/SearchResults';
import type { SearchResponse } from '@/types/search';

// PostCard は画像・リンク・MUI テーマなど検索結果の外側の関心を持ち込むため、
// 「0 件のときの案内」を見たいここでは最小のスタブに差し替える。
vi.mock('@/components/post/PostCard', () => ({
  default: () => <div data-testid="post-card" />,
}));
vi.mock('../../../hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: () => ({ lastElementRef: () => {} }),
}));

afterEach(cleanup);

const baseProps = {
  posts: [],
  isLoading: false,
  hasSearched: true,
  hasQuery: true,
  hasMore: false,
  isLoadingMore: false,
  onLoadMore: () => {},
};

describe('SearchResults の 0 件表示', () => {
  // 意味検索は類似度の下限で足切りするため 0 件が常態的に起きる。
  // 「AI が落ちている」「まだ入力していない」「関連が無い」の 3 つは
  // 利用者に出すべき案内が全く違うので、取り違えないことを固定する。

  it('AI が利用不可なら、その旨を出す（0 件の案内に吸収しない）', () => {
    render(
      <SearchResults
        {...baseProps}
        mode="semantic"
        aiAvailable={false}
        total={0}
      />,
    );

    expect(screen.getByText(/AI意味検索が一時的に利用できません/)).toBeTruthy();
  });

  it('意味検索でクエリ未入力なら、入力を促す', () => {
    // この状態は fetch 自体が走らない。「関連が無い」と同じ案内にすると
    // 言い回しを変えても結果が変わらず、利用者が空振りし続ける。
    render(
      <SearchResults
        {...baseProps}
        mode="semantic"
        hasQuery={false}
        aiAvailable
      />,
    );

    expect(screen.getByText(/探したいことを入力してください/)).toBeTruthy();
    expect(screen.queryByText(/関連する投稿が見つかりませんでした/)).toBeNull();
  });

  it('意味検索でクエリ有り・0 件なら、関連が無い旨を出す', () => {
    render(
      <SearchResults {...baseProps} mode="semantic" aiAvailable total={0} />,
    );

    expect(screen.getByText(/関連する投稿が見つかりませんでした/)).toBeTruthy();
    // 「言い方を変えて」だけでは足りない。キーワード検索は q 全体の部分一致で、
    // 自然文のまま切り替えると再び 0 件になるため、短くする指示まで要る。
    expect(screen.getByText(/短い言葉にして/)).toBeTruthy();
  });

  it('キーワード検索の 0 件文言は変えない', () => {
    render(<SearchResults {...baseProps} mode="keyword" total={0} />);

    expect(
      screen.getByText(/検索条件にマッチする投稿がありません/),
    ).toBeTruthy();
  });

  it('クエリ無しのキーワード検索（タグ検索）では入力を促さない', () => {
    // /search?tags=X から来るタグ検索は q を持たないため hasQuery=false。
    // 「入力してください」の分岐から mode の条件が外れると、
    // タグ検索の結果案内がこの文言に乗っ取られる。
    render(
      <SearchResults
        {...baseProps}
        mode="keyword"
        hasQuery={false}
        total={0}
      />,
    );

    expect(screen.queryByText(/探したいことを入力してください/)).toBeNull();
    expect(
      screen.getByText(/検索条件にマッチする投稿がありません/),
    ).toBeTruthy();
  });
});

describe('SearchResults の結果あり表示', () => {
  // as never で潰すと SearchResponse['posts'] の形が変わっても気づけないので、
  // 実際の型のまま最小限を組む。
  const post = (id: number): SearchResponse['posts'][number] => ({
    id,
    title: `投稿${id}`,
    content: '本文',
    tags: [],
    isPublic: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    author: { id: 1, name: 'テスト' },
  });

  const withPosts = {
    ...baseProps,
    posts: [post(1), post(2)],
    total: 2,
  };

  it('意味検索では、上位のみ・関連の薄い投稿を除いたことを明示する', () => {
    // 旧文言は「類似度が高い上位 N 件のみ表示」で、足切り後の 38% 台も
    // 「類似度が高い」と称していた。件数の上限と足切りの両方に触れること。
    render(<SearchResults {...withPosts} mode="semantic" aiAvailable />);

    expect(screen.getByText(/関連度の高い順に上位のみを表示/)).toBeTruthy();
    expect(screen.getByText(/関連の薄い投稿は除いています/)).toBeTruthy();
  });

  it('キーワード検索では意味検索の注記を出さない', () => {
    render(<SearchResults {...withPosts} mode="keyword" />);

    expect(screen.queryByText(/関連度の高い順/)).toBeNull();
  });

  it('lowRelevance のときは「関連が薄い」と断ってから並べる', () => {
    // 足切りで全滅したケース。0 件にはせず上位を見せているので、
    // 通常の注記のまま出すと「精度が低いだけ」に見えて誤解させる。
    render(
      <SearchResults {...withPosts} mode="semantic" aiAvailable lowRelevance />,
    );

    expect(screen.getByText(/類似度が高い投稿はありませんでした/)).toBeTruthy();
    expect(screen.queryByText(/関連の薄い投稿は除いています/)).toBeNull();
  });

  it('lowRelevance のときは件数を該当件数として見せない', () => {
    // 「2件の投稿が見つかりました」と出すと、候補が 2 件しか無かったように
    // 読める。実際は候補はあるが全て下限未満、という状態。
    render(
      <SearchResults {...withPosts} mode="semantic" aiAvailable lowRelevance />,
    );

    expect(screen.queryByText(/件の投稿が見つかりました/)).toBeNull();
    expect(screen.getByText(/近いものを2件表示しています/)).toBeTruthy();
  });
});
