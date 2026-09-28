'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { mutate } from 'swr';

import { useSmoothNavigation } from '@/hooks/useSmoothNavigation';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { getToken, removeToken, setToken } from '@/utils/auth';

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
  logout: () => void;
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
  | { status: 'invalid' };

/**
 * プロフィール API からユーザー情報を取得する。
 * 「認証が無効(非 2xx / 通信失敗)」と「200 だが形が想定外」を区別して返す。
 * 後者でトークンを消すと、API 側の一時的な応答形不良だけで強制ログアウトになるため。
 */
const fetchAuthUser = async (): Promise<FetchAuthUserResult> => {
  try {
    const response = await createApiRequest(API_CONFIG.endpoints.userProfile);
    if (!response.ok) {
      return { status: 'invalid' };
    }
    return { status: 'ok', user: toAuthUser(await response.json()) };
  } catch {
    return { status: 'invalid' };
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<AuthUser>();

  const navigation = useSmoothNavigation();
  const pathname = usePathname();

  // ログアウトの push('/') が完了(パス変化)したらフラグを戻す。
  // 戻し忘れると、ログアウト後に保護ページを直接開いたときのリダイレクトまで抑止してしまう
  useEffect(() => {
    setIsLoggingOut(false);
  }, [pathname]);

  useEffect(() => {
    const validateToken = async () => {
      if (!getToken()) {
        setIsAuthenticated(false);
        setUser(undefined);
        setIsLoading(false);
        return;
      }

      // トークンの有効性を確認するため、プロフィールAPIを呼び出し
      const result = await fetchAuthUser();

      if (result.status === 'ok') {
        // 200 なら認証は有効。形が想定外で user が取れなくても認証状態は維持する
        setIsAuthenticated(true);
        setUser(result.user);
      } else {
        // トークンが無効な場合は削除
        removeToken();
        setIsAuthenticated(false);
        setUser(undefined);
      }
      setIsLoading(false);
    };

    validateToken();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
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

      // ログイン後、プロフィールAPIを呼び出してユーザー情報を取得。
      // 取得できなければログインレスポンスの user を使い、それも無ければ undefined のままにする。
      // (取得失敗時に偽のユーザーを置くと、他人の名前でログインしたように見えてしまう)
      const fetched = await fetchAuthUser();
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
  };

  const logout = () => {
    // 認証状態を落とすと保護ページのガードが /login へ replace しようとするため、
    // 「意図的なログアウト」であることを先に立てて push('/') を勝たせる
    // (旧実装は全遷移に入っていた 100ms 遅延のおかげで偶然 '/' が勝っていた)
    setIsLoggingOut(true);
    removeToken();
    setIsAuthenticated(false);
    setUser(undefined);

    // SWRのキャッシュはモジュールスコープで保持され、SPA遷移では破棄されない。
    // 認証済みで取得した内容(自分の非公開投稿など)が、同じ端末で次に
    // ログインした別ユーザーに一瞬描画されるのを防ぐ。
    void mutate(() => true, undefined, { revalidate: false });

    // 即座にホームページにリダイレクト
    navigation.push('/');

    // トーストは少し遅らせて表示
    setTimeout(() => {
      toast.info('ログアウトしました');
    }, 100);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
  ): Promise<boolean> => {
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
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isLoggingOut,
        user,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
