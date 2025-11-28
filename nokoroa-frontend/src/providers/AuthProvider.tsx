'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { useSmoothNavigation } from '@/hooks/useSmoothNavigation';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { getToken } from '@/utils/auth';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  loading?: boolean; // 互換性のため追加
  user?: { id: number; name: string; email: string; avatar?: string };
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{
    id: number;
    name: string;
    email: string;
    avatar?: string;
  }>();

  const navigation = useSmoothNavigation();

  useEffect(() => {
    const validateToken = async () => {
      const token = getToken();

      if (token) {
        try {
          // トークンの有効性を確認するため、プロフィールAPIを呼び出し
          const response = await createApiRequest(
            API_CONFIG.endpoints.userProfile,
          );

          if (response.ok) {
            const userData = await response.json();
            setIsAuthenticated(true);
            setUser({
              id: userData.id,
              name: userData.name,
              email: userData.email,
              avatar: userData.avatar,
            });
          } else {
            // トークンが無効な場合は削除
            localStorage.removeItem('jwt');
            setIsAuthenticated(false);
            setUser(undefined);
          }
        } catch {
          // トークン検証でエラーが発生した場合の処理
          localStorage.removeItem('jwt');
          setIsAuthenticated(false);
          setUser(undefined);
        }
      } else {
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

      localStorage.setItem('jwt', token);

      // ログイン後、プロフィールAPIを呼び出してユーザー情報を取得
      try {
        const profileResponse = await createApiRequest(
          API_CONFIG.endpoints.userProfile,
        );

        if (profileResponse.ok) {
          const userData = await profileResponse.json();
          setUser({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            avatar: userData.avatar,
          });
        } else {
          // プロフィール取得に失敗した場合はログインレスポンスから設定
          if (result.user) {
            setUser({
              id: result.user.id,
              name: result.user.name,
              email: result.user.email,
              avatar: result.user.avatar,
            });
          } else {
            setUser({ id: 1, name: 'User', email });
          }
        }
      } catch {
        // プロフィール取得でエラーが発生した場合の処理
        // フォールバック
        if (result.user) {
          setUser({
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
          });
        } else {
          setUser({ id: 1, name: 'User', email });
        }
      }

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
    localStorage.removeItem('jwt');
    setIsAuthenticated(false);
    setUser(undefined);

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
        loading: isLoading, // 互換性のため追加
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
