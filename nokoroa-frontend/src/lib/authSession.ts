import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';

/**
 * 認証セッションの本人情報。
 * ヘッダー等の「ログイン中は誰か」の表示に使う最小限の項目のみを持つ。
 * bio や投稿数まで含むプロフィール全体が必要な画面は useUser() を使うこと
 * (プロフィール情報の正は API = useUser 側であり、ここはその部分集合)。
 */
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  avatar?: string;
};

/**
 * セッション検証の結果。
 *
 * `unauthenticated` と `unavailable` を必ず分けること。
 * 以前は非 2xx を一括で「無効」とみなしてトークンを削除していたため、
 * バックエンドが 500 を返しただけでログイン直後に強制ログアウトされ、
 * しかも画面には何も出ないという挙動になっていた。
 * 「トークンが悪い」のは 401 / 403 だけで、5xx や通信失敗は
 * サーバ側の一時障害なのでトークンを捨ててはいけない。
 */
export type AuthSessionResult =
  /** 認証は有効。user は 200 でも本文が想定外なら undefined になりうる */
  | { status: 'ok'; user: AuthUser | undefined }
  /** トークンが無効 (401 / 403)。保持していても無意味なので破棄してよい */
  | { status: 'unauthenticated' }
  /** サーバ側の一時障害 (5xx / 通信失敗)。トークンは有効かもしれないので残す */
  | { status: 'unavailable'; statusCode?: number };

/**
 * API レスポンスから認証ユーザーを組み立てる。
 * 必須項目が欠けている場合は undefined を返し、偽のユーザーを作らない。
 */
export const toAuthUser = (raw: unknown): AuthUser | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const { id, name, email, avatar } = raw as Record<string, unknown>;
  if (typeof id !== 'number' || typeof name !== 'string' || !name) {
    return undefined;
  }
  if (typeof email !== 'string' || !email) {
    return undefined;
  }
  return {
    id,
    name,
    email,
    avatar: typeof avatar === 'string' ? avatar : undefined,
  };
};

/**
 * 保存済みトークンで実際にセッションが使えるかをプロフィール API で確かめる。
 *
 * AuthProvider の起動時検証と、OAuth コールバックの成功判定の両方がこれを使う。
 * コールバック側が独自に「保存できたら成功」と判断すると、セッションが
 * 使えなくても成功トーストが出てしまう。
 */
export const fetchAuthSession = async (): Promise<AuthSessionResult> => {
  let response: Response;
  try {
    response = await createApiRequest(API_CONFIG.endpoints.userProfile);
  } catch {
    // ネットワーク到達不可。トークンの有効性については何も分からない
    return { status: 'unavailable' };
  }

  if (response.status === 401 || response.status === 403) {
    return { status: 'unauthenticated' };
  }
  if (!response.ok) {
    return { status: 'unavailable', statusCode: response.status };
  }

  try {
    return { status: 'ok', user: toAuthUser(await response.json()) };
  } catch {
    // 200 なのに本文が壊れている。認証自体は通っているのでトークンは消さない
    return { status: 'ok', user: undefined };
  }
};
