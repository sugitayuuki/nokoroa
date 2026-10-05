'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { mutate } from 'swr';

import { useSmoothNavigation } from '@/hooks/useSmoothNavigation';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { hasSessionHint, purgeLegacyStoredToken } from '@/utils/auth';

/**
 * 認証セッションの本人情報。
 * ヘッダー等の「ログイン中は誰か」の表示に使う最小限の項目のみを持つ。
 * bio や投稿数まで含むプロフィール全体が必要な画面は useUser() を使うこと
 * (プロフィール情報の正は API = useUser 側であり、ここはその部分集合)。
 */
type AuthUser = {
  id: number;
  name: string;
  email: string;
  avatar?: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** 意図的なログアウト遷移中。useRequireAuth が /login への割り込みを抑止するために見る */
  isLoggingOut: boolean;
  user?: AuthUser;
  login: (email: string, password: string) => Promise<boolean>;
  /** 認証クッキーはサーバーしか消せないため、ログアウトは非同期になる */
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * API レスポンスから認証ユーザーを組み立てる。
 * 必須項目が欠けている場合は undefined を返し、偽のユーザーを作らない。
 */
const toAuthUser = (raw: unknown): AuthUser | undefined => {
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

type FetchAuthUserResult =
  | { status: 'ok'; user: AuthUser | undefined }
  /** サーバーが「このセッションは無効」と答えた(401 など) */
  | { status: 'unauthenticated' }
  /** セッションの可否を確認できなかった(5xx / 通信失敗) */
  | { status: 'unknown' };

/**
 * セッション API からログイン中のユーザーを取得する。
 * 「認証が無効(非 2xx / 通信失敗)」と「200 だが形が想定外」を区別して返す。
 * 後者を未認証扱いにすると、API 側の一時的な応答形不良だけで
 * 強制ログアウトになるため。
 *
 * 認証クッキーは httpOnly でフロントから読めないので、
 * ログイン状態の判定はこの呼び出しの結果が唯一の手段になる。
 */
const fetchAuthUser = async (): Promise<FetchAuthUserResult> => {
  try {
    const response = await createApiRequest(API_CONFIG.endpoints.me);
    if (response.status === 401 || response.status === 403) {
      return { status: 'unauthenticated' };
    }
    if (!response.ok) {
      // 5xx 等は「未ログイン」ではない。ここを未ログイン扱いにすると、
      // API の一時障害だけで全ユーザーが強制ログアウトになる
      return { status: 'unknown' };
    }
    return { status: 'ok', user: toAuthUser(await response.json()) };
  } catch {
    return { status: 'unknown' };
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<AuthUser>();

  // 戻り値オブジェクトは毎レンダー新しいため、useCallback 済みの push だけを
  // 分解して依存する(オブジェクトごと依存すると下の useMemo が毎回無効化される)
  const { push: navigatePush } = useSmoothNavigation();
  const pathname = usePathname();

  // logout はサーバー往復を挟むため、再開時の pathname は closure の値と
  // 食い違いうる。判定には常に最新を使う。
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  /** logout の実行中。連打で二重に走らせない */
  const isLoggingOutRef = useRef(false);

  // ログアウトの push('/') が完了(パス変化)したらフラグを戻す。
  // 戻し忘れると、ログアウト後に保護ページを直接開いたときのリダイレクトまで抑止してしまう
  useEffect(() => {
    setIsLoggingOut(false);
  }, [pathname]);

  useEffect(() => {
    // 旧実装が localStorage に残した JWT の後片付け。アプリ起動時に 1 回だけ。
    purgeLegacyStoredToken();

    // ログイン中のヒントが無ければサーバーに聞く必要がない。
    // 全訪問者に /auth/me を待たせると、未ログインの初回表示が 1 RTT 遅くなる
    // (Layout は認証が確定するまで中身を描画しない)。
    if (!hasSessionHint()) {
      setIsAuthenticated(false);
      setUser(undefined);
      setIsLoading(false);
      return;
    }

    const restoreSession = async () => {
      // ヒントは JS から書き換えられるため、ここで必ずサーバーに確認する
      const result = await fetchAuthUser();

      if (result.status === 'ok') {
        // 200 なら認証は有効。形が想定外で user が取れなくても認証状態は維持する
        setIsAuthenticated(true);
        setUser(result.user);
      } else if (result.status === 'unknown') {
        // セッションの可否が分からないだけ。ヒントを信じて認証済みのまま進め、
        // 実際に権限が無ければ各 API が 401 を返す
        // (ここで未ログインに倒すと、API の一時障害で全員ログアウトになる)
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUser(undefined);
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const response = await createApiRequest(API_CONFIG.endpoints.login, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          toast.error(
            'ログインに失敗しました。メールアドレスとパスワードを確認してください。',
          );
          return false;
        }

        // トークンはレスポンス本文から読まない。認証クッキー(httpOnly)を
        // ブラウザが保存するので、フロントが触る必要がない。
        // 本文の user は、下の /auth/me が形不良だったときの表示用の控え。
        const result = await response.json();

        // トークン失効などで logout を経ずにユーザーが切り替わる場合があるため、
        // ログイン時にも前のユーザーのキャッシュを破棄する。
        void mutate(() => true, undefined, { revalidate: false });

        // クッキーが実際に保存されたかはフロントから確認できない(httpOnly)。
        // ここでセッションを引き直さないと、クッキーが保存されていない場合に
        // 「ログインできたのに以降ずっと 401」という無言の詰みになる。
        const fetched = await fetchAuthUser();

        // 401/403 だけが「クッキーが効いていない」の証拠。
        // 5xx や通信断でログイン失敗にすると、サーバーは既にクッキーを
        // 発行済みなので「失敗表示なのにリロードするとログイン済み」になる
        if (fetched.status === 'unauthenticated') {
          toast.error(
            'ログイン状態を保存できませんでした。ブラウザのCookie設定をご確認ください。',
          );
          return false;
        }

        // /auth/me が使えない(5xx / 通信断)場合と、200 でも形が想定外の場合は、
        // ログインレスポンスの user を使う。どちらも使えなければ undefined のまま
        // (偽のユーザーを置くと、他人の名前でログインしたように見えてしまう)
        setUser(
          (fetched.status === 'ok' ? fetched.user : undefined) ??
            toAuthUser(result.user),
        );

        setIsAuthenticated(true);
        toast.success('ログインしました');
        return true;
      } catch {
        // ログインでエラーが発生した場合の処理
        toast.error(
          'ログインに失敗しました。ネットワーク接続を確認してください。',
        );
        return false;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    // 連打で POST とトーストと遷移が二重に走るのを防ぐ
    if (isLoggingOutRef.current) {
      return;
    }
    isLoggingOutRef.current = true;

    // 認証クッキーは httpOnly なのでフロントからは消せない。サーバーに
    // 消してもらうまで**待ってから**状態を落とす。待たずに画面を切り替えると、
    // リロードでログイン状態に戻ってしまう。
    //
    // この往復の「前」に isLoggingOut を立ててはいけない。往復中にユーザーが
    // 別ページへ移動すると、pathname 変化の effect がフラグを false に戻し、
    // 直後の setIsAuthenticated(false) で useRequireAuth の
    // replace('/login') が navigatePush('/') に勝ってしまう
    // (「ログアウトしたのにログイン画面へ着地する」= このフラグが防ぐはずの不具合)。
    let serverCleared = true;
    try {
      const response = await createApiRequest(API_CONFIG.endpoints.logout, {
        method: 'POST',
      });
      serverCleared = response.ok;
    } catch {
      // ネットワーク断でもローカルの状態は落とす(クッキーは有効期限で切れる)
      serverCleared = false;
    }

    // 認証状態を落とすと保護ページのガードが /login へ replace しようとするため、
    // 「意図的なログアウト」であることを先に立てて push('/') を勝たせる。
    // すでに '/' に居る場合は push が遷移しない=パス変化のリセットが走らないため、
    // フラグ自体を立てない(保護ページ上ではないのでガード抑止も不要)。
    // pathname は ref から読む: 往復中に遷移していると closure の値は古い。
    if (pathnameRef.current !== '/') {
      setIsLoggingOut(true);
    }

    setIsAuthenticated(false);
    setUser(undefined);
    isLoggingOutRef.current = false;

    // SWRのキャッシュはモジュールスコープで保持され、SPA遷移では破棄されない。
    // 認証済みで取得した内容(自分の非公開投稿など)が、同じ端末で次に
    // ログインした別ユーザーに一瞬描画されるのを防ぐ。
    void mutate(() => true, undefined, { revalidate: false });

    // 即座にホームページにリダイレクト
    navigatePush('/');

    // トーストは少し遅らせて表示
    setTimeout(() => {
      if (serverCleared) {
        toast.info('ログアウトしました');
      } else {
        // クッキーが残っている可能性がある。共用端末では致命的なので黙らせない
        toast.warn(
          'ログアウトしましたが、サーバー側の解除を確認できませんでした。共用の端末ではブラウザを閉じてください。',
        );
      }
    }, 100);
  }, [navigatePush]);

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<boolean> => {
      try {
        const response = await createApiRequest(API_CONFIG.endpoints.signup, {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });

        if (!response.ok) {
          toast.error(
            'アカウント作成に失敗しました。入力内容を確認してください。',
          );
          return false;
        }

        // 新規登録成功後、自動的にログイン
        const loginSuccess = await login(email, password);
        if (loginSuccess) {
          toast.success('アカウントを作成しました！');
          return true;
        }
        return false;
      } catch {
        toast.error(
          'アカウント作成に失敗しました。ネットワーク接続を確認してください。',
        );
        return false;
      }
    },
    [login],
  );

  // usePathname の追加で AuthProvider は全ルート遷移ごとに再レンダーされる。
  // value をメモ化しないと参照が毎回変わり、useAuth() の全消費者が
  // 遷移のたびに再レンダーされてしまう
  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      isLoggingOut,
      user,
      login,
      logout,
      register,
    }),
    [isAuthenticated, isLoading, isLoggingOut, user, login, logout, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
