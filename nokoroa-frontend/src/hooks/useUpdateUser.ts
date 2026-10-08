import { useState } from 'react';
import { toast } from 'react-toastify';

import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { useAuth } from '@/providers/AuthProvider';

interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  bio?: string;
  avatarUrl?: string;
}

interface UseUpdateUserReturn {
  updateUser: (data: UpdateUserData) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export function useUpdateUser(): UseUpdateUserReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 認証クッキーは httpOnly で読めないため、ログイン状態は useAuth() で見る
  const { isAuthenticated } = useAuth();

  const updateUser = async (data: UpdateUserData): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated) {
        throw new Error('認証が必要です');
      }

      const response = await createApiRequest(
        API_CONFIG.endpoints.userProfile,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 'プロフィールの更新に失敗しました',
        );
      }

      toast.success('プロフィールが更新されました');
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateUser,
    isLoading,
    error,
  };
}
