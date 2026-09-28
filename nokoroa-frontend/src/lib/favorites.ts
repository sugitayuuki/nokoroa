import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import {
  FavoriteData,
  FavoritesResponse,
  FavoriteStatsResponse,
  FavoriteStatusResponse,
} from '@/types/post';
import { getToken } from '@/utils/auth';

/**
 * 認証必須のお気に入り API を叩く共通処理。
 * 未ログイン・401・その他失敗の3系統を各関数で繰り返さないための集約。
 */
async function requestAuthedFavorites(
  endpoint: string,
  failureMessage: string,
  options?: RequestInit,
): Promise<Response> {
  if (!getToken()) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const response = await createApiRequest(endpoint, options);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証が無効です。再度ログインしてください。');
    }
    throw new Error(failureMessage);
  }

  return response;
}

export async function addFavorite(postId: number): Promise<FavoriteData> {
  const response = await requestAuthedFavorites(
    API_CONFIG.endpoints.favoriteById(postId.toString()),
    'お気に入りに追加できませんでした',
    { method: 'POST' },
  );
  return response.json();
}

export async function removeFavorite(
  postId: number,
): Promise<{ message: string }> {
  const response = await requestAuthedFavorites(
    API_CONFIG.endpoints.favoriteById(postId.toString()),
    'お気に入りから削除できませんでした',
    { method: 'DELETE' },
  );
  return response.json();
}

export async function getFavorites(
  limit: number = 10,
  offset: number = 0,
): Promise<FavoritesResponse> {
  const response = await requestAuthedFavorites(
    `${API_CONFIG.endpoints.favorites}?limit=${limit}&offset=${offset}`,
    'お気に入り一覧を取得できませんでした',
  );
  return response.json();
}

export async function checkFavoriteStatus(
  postId: number,
): Promise<FavoriteStatusResponse> {
  // 状態確認は失敗してもUIを壊さない(未ログイン・401・通信失敗は「未お気に入り」扱い)
  if (!getToken()) {
    return { isFavorited: false };
  }

  try {
    const response = await createApiRequest(
      API_CONFIG.endpoints.checkFavorite(postId.toString()),
    );

    if (!response.ok) {
      if (response.status === 401) {
        return { isFavorited: false };
      }
      throw new Error('お気に入り状態を取得できませんでした');
    }

    return response.json();
  } catch {
    return { isFavorited: false };
  }
}

export async function getFavoriteStats(
  postId: number,
): Promise<FavoriteStatsResponse> {
  const response = await fetch(
    API_CONFIG.buildUrl(API_CONFIG.endpoints.favoriteStats(postId.toString())),
  );

  if (!response.ok) {
    throw new Error('お気に入り統計を取得できませんでした');
  }

  return response.json();
}
