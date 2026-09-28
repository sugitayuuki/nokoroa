import { describe, expect, it } from 'vitest';

import { getTagColor } from '@/utils/tagColors';

const HEX = /^#[0-9A-F]{6}$/;
const PALETTE_SIZE = 16;

const SAMPLE_TAGS = [
  '京都',
  '東京',
  'travel',
  'sea',
  'グルメ',
  'カフェ',
  '温泉',
  '登山',
  'a',
  'A',
  '1',
  'とても長いタグ名をつけた場合の挙動を確認するためのタグ',
  'a'.repeat(50),
  '🍣',
  ' ',
  '-',
];

describe('getTagColor', () => {
  it('同じタグは何度呼んでも同じ色を返す', () => {
    for (const tag of SAMPLE_TAGS) {
      const first = getTagColor(tag);
      expect(getTagColor(tag)).toBe(first);
      expect(getTagColor(tag)).toBe(first);
    }
  });

  it('常にパレット内の 6 桁 HEX を返す', () => {
    for (const tag of SAMPLE_TAGS) {
      expect(getTagColor(tag)).toMatch(HEX);
    }
  });

  it('パレットは 16 色で、その範囲外の色は返さない', () => {
    // 十分な数のタグを流して、返る色の種類がパレット以内に収まることを確認する
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(getTagColor(`tag-${i}`));
    }
    expect(seen.size).toBeLessThanOrEqual(PALETTE_SIZE);
    expect(seen.size).toBe(PALETTE_SIZE);
  });

  it('空文字列でも undefined を返さず先頭の色になる (hash = 0)', () => {
    expect(getTagColor('')).toBe('#2196F3');
  });

  it('ハッシュが 32bit の負値に振れるタグでも undefined にならない', () => {
    // 'a' * 50 は hash が負 (-1203646688) になり Math.abs 経路を通る
    expect(getTagColor('a'.repeat(50))).toMatch(HEX);
    expect(getTagColor('travel')).toMatch(HEX);
  });

  it('文字列が違えば別タグとして扱う (正規化しない)', () => {
    expect(getTagColor('kyoto')).not.toBe(getTagColor('tokyo'));
    expect(getTagColor('mountain')).not.toBe(getTagColor('MOUNTAIN'));
    expect(getTagColor('京都')).not.toBe(getTagColor('京都 '));
  });

  it('大文字小文字の違いが同色に落ちる組み合わせがある (パレット数 16 の副作用)', () => {
    // 文字コード差 32 は 16 の倍数なので、符号が反転しない限り剰余が一致する。
    // 「大文字にしたら色が変わる」を前提にした実装を書かないための歯止め
    expect(getTagColor('kyoto')).toBe(getTagColor('Kyoto'));
    expect(getTagColor('sea')).toBe(getTagColor('SEA'));
  });

  it('異なるタグには色のばらつきがある (全部同色にはならない)', () => {
    const colors = new Set(SAMPLE_TAGS.map(getTagColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('文字列を連結してもハッシュが再計算され、部分文字列とは独立した色になる', () => {
    // 先頭が同じでも別の色になりうることを確認 (先頭数文字だけ見ていない)
    const base = getTagColor('京都');
    const extended = getTagColor('京都旅行');
    expect(extended).toMatch(HEX);
    expect(extended).not.toBe(base);
  });
});
