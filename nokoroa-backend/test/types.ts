export interface SignupResponse {
  message: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  bio?: string;
  avatar?: string;
}

export interface PostResponse {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  location?: string;
  tags?: string[];
  author: {
    id: number;
    name: string;
    email: string;
  };
}

export interface PostsListResponse {
  posts: PostResponse[];
  total: number;
  hasMore: boolean;
}

export interface FavoriteResponse {
  success: boolean;
}

export interface FavoriteCheckResponse {
  isFavorited: boolean;
}

export interface FavoritesListResponse {
  favorites: PostResponse[];
  total: number;
}

export interface FollowResponse {
  success: boolean;
}

export interface FollowCheckResponse {
  isFollowing: boolean;
}

export interface FollowersResponse {
  followers: UserProfile[];
  total: number;
}

export interface FollowingResponse {
  following: UserProfile[];
  total: number;
}

export interface FollowStatsResponse {
  followersCount: number;
  followingCount: number;
}
