import useSWR from 'swr';

import { API_CONFIG } from '@/lib/apiConfig';

import { SearchFilters, SearchResponse } from '../types/search';

const API_BASE_URL = API_CONFIG.BASE_URL || 'http://localhost:4000';

const fetcher = async (url: string): Promise<SearchResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch search results');
  }
  return response.json();
};

const buildSearchUrl = (filters: SearchFilters): string => {
  const searchParams = new URLSearchParams();

  if (filters.mode === 'semantic') {
    if (filters.q) searchParams.append('q', filters.q);
    if (filters.limit) searchParams.append('limit', filters.limit.toString());
    return `${API_BASE_URL}/posts/search/semantic?${searchParams.toString()}`;
  }

  if (filters.q) searchParams.append('q', filters.q);
  if (filters.tags && filters.tags.length > 0) {
    searchParams.append('tags', filters.tags.join(','));
  }
  if (filters.location) searchParams.append('location', filters.location);
  if (filters.authorId)
    searchParams.append('authorId', filters.authorId.toString());
  if (filters.limit) searchParams.append('limit', filters.limit.toString());
  if (filters.offset) searchParams.append('offset', filters.offset.toString());

  return `${API_BASE_URL}/posts/search?${searchParams.toString()}`;
};

export const useSearchPosts = (
  filters: SearchFilters,
  shouldFetch: boolean = true,
) => {
  const isSemanticWithoutQuery =
    filters.mode === 'semantic' && !filters.q?.trim();
  const url =
    shouldFetch && !isSemanticWithoutQuery ? buildSearchUrl(filters) : null;

  return useSWR<SearchResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
};
