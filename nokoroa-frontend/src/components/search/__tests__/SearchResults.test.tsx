// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchResults } from '@/components/search/SearchResults';

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
  });

  it('キーワード検索の 0 件文言は変えない', () => {
    render(<SearchResults {...baseProps} mode="keyword" total={0} />);

    expect(
      screen.getByText(/検索条件にマッチする投稿がありません/),
    ).toBeTruthy();
  });
});

describe('SearchResults の結果あり表示', () => {
  const withPosts = {
    ...baseProps,
    posts: [{ id: 1 }, { id: 2 }] as never,
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
});
