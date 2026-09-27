import type { KeyboardEvent } from 'react';

/**
 * IME の変換中に発生したキーイベントかを判定する。
 *
 * 日本語入力では、変換を確定する Enter でも keydown が発火する。これを
 * 素通しすると「京都」と入力して変換を確定しただけで送信されてしまう。
 *
 * 判定を 3 つ重ねているのはブラウザ差があるため:
 * - `isComposing` … 標準。compositionstart 〜 compositionend の間 true
 * - `key === 'Process'` … Chrome / Edge が変換中に返す値
 * - `keyCode === 229` … 同上の旧 API。deprecated だが後方互換のため残す
 */
export function isComposingEvent(event: KeyboardEvent): boolean {
  const native = event.nativeEvent as globalThis.KeyboardEvent;
  return (
    native.isComposing || event.key === 'Process' || native.keyCode === 229
  );
}
