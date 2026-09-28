import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatDateTime,
  formatDistanceToNow,
  formatJoinedDate,
  formatPostDate,
} from '@/utils/dateFormat';

// date-fns の format はローカルタイムゾーン依存なので、文字列入力もオフセットを
// 付けない形 ('2024-03-05T12:34:56') にしてローカル時刻として解釈させる。
// これで CI (UTC) でも手元 (JST) でも同じ結果になる。

describe('formatJoinedDate', () => {
  it('yyyy年MM月 形式にする', () => {
    expect(formatJoinedDate(new Date(2024, 2, 5, 12, 34))).toBe('2024年03月');
  });

  it('1 桁の月をゼロ埋めする', () => {
    expect(formatJoinedDate(new Date(2024, 0, 1))).toBe('2024年01月');
  });

  it('12 月 (年の境界) も正しく扱う', () => {
    expect(formatJoinedDate(new Date(2023, 11, 31, 23, 59))).toBe('2023年12月');
  });

  it('ISO 文字列を受け取れる', () => {
    expect(formatJoinedDate('2024-03-05T12:34:56')).toBe('2024年03月');
  });
});

describe('formatPostDate', () => {
  it('yyyy年MM月dd日 形式にする', () => {
    expect(formatPostDate(new Date(2024, 2, 5))).toBe('2024年03月05日');
  });

  it('月と日を 2 桁にゼロ埋めする', () => {
    expect(formatPostDate(new Date(2024, 0, 2))).toBe('2024年01月02日');
  });

  it('うるう年の 2/29 を扱える', () => {
    expect(formatPostDate(new Date(2024, 1, 29))).toBe('2024年02月29日');
  });

  it('文字列と Date で同じ結果になる', () => {
    expect(formatPostDate('2024-03-05T12:34:56')).toBe(
      formatPostDate(new Date(2024, 2, 5, 12, 34, 56)),
    );
  });
});

describe('formatDateTime', () => {
  it('yyyy年MM月dd日 HH:mm 形式にする', () => {
    expect(formatDateTime(new Date(2024, 2, 5, 12, 34))).toBe(
      '2024年03月05日 12:34',
    );
  });

  it('時刻を 24 時間表記のゼロ埋めで出す', () => {
    expect(formatDateTime(new Date(2024, 2, 5, 9, 5))).toBe(
      '2024年03月05日 09:05',
    );
  });

  it('深夜 0 時を 00:00 として出す (12:00 にならない)', () => {
    expect(formatDateTime(new Date(2024, 2, 5, 0, 0))).toBe(
      '2024年03月05日 00:00',
    );
  });

  it('午後を 13 時以降として出す', () => {
    expect(formatDateTime(new Date(2024, 2, 5, 23, 59))).toBe(
      '2024年03月05日 23:59',
    );
  });
});

describe('formatDistanceToNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const freezeAt = (date: Date) => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  };

  it('過去の日時は日本語の「〜前」になる', () => {
    freezeAt(new Date(2024, 2, 5, 12, 0));
    expect(formatDistanceToNow(new Date(2024, 2, 5, 11, 0))).toBe('約1時間前');
  });

  it('未来の日時は日本語の「〜後」になる', () => {
    freezeAt(new Date(2024, 2, 5, 12, 0));
    expect(formatDistanceToNow(new Date(2024, 2, 5, 13, 0))).toBe('約1時間後');
  });

  it('1 分未満でも「たった今」ではなく分単位で表示する', () => {
    // ja ロケールは 30 秒を 1 分扱いにする。「0分前」や空文字にならないことを固定する
    freezeAt(new Date(2024, 2, 5, 12, 0, 30));
    expect(formatDistanceToNow(new Date(2024, 2, 5, 12, 0, 0))).toBe('1分前');

    freezeAt(new Date(2024, 2, 5, 12, 0, 5));
    expect(formatDistanceToNow(new Date(2024, 2, 5, 12, 0, 0))).toBe('約1分前');
  });

  it('数日前は日単位で表現する', () => {
    freezeAt(new Date(2024, 2, 5, 12, 0));
    expect(formatDistanceToNow(new Date(2024, 2, 2, 12, 0))).toBe('3日前');
  });

  it('文字列入力でも Date 入力と同じ結果になる', () => {
    freezeAt(new Date(2024, 2, 5, 12, 0));
    expect(formatDistanceToNow('2024-03-05T11:00:00')).toBe(
      formatDistanceToNow(new Date(2024, 2, 5, 11, 0)),
    );
  });
});

describe('不正な日時の扱い', () => {
  // 現状はガードが無く date-fns が RangeError を投げる。呼び出し側が
  // 握っていないとレンダリングごと落ちるため、挙動を明示して固定しておく
  it('パースできない文字列では例外になる', () => {
    expect(() => formatPostDate('not-a-date')).toThrow(RangeError);
    expect(() => formatDateTime('')).toThrow(RangeError);
    expect(() => formatJoinedDate(new Date(NaN))).toThrow(RangeError);
  });
});
