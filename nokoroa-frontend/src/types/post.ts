export interface CreatePostData {
  title: string;
  content: string;
  imageUrl?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  isPublic?: boolean;
}

export interface PostAuthor {
  id: number;
  name: string;
  // email は含めない。backend の publicAuthorSelect は {id, name, avatar} だけを
  // 返すため、型に書くと「存在するのに undefined」という嘘になる。
  avatar?: string | null;
}

export interface PostCount {
  favorites: number;
}

export interface PostData {
  id: number;
  title: string;
  content: string;
  imageUrl?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  similarity?: number; // 意味検索時のコサイン類似度（0-1）
  _count?: PostCount;
  // 互換性のため一時的に残す
  favoritesCount?: number;
}

export interface PostsResponse {
  posts: PostData[];
  total: number;
  hasMore: boolean;
}

export interface FavoriteData {
  id: number;
  createdAt: string;
  post: PostData;
}

export interface FavoritesResponse {
  favorites: FavoriteData[];
  total: number;
  hasMore: boolean;
}

export interface FavoriteStatusResponse {
  isFavorited: boolean;
}

export interface FavoriteStatsResponse {
  favoritesCount: number;
}
