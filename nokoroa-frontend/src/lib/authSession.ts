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
 * 「トークンが悪い」(保持しても無意味) のと「サーバ側が一時的に答えられない」
 * (トークンは有効かもしれない) を混ぜると、サーバの一時障害だけで
 * 強制ログアウトになる。
 */
export type AuthSessionResult =
  /** 認証は有効。user は 200 でも本文が想定外なら undefined になりうる */
  | { status: 'ok'; user: AuthUser | undefined }
  /** トークンが恒久的に無効。破棄してよい */
  | { status: 'unauthenticated' }
  /** 検証できなかった。トークンは有効かもしれないので残す。statusCode 無しは通信失敗 */
  | { status: 'unavailable'; statusCode?: number };

/** 検証が応答しないまま画面が固着するのを防ぐ上限 */
const SESSION_TIMEOUT_MS = 10_000;

/** 時間をおけば直りうるステータス。これ以外の 4xx はトークン側の問題として扱う */
const TRANSIENT_STATUSES = new Set([408, 429]);

const isTransient = (status: number) =>
  status >= 500 || TRANSIENT_STATUSES.has(status);

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
 * AuthProvider の起動時検証と OAuth コールバックの成功判定の両方がこれを使う。
 * コールバック側が独自に「保存できたら成功」と判断すると、セッションが
 * 使えなくても成功トーストが出てしまう。
 *
 * 「認証が通ったか」を /users/profile のガードから推定している点に注意。
 * このエンドポイントが JwtAuthGuard で保護されている限りにおいて成立する。
 */
export const fetchAuthSession = async (): Promise<AuthSessionResult> => {
  let response: Response;
  try {
    response = await createApiRequest(API_CONFIG.endpoints.userProfile, {
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    });
  } catch {
    // 到達不能・タイムアウト。トークンの有効性については何も分からない
    return { status: 'unavailable' };
  }

  // 前段のプロキシやキャプティブポータルに攫われた応答は 200 でも API の答えではない。
  // これを通すと無効なトークンで認証済みになる
  if (response.redirected) {
    return { status: 'unavailable', statusCode: response.status };
  }

  if (!response.ok) {
    return isTransient(response.status)
      ? { status: 'unavailable', statusCode: response.status }
      : { status: 'unauthenticated' };
  }

  try {
    return { status: 'ok', user: toAuthUser(await response.json()) };
  } catch {
    // 本文が壊れていてもガードは通っている。認証自体は有効
    return { status: 'ok', user: undefined };
  }
};

/** 検証結果から決まる認証状態。React に依存しないのでそのまま検証できる */
export type AuthState = {
  isAuthenticated: boolean;
  /** トークンを破棄すべきか。恒久的に無効なときだけ true */
  discardToken: boolean;
  user?: AuthUser;
  /** 検証できなかった。黙って未ログインにするとユーザーに理由が分からない */
  unverified: boolean;
};

export const resolveAuthState = (result: AuthSessionResult): AuthState => {
  if (result.status === 'ok') {
    return {
      isAuthenticated: true,
      discardToken: false,
      user: result.user,
      unverified: false,
    };
  }
  if (result.status === 'unauthenticated') {
    return { isAuthenticated: false, discardToken: true, unverified: false };
  }
  return { isAuthenticated: false, discardToken: false, unverified: true };
};
