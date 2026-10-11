// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchForm } from '@/components/search/SearchForm';

// 履歴・サジェスト・タグはネットワークと localStorage を触る外側の関心なので、
// モード切替でクエリが保たれるかだけを見たいここでは空のスタブにする。
vi.mock('@/hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    history: [],
    addToHistory: vi.fn(),
    removeFromHistory: vi.fn(),
  }),
}));
vi.mock('@/hooks/useSearchSuggestions', () => ({
  useSearchSuggestions: () => ({
    suggestions: [],
    isLoading: false,
    getSuggestions: vi.fn(),
  }),
}));
vi.mock('@/hooks/useTags', () => ({
  useTags: () => ({ tags: [] }),
}));

afterEach(cleanup);

describe('SearchForm のモード切替', () => {
  /** 自由文の入力欄(MUI Autocomplete なので role は combobox) */
  const queryInput = () =>
    screen.getAllByRole('combobox')[0] as HTMLInputElement;

  it('モードを切り替えてもクエリを持ち越す', () => {
    // 意味検索が 0 件のとき「短い言葉にしてキーワード検索も試して」と案内する。
    // 切替でクエリが消えると、案内に従った利用者が打ち直しになる。
    render(<SearchForm onSearch={vi.fn()} />);

    fireEvent.change(queryInput(), { target: { value: '紅葉の見ごろ' } });
    expect(queryInput().value).toBe('紅葉の見ごろ');

    fireEvent.click(screen.getByRole('button', { name: 'AI意味検索' }));
    expect(queryInput().value).toBe('紅葉の見ごろ');

    // 戻す向きも同じ。片道だけ直しても案内は成立しない。
    fireEvent.click(screen.getByRole('button', { name: 'キーワード検索' }));
    expect(queryInput().value).toBe('紅葉の見ごろ');
  });
});
