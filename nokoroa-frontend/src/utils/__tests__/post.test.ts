import { describe, expect, it } from 'vitest';

import { getFavoritesCount } from '@/utils/post';

describe('getFavoritesCount', () => {
  it('favoritesCount があればそれを返す', () => {
    expect(getFavoritesCount({ favoritesCount: 3 })).toBe(3);
  });

  it('favoritesCount が無ければ _count.favorites にフォールバックする', () => {
    expect(getFavoritesCount({ _count: { favorites: 5 } })).toBe(5);
  });

  it('favoritesCount が 0 のときは _count.favorites を優先する', () => {
    expect(
      getFavoritesCount({ favoritesCount: 0, _count: { favorites: 2 } }),
    ).toBe(2);
  });

  it('どちらも無ければ 0 を返す', () => {
    expect(getFavoritesCount({})).toBe(0);
    expect(getFavoritesCount({ _count: null })).toBe(0);
  });
});
