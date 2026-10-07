/**
 * 履歴を増やさずフルロードで遷移する。
 *
 * AuthProvider の検証 effect は deps が空で再実行されないため、認証直後は
 * SPA 遷移では認証状態が反映されない。そこだけはフルロードで渡す必要がある。
 * window.location を直に呼ぶとテストから差し替えられないので関数にしている。
 */
export const replaceLocation = (url: string): void => {
  window.location.replace(url);
};
