import { getToken } from '@/utils/auth';

export const API_CONFIG = {
  BASE_URL:
    (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api',

  endpoints: {
    // 認証関連
    login: '/auth/login',
    signup: '/users/signup',
    googleAuth: '/auth/google',

    // 投稿関連
    posts: '/posts',
    postById: (id: string) => `/posts/${id}`,
    uploadPostImage: '/posts/upload-image',
    postTags: '/posts/tags',

    // ユーザー関連
    userById: (id: string) => `/users/${id}`,
    userProfile: '/users/profile',
    changePassword: '/users/change-password',
    uploadAvatar: '/users/upload-avatar',

    // 検索関連
    search: '/posts/search',
    semanticSearch: '/posts/search/semantic',
    searchByLocation: '/posts/search-by-location',
    // この 2 つはバックエンドに未実装。useSearchSuggestions が 404 を受けて
    // ローカル生成へフォールバックする前提で呼んでいる(意図的な挙動)。
    // 実装するまで入力ごとに 404 が 1 往復する点は認識しておくこと。
    keywordSuggestions: '/posts/suggestions/keywords',
    locationSuggestions: '/posts/suggestions/locations',

    // チャット関連
    chatStream: '/chat/stream',
    chatSuggestions: '/chat/suggestions',

    // ブックマーク関連 (バックエンドのルートは /favorites)
    favorites: '/favorites',
    favoriteById: (postId: string) => `/favorites/${postId}`,
    checkFavorite: (postId: string) => `/favorites/check/${postId}`,
    favoriteStats: (postId: string) => `/favorites/stats/${postId}`,

    // フォロー関連
    followUser: (userId: string) => `/follows/${userId}`,
    checkFollow: (userId: string) => `/follows/check/${userId}`,
    userFollowers: (userId: string) => `/follows/${userId}/followers`,
    userFollowing: (userId: string) => `/follows/${userId}/following`,
    followStats: (userId: string) => `/follows/${userId}/stats`,
  },

  getAuthHeaders: () => {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  getFormDataAuthHeaders: () => {
    const token = getToken();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  buildUrl: (endpoint: string): string => {
    return `${API_CONFIG.BASE_URL}${endpoint}`;
  },
};

export const createApiRequest = async (
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> => {
  const url = API_CONFIG.buildUrl(endpoint);
  const defaultHeaders = API_CONFIG.getAuthHeaders();

  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
};

export const createFormDataRequest = async (
  endpoint: string,
  formData: FormData,
): Promise<Response> => {
  const url = API_CONFIG.buildUrl(endpoint);
  const headers = API_CONFIG.getFormDataAuthHeaders();

  return fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
};
