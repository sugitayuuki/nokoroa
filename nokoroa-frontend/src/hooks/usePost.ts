import useSWR from 'swr';

import { API_CONFIG } from '@/lib/apiConfig';

import { PostData } from '../types/post';

const fetcher = async (url: string): Promise<PostData> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch post');
  }
  return response.json();
};

export const usePost = (id: number) => {
  const url = id
    ? API_CONFIG.buildUrl(API_CONFIG.endpoints.postById(id.toString()))
    : null;

  return useSWR<PostData>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
};
