import { useState } from 'react';
import { toast } from 'react-toastify';

import { API_CONFIG } from '@/lib/apiConfig';
import { getToken } from '@/utils/auth';

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

  const updateUser = async (data: UpdateUserData): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('認証が必要です');
      }

      const API_URL = API_CONFIG.BASE_URL;
      const response = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

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
