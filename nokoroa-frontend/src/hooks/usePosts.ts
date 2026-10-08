import useSWR from 'swr';

import { API_CONFIG, API_FETCH_OPTIONS } from '@/lib/apiConfig';

import { PostsResponse } from '../types/post';

const fetcher = async (url: string): Promise<PostsResponse> => {
  const response = await fetch(url, API_FETCH_OPTIONS);
  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }
  return response.json();
};

interface UsePostsOptions {
  page?: number;
  limit?: number;
}

export const usePosts = ({ page = 0, limit = 10 }: UsePostsOptions = {}) => {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', (page * limit).toString());

  const url = API_CONFIG.buildUrl(
    `${API_CONFIG.endpoints.posts}?${params.toString()}`,
  );

  // keepPreviousData は使わない。未キャッシュのキーに対して前ページの data を
  // 同一参照で返すため「data が何ページ目か」が偽られ、usePaginatedPosts が
  // 未取得ページを取り込み済みと誤認してページを飛ばす (詳細はそちらの data の契約)。
  return useSWR<PostsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
};
