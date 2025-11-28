'use client';

import { useState } from 'react';

import { API_CONFIG } from '@/lib/apiConfig';
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

      const token = getToken();
      if (!token) {
        throw new Error('認証が必要です');
      }

      const API_URL = API_CONFIG.BASE_URL;
      const response = await fetch(`${API_URL}/users/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
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
