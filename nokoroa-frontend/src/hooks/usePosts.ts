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
  });
};
