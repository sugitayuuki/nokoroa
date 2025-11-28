// 共通のユーザー型定義

export interface UserBase {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User extends UserBase {
  bio?: string | null;
  posts?: UserPost[];
  _count?: {
    posts: number;
    followers: number;
    following: number;
  };
}

export interface UserPost {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  location: string | null;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    favorites: number;
  };
  favoritesCount?: number;
}

export interface UserFollowData {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  followedAt?: string;
  _count: {
    posts: number;
    followers: number;
    following: number;
  };
}

export interface UserProfile extends User {
  followersCount: number;
  followingCount: number;
  postsCount: number;
}
