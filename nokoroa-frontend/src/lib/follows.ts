import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { UserFollowData } from '@/types/user';

export interface FollowStats {
  followersCount: number;
  followingCount: number;
}

export interface FollowStatus {
  isFollowing: boolean;
  followedAt: string | null;
}

export interface FollowListResponse {
  followers?: UserFollowData[];
  following?: UserFollowData[];
  total: number;
  page: number;
  totalPages: number;
}

export async function followUser(userId: number): Promise<void> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  if (!token) {
    throw new Error('認証が必要です');
  }

  const response = await createApiRequest(
    API_CONFIG.endpoints.followUser(userId.toString()),
    { method: 'POST' },
  );

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('すでにフォローしています');
    }
    throw new Error('フォローに失敗しました');
  }
}

export async function unfollowUser(userId: number): Promise<void> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  if (!token) {
    throw new Error('認証が必要です');
  }

  const response = await createApiRequest(
    API_CONFIG.endpoints.followUser(userId.toString()),
    { method: 'DELETE' },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('フォロー関係が見つかりません');
    }
    throw new Error('フォロー解除に失敗しました');
  }
}

export async function checkFollowStatus(userId: number): Promise<FollowStatus> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  if (!token) {
    return { isFollowing: false, followedAt: null };
  }

  const response = await createApiRequest(
    API_CONFIG.endpoints.checkFollow(userId.toString()),
  );

  if (!response.ok) {
    return { isFollowing: false, followedAt: null };
  }

  return response.json();
}

export async function getFollowers(
  userId: number,
  page: number = 1,
  limit: number = 20,
): Promise<FollowListResponse> {
  const response = await fetch(
    API_CONFIG.buildUrl(
      `${API_CONFIG.endpoints.userFollowers(userId.toString())}?page=${page}&limit=${limit}`,
    ),
  );

  if (!response.ok) {
    throw new Error('フォロワーの取得に失敗しました');
  }

  return response.json();
}

export async function getFollowing(
  userId: number,
  page: number = 1,
  limit: number = 20,
): Promise<FollowListResponse> {
  const response = await fetch(
    API_CONFIG.buildUrl(
      `${API_CONFIG.endpoints.userFollowing(userId.toString())}?page=${page}&limit=${limit}`,
    ),
  );

  if (!response.ok) {
    throw new Error('フォロー中のユーザーの取得に失敗しました');
  }

  return response.json();
}

export async function getFollowStats(userId: number): Promise<FollowStats> {
  const response = await fetch(
    API_CONFIG.buildUrl(API_CONFIG.endpoints.followStats(userId.toString())),
  );

  if (!response.ok) {
    throw new Error('フォロー統計の取得に失敗しました');
  }

  return response.json();
}
