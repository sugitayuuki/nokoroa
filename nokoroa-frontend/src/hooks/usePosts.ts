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

  // keepPreviousData は使わない。新キーが未キャッシュの間、前ページの data を
  // 同一参照で返すため「data が何ページ目のものか」が偽られる。
  // usePaginatedPosts の取り込み effect は [data, page] 依存なので、
  // page だけ進んだ時点で前ページのデータを現ページとして取り込み、
  // lastLoadedPageRef を進めて isLoadingMore を解除してしまう
  // → observer が即再発火してページが 1 つ飛ぶ。
  // ページ送り中に一覧を消さないのは「累積を持つ usePaginatedPosts を正とし、
  // 呼び出し側が SWR のキー単位 isLoading で描画をゲートしない」ことで解決する。
  return useSWR<PostsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
};
