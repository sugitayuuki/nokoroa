import useSWR from 'swr';

import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';

import { PostData } from '../types/post';

// 非公開投稿は投稿者本人だけが取得できるため、認証クッキーを送って取得する。
// credentials を付けない fetch だと本人が自分の非公開投稿の詳細ページを開けない。
const fetcher = async (endpoint: string): Promise<PostData> => {
  const response = await createApiRequest(endpoint);
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
