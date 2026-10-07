'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { mutate } from 'swr';

import { useSmoothNavigation } from '@/hooks/useSmoothNavigation';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import {
  AuthUser,
  decideAuthAction,
  fetchAuthSession,
  toAuthUser,
} from '@/lib/authSession';
import { getToken, removeToken, setToken } from '@/utils/auth';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** 意図的なログアウト遷移中。useRequireAuth が /login への割り込みを抑止するために見る */
  isLoggingOut: boolean;
  user?: AuthUser;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<AuthUser>();

  // 戻り値オブジェクトは毎レンダー新しいため、useCallback 済みの push だけを
  // 分解して依存する(オブジェクトごと依存すると下の useMemo が毎回無効化される)
  const { push: navigatePush } = useSmoothNavigation();
  const pathname = usePathname();

  // ログアウトの push('/') が完了(パス変化)したらフラグを戻す。
  // 戻し忘れると、ログアウト後に保護ページを直接開いたときのリダイレクトまで抑止してしまう
  useEffect(() => {
    setIsLoggingOut(false);
  }, [pathname]);

  useEffect(() => {
    const validateToken = async () => {
      const tokenAtStart = getToken();
      if (!tokenAtStart) {
        setIsAuthenticated(false);
        setUser(undefined);
        return;
      }

      const result = await fetchAuthSession();

      // 検証中に別のトークンへ差し替わっていたら、この結果は古いトークンに対する
      // 判定なので適用しない。OAuth コールバックと同時に走ると、古いトークンの
      // 401 が保存直後の新しいトークンを消してしまう
      if (getToken() !== tokenAtStart) {
        return;
      }

      const decision = decideAuthAction(result);
      if (decision.action === 'discard') {
        removeToken();
      }
      setIsAuthenticated(decision.action === 'accept');
      setUser(decision.action === 'accept' ? decision.user : undefined);
      if (decision.action === 'retain') {
        // 黙って未ログインにすると、ユーザーには理由のない強制ログアウトに見える
        toast.error(
          'ログイン状態を確認できませんでした。時間をおいて再読み込みしてください。',
        );
      }
    };

    // localStorage が使えない端末では getToken が throw する。放置すると
    // isLoading が下りず、保護ページが永久にスピナーのまま残る
    void validateToken()
      .catch(() => {
        setIsAuthenticated(false);
        setUser(undefined);
      })
      .finally(() => setIsLoading(false));
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

        const result = await response.json();

        // access_token または token のいずれかを使用
        const token = result.access_token || result.token;
        if (!token) {
          toast.error('認証トークンが取得できませんでした。');
          return false;
        }

        // トークン失効などで logout を経ずにユーザーが切り替わる場合があるため、
        // ログイン時にも前のユーザーのキャッシュを破棄する。
        void mutate(() => true, undefined, { revalidate: false });

        setToken(token);

        // 発行されたトークンが実際に使えるかを確かめる。ここを省くと、
        // 自分のガードに拒否されるトークンでも成功を名乗り、次の読み込みで
        // 理由なくログアウトされる
        const fetched = await fetchAuthSession();
        if (fetched.status === 'unauthenticated') {
          removeToken();
          toast.error(
            'ログインできませんでした。お手数ですがもう一度お試しください。',
          );
          return false;
        }

        // 取得できなければログインレスポンスの user を使い、それも無ければ undefined のままにする。
        // (取得失敗時に偽のユーザーを置くと、他人の名前でログインしたように見えてしまう)
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

  const logout = useCallback(() => {
    // 認証状態を落とすと保護ページのガードが /login へ replace しようとするため、
    // 「意図的なログアウト」であることを先に立てて push('/') を勝たせる
    // (旧実装は全遷移に入っていた 100ms 遅延のおかげで偶然 '/' が勝っていた)。
    // すでに '/' に居る場合は push が遷移しない=パス変化のリセットが走らないため、
    // フラグ自体を立てない(保護ページ上ではないのでガード抑止も不要)
    if (pathname !== '/') {
      setIsLoggingOut(true);
    }
    removeToken();
    setIsAuthenticated(false);
    setUser(undefined);

    // SWRのキャッシュはモジュールスコープで保持され、SPA遷移では破棄されない。
    // 認証済みで取得した内容(自分の非公開投稿など)が、同じ端末で次に
    // ログインした別ユーザーに一瞬描画されるのを防ぐ。
    void mutate(() => true, undefined, { revalidate: false });

    // 即座にホームページにリダイレクト
    navigatePush('/');

    // トーストは少し遅らせて表示
    setTimeout(() => {
      toast.info('ログアウトしました');
    }, 100);
  }, [pathname, navigatePush]);

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
