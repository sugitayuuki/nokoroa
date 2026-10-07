import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';

/**
 * 認証セッションの本人情報。「ログイン中は誰か」の表示に使う最小限のみを持つ。
 * bio や投稿数まで含むプロフィール全体が必要な画面は useUser() を使うこと。
 */
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  avatar?: string;
};

/**
 * 検証できなかった理由。ユーザーに出す説明と対処がこれで決まるため、
 * 到達できたか (server / timeout) と出来なかったか (network) を分けて持つ。
 */
export type UnavailableReason =
  | { reason: 'server'; statusCode: number }
  | { reason: 'timeout' }
  | { reason: 'network' }
  /** 前段のプロキシ等に攫われ、API の応答が返っていない */
  | { reason: 'intercepted' };

/**
 * セッション検証の結果。
 * 「トークンが悪い」(保持しても無意味) と「検証できなかった」(有効かもしれない)
 * を混ぜると、サーバの一時障害だけで強制ログアウトになる。
 */
export type AuthSessionResult =
  /** 認証は有効。本文が想定外なら user は undefined になりうる */
  | { status: 'ok'; user: AuthUser | undefined }
  | { status: 'unauthenticated' }
  | ({ status: 'unavailable' } & UnavailableReason);

/** 検証が応答しないまま画面が固着するのを防ぐ上限 */
const VERIFY_TIMEOUT_MS = 10_000;

/** 4xx のうち再試行で直りうるもの。これ以外の 4xx はトークン側の問題として扱う */
const RETRIABLE_CLIENT_STATUSES = new Set([408, 429]);

/**
 * 保存済みトークンで実際にセッションが使えるかをプロフィール API で確かめる。
 * 「認証が通ったか」をこのエンドポイントのガードから推定しているため、
 * /users/profile が JwtAuthGuard で保護されている限りにおいて成立する。
 */
export const fetchAuthSession = async (): Promise<AuthSessionResult> => {
  // AbortSignal.timeout は Safari 16+ が必要で、Next の既定ターゲット (safari 12) を
  // 外れる。未対応環境では TypeError が下の catch に落ち、検証が常に失敗する
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, VERIFY_TIMEOUT_MS);

  // ボディ読み出しまでタイマーを生かす。ヘッダだけ返して本文を送り終えない
  // サーバでは fetch が resolve した後の json() が永久に pending になる
  try {
    let response: Response;
    try {
      response = await createApiRequest(API_CONFIG.endpoints.userProfile, {
        signal: controller.signal,
      });
    } catch {
      return {
        status: 'unavailable',
        ...(timedOut
          ? { reason: 'timeout' as const }
          : { reason: 'network' as const }),
      };
    }

    // 攫われた応答は 200 でも API の答えではない。通すと無効なトークンで認証済みになる
    if (response.redirected) {
      return { status: 'unavailable', reason: 'intercepted' };
    }

    if (!response.ok) {
      return response.status >= 500 ||
        RETRIABLE_CLIENT_STATUSES.has(response.status)
        ? {
            status: 'unavailable',
            reason: 'server',
            statusCode: response.status,
          }
        : { status: 'unauthenticated' };
    }

    try {
      return { status: 'ok', user: toAuthUser(await response.json()) };
    } catch {
      // 本文が読めなくても 200 を受け取った時点でガードは通っている
      return { status: 'ok', user: undefined };
    }
  } finally {
    clearTimeout(timer);
  }
};

/** 必須項目が欠けていれば undefined を返し、偽のユーザーを作らない */
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

/** 検証結果に対してクライアントが取るべき扱い */
export type AuthDecision =
  | { action: 'accept'; user?: AuthUser }
  /** 恒久的に無効。トークンを破棄する */
  | { action: 'discard' }
  /** 検証できなかった。トークンは残し、理由をユーザーに伝える */
  | { action: 'retain' };

export const decideAuthAction = (result: AuthSessionResult): AuthDecision => {
  if (result.status === 'ok') {
    return { action: 'accept', user: result.user };
  }
  return result.status === 'unauthenticated'
    ? { action: 'discard' }
    : { action: 'retain' };
};
