'use client';

import { useState } from 'react';

import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { getToken } from '@/utils/auth';

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UseChangePasswordReturn {
  changePassword: (data: ChangePasswordData) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export function useChangePassword(): UseChangePasswordReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const changePassword = async (data: ChangePasswordData) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      if (!getToken()) {
        throw new Error('認証が必要です');
      }

      const response = await createApiRequest(
        API_CONFIG.endpoints.changePassword,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'パスワード変更に失敗しました');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      // パスワード変更でエラーが発生した場合の処理
    } finally {
      setIsLoading(false);
    }
  };

  return {
    changePassword,
    isLoading,
    error,
    success,
  };
}
