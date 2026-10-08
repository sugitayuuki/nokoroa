import {
  API_CONFIG,
  API_FETCH_OPTIONS,
  createApiRequest,
} from '@/lib/apiConfig';
import {
  FavoriteData,
  FavoritesResponse,
  FavoriteStatsResponse,
  FavoriteStatusResponse,
} from '@/types/post';

/**
 * 認証必須のお気に入り API を叩く共通処理。
 * 401・その他失敗の2系統を各関数で繰り返さないための集約。
 *
 * 認証クッキーは httpOnly でここから読めず、React の外なので useAuth も
 * 使えない。よって未ログインかどうかの判定はサーバーの 401 に委ねている。
 */
async function requestAuthedFavorites(
  endpoint: string,
  failureMessage: string,
  options?: RequestInit,
): Promise<Response> {
  const response = await createApiRequest(endpoint, options);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証が必要です。再度ログインしてください。');
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
  // 状態確認は失敗してもUIを壊さない(未ログイン=401・通信失敗は「未お気に入り」扱い)
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
    API_FETCH_OPTIONS,
  );

  if (!response.ok) {
    throw new Error('お気に入り統計を取得できませんでした');
  }

  return response.json();
}
