'use client';

import useSWR from 'swr';

import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { useAuth } from '@/providers/AuthProvider';
import { User } from '@/types/user';

interface UseUserReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// 401 は「未ログイン」であってエラーではないため null を返し、
// それ以外の失敗のみ throw して呼び出し側に error として見せる。
const fetcher = async (endpoint: string): Promise<User | null> => {
  const response = await createApiRequest(endpoint);

  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error('ユーザー情報の取得に失敗しました');
  }
  return response.json();
};

/**
 * ログイン中ユーザーのプロフィール全体(bio / 投稿数 / フォロー数を含む)の情報源。
 * SWR キャッシュを共有するため、複数コンポーネントから呼んでも通信は 1 回にまとまる。
 *
 * AuthProvider の user は「認証セッションの本人表示」用の部分集合であり、
 * プロフィール項目が必要な画面はこちらを使うこと。
 */
export function useUser(): UseUserReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // 認証判定が終わって認証済みになるまでは取得しない(未ログインなら user は null)
  const { data, error, isLoading, mutate } = useSWR<User | null>(
    isAuthenticated ? API_CONFIG.endpoints.userProfile : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    },
  );

  return {
    user: data ?? null,
    isLoading: isAuthLoading || isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: () => {
      void mutate();
    },
  };
}
