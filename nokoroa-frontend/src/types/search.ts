import { PostData } from './post';

export type SearchMode = 'keyword' | 'semantic';

export interface SearchFilters {
  q?: string;
  tags?: string[];
  location?: string;
  authorId?: number;
  limit?: number;
  offset?: number;
  mode?: SearchMode;
}

export type Post = PostData;

export interface SearchResponse {
  posts: Post[];
  total: number;
  hasMore: boolean;
  aiAvailable?: boolean;
}
