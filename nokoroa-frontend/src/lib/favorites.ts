import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import {
  FavoriteData,
  FavoritesResponse,
  FavoriteStatsResponse,
  FavoriteStatusResponse,
} from '@/types/post';

export async function addFavorite(postId: number): Promise<FavoriteData> {
  const token = localStorage.getItem('jwt');

  if (!token) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const response = await createApiRequest(
    API_CONFIG.endpoints.favoriteById(postId.toString()),
    { method: 'POST' },
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証が無効です。再度ログインしてください。');
    }
    throw new Error('お気に入りに追加できませんでした');
  }

  return response.json();
}

export async function removeFavorite(
  postId: number,
): Promise<{ message: string }> {
  const token = localStorage.getItem('jwt');

  if (!token) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const response = await createApiRequest(
    API_CONFIG.endpoints.favoriteById(postId.toString()),
    { method: 'DELETE' },
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証が無効です。再度ログインしてください。');
    }
    throw new Error('お気に入りから削除できませんでした');
  }

  return response.json();
}

export async function getFavorites(
  limit: number = 10,
  offset: number = 0,
): Promise<FavoritesResponse> {
  const token = localStorage.getItem('jwt');

  if (!token) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const response = await createApiRequest(
    `${API_CONFIG.endpoints.favorites}?limit=${limit}&offset=${offset}`,
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証が無効です。再度ログインしてください。');
    }
    throw new Error('お気に入り一覧を取得できませんでした');
  }

  return response.json();
}

export async function checkFavoriteStatus(
  postId: number,
): Promise<FavoriteStatusResponse> {
  const token = localStorage.getItem('jwt');

  if (!token) {
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
