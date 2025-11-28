'use client';

import { useEffect, useState } from 'react';

import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { User } from '@/types/user';
import { getToken } from '@/utils/auth';

interface UseUserReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        // トークンがない場合は、nullをセットして終了
        setUser(null);
        setIsLoading(false);
        return;
      }

      const response = await createApiRequest(API_CONFIG.endpoints.userProfile);

      if (!response.ok) {
        if (response.status === 401) {
          // 401エラーの場合は、ユーザーをnullに設定してエラーは表示しない
          setUser(null);
          return;
        }
        throw new Error('ユーザー情報の取得に失敗しました');
      }

      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      // ユーザー情報の取得でエラーが発生した場合の処理
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return {
    user,
    isLoading,
    error,
    refetch: fetchUser,
  };
}
