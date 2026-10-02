'use client';

import { useState } from 'react';

import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { useAuth } from '@/providers/AuthProvider';

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UseChangePasswordReturn {
  /**
   * 成功したかを戻り値で返す。
   * success state は次のレンダリングまで更新されないため、
   * 呼び出し直後に参照しても常に古い値になる(フォームリセットが走らない)。
   */
  changePassword: (data: ChangePasswordData) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export function useChangePassword(): UseChangePasswordReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // 認証クッキーは httpOnly で読めないため、ログイン状態は useAuth() で見る
  const { isAuthenticated } = useAuth();

  const changePassword = async (data: ChangePasswordData): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      if (!isAuthenticated) {
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      // パスワード変更でエラーが発生した場合の処理
      return false;
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
