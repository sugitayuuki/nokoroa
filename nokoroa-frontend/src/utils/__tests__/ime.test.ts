import type { KeyboardEvent } from 'react';
import { describe, expect, it } from 'vitest';

import { isComposingEvent } from '@/utils/ime';

type NativeParts = {
  isComposing?: boolean;
  keyCode?: number;
};

/**
 * React の KeyboardEvent は実装が巨大なので、isComposingEvent が参照する
 * 3 つのフィールドだけを持つ最小オブジェクトを組み立てて渡す。
 */
const makeEvent = (key: string, native: NativeParts = {}): KeyboardEvent => {
  const nativeEvent = {
    isComposing: native.isComposing ?? false,
    keyCode: native.keyCode ?? 0,
  };
  return { key, nativeEvent } as unknown as KeyboardEvent;
};

describe('isComposingEvent', () => {
  describe('変換中と判定するケース', () => {
    it('nativeEvent.isComposing が true なら変換中', () => {
      expect(isComposingEvent(makeEvent('a', { isComposing: true }))).toBe(
        true,
      );
    });

    it('変換確定の Enter (key は Enter だが isComposing が true) を変換中と判定する', () => {
      // 「京都」と打って変換確定した Enter。ここを取りこぼすと確定だけで送信される
      const event = makeEvent('Enter', { isComposing: true, keyCode: 13 });
      expect(isComposingEvent(event)).toBe(true);
    });

    it('key === "Process" なら変換中 (Chrome / Edge)', () => {
      expect(isComposingEvent(makeEvent('Process'))).toBe(true);
    });

    it('keyCode === 229 なら変換中 (旧 API)', () => {
      expect(
        isComposingEvent(makeEvent('Unidentified', { keyCode: 229 })),
      ).toBe(true);
    });

    it('isComposing が false でも keyCode 229 なら変換中と判定する', () => {
      const event = makeEvent('Enter', { isComposing: false, keyCode: 229 });
      expect(isComposingEvent(event)).toBe(true);
    });
  });

  describe('変換中ではないと判定するケース', () => {
    it('素の Enter は変換中ではない', () => {
      const event = makeEvent('Enter', { isComposing: false, keyCode: 13 });
      expect(isComposingEvent(event)).toBe(false);
    });

    it('通常の文字キーは変換中ではない', () => {
      expect(isComposingEvent(makeEvent('a', { keyCode: 65 }))).toBe(false);
    });

    it('keyCode 228 / 230 は 229 の境界外なので変換中ではない', () => {
      expect(isComposingEvent(makeEvent('Enter', { keyCode: 228 }))).toBe(
        false,
      );
      expect(isComposingEvent(makeEvent('Enter', { keyCode: 230 }))).toBe(
        false,
      );
    });

    it('key が "process" (小文字) は大文字小文字を区別するため変換中ではない', () => {
      expect(isComposingEvent(makeEvent('process'))).toBe(false);
    });

    it('修飾キーや Escape も変換中ではない', () => {
      expect(isComposingEvent(makeEvent('Escape', { keyCode: 27 }))).toBe(
        false,
      );
      expect(isComposingEvent(makeEvent('Shift', { keyCode: 16 }))).toBe(false);
    });
  });

  it('nativeEvent に isComposing / keyCode が無い環境でも変換中とは判定しない', () => {
    // 全オペランドが falsy のため || は最後の比較結果 false を返す
    const event = { key: 'Enter', nativeEvent: {} } as unknown as KeyboardEvent;
    expect(isComposingEvent(event)).toBe(false);
  });
});
