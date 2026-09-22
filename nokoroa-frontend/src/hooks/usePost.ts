import useSWR from 'swr';

import { API_CONFIG } from '@/lib/apiConfig';

import { PostData } from '../types/post';

// 非公開投稿は投稿者本人だけが取得できるため、認証ヘッダを付けて取得する。
// 素の fetch だと本人が自分の非公開投稿の詳細ページを開けない。
const fetcher = async (endpoint: string): Promise<PostData> => {
  const response = await fetch(API_CONFIG.buildUrl(endpoint), {
    headers: API_CONFIG.getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch post');
  }
  return response.json();
};

export const usePost = (id: number) => {
  const endpoint = id ? API_CONFIG.endpoints.postById(id.toString()) : null;

  return useSWR<PostData>(endpoint, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
};
