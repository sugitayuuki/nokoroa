import {
  API_CONFIG,
  API_FETCH_OPTIONS,
  createApiRequest,
} from '@/lib/apiConfig';
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

// 認証クッキーは httpOnly でここから読めず、React の外なので useAuth も
// 使えない。未ログインかどうかの判定はサーバーの 401 に委ねている。
export async function followUser(userId: number): Promise<void> {
  const response = await createApiRequest(
    API_CONFIG.endpoints.followUser(userId.toString()),
    { method: 'POST' },
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証が必要です');
    }
    if (response.status === 409) {
      throw new Error('すでにフォローしています');
    }
    throw new Error('フォローに失敗しました');
  }
}

export async function unfollowUser(userId: number): Promise<void> {
  const response = await createApiRequest(
    API_CONFIG.endpoints.followUser(userId.toString()),
    { method: 'DELETE' },
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証が必要です');
    }
    if (response.status === 404) {
      throw new Error('フォロー関係が見つかりません');
    }
    throw new Error('フォロー解除に失敗しました');
  }
}

export async function checkFollowStatus(userId: number): Promise<FollowStatus> {
  // 状態確認は失敗してもUIを壊さない(未ログイン=401 も「未フォロー」扱い)
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
    API_FETCH_OPTIONS,
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
    API_FETCH_OPTIONS,
  );

  if (!response.ok) {
    throw new Error('フォロー中のユーザーの取得に失敗しました');
  }

  return response.json();
}

export async function getFollowStats(userId: number): Promise<FollowStats> {
  const response = await fetch(
    API_CONFIG.buildUrl(API_CONFIG.endpoints.followStats(userId.toString())),
    API_FETCH_OPTIONS,
  );

  if (!response.ok) {
    throw new Error('フォロー統計の取得に失敗しました');
  }

  return response.json();
}
