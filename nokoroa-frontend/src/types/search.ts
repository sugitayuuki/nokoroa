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

export interface SearchResponse {
  posts: PostData[];
  total: number;
  hasMore: boolean;
  aiAvailable?: boolean;
  /**
   * 意味検索で、類似度の下限を超える投稿が 1 件も無かったことを示す。
   * この場合 posts は 0 件ではなく上位数件が入るので、
   * 「関連が薄い」と断ったうえで見せる必要がある。
   */
  lowRelevance?: boolean;
}
