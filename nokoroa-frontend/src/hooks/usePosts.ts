import useSWR from 'swr';

import { API_CONFIG } from '@/lib/apiConfig';

import { PostsResponse } from '../types/post';

const fetcher = async (url: string): Promise<PostsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }
  return response.json();
};

interface UsePostsOptions {
  page?: number;
  limit?: number;
  authorId?: number;
}

export const usePosts = ({
  page = 0,
  limit = 10,
  authorId,
}: UsePostsOptions = {}) => {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', (page * limit).toString());
  if (authorId) params.append('authorId', authorId.toString());

  const url = API_CONFIG.buildUrl(
    `${API_CONFIG.endpoints.posts}?${params.toString()}`,
  );

  return useSWR<PostsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    // 無限スクロールは page を変えて URL(= SWR キー)を変える。これが無いと
    // 2 ページ目の取得中に data が undefined / isLoading が true になり、
    // 呼び出し側がそれで描画をゲートしているため、usePaginatedPosts が
    // 保持している累積ごと一覧が画面から消えて点滅する。
    // 前ページのデータを保持することで、ページ送り中も一覧が残る。
    keepPreviousData: true,
  });
};
