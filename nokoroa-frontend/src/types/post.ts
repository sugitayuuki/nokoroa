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

export interface UpdatePostData {
  title?: string;
  content?: string;
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
  email: string;
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
  distance?: number; // 地理的検索時の距離
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
