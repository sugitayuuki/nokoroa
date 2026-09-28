import useSWR from 'swr';

import { API_CONFIG } from '@/lib/apiConfig';

import { SearchFilters, SearchResponse } from '../types/search';

export class SearchFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'SearchFetchError';
    this.status = status;
  }
}

const fetcher = async (url: string): Promise<SearchResponse> => {
  const isSemantic = url.includes(API_CONFIG.endpoints.semanticSearch);
  const headers: Record<string, string> = isSemantic
    ? API_CONFIG.getAuthHeaders()
    : {};
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new SearchFetchError(
      response.status,
      `Failed to fetch search results (${response.status})`,
    );
  }
  return response.json();
};

const buildSearchUrl = (filters: SearchFilters): string => {
  const searchParams = new URLSearchParams();

  if (filters.mode === 'semantic') {
    if (filters.q) searchParams.append('q', filters.q);
    if (filters.limit) searchParams.append('limit', filters.limit.toString());
    return API_CONFIG.buildUrl(
      `${API_CONFIG.endpoints.semanticSearch}?${searchParams.toString()}`,
    );
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

  return API_CONFIG.buildUrl(
    `${API_CONFIG.endpoints.search}?${searchParams.toString()}`,
  );
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
