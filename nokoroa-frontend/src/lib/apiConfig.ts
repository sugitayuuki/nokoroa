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
    userPosts: (userId: string) => `/users/${userId}/posts`,

    // ユーザー関連
    users: '/users',
    userById: (id: string) => `/users/${id}`,
    userProfile: '/users/profile',
    follow: (userId: string) => `/users/${userId}/follow`,
    unfollow: (userId: string) => `/users/${userId}/unfollow`,
    followers: (userId: string) => `/users/${userId}/followers`,
    following: (userId: string) => `/users/${userId}/following`,

    // ブックマーク関連
    bookmarks: '/bookmarks',
    bookmarkPost: (postId: string) => `/bookmarks/${postId}`,

    // 検索関連
    search: '/posts/search',

    // アップロード関連
    upload: '/upload',

    // いいね関連
    favoritePost: (postId: string) => `/posts/${postId}/favorite`,
    favorites: '/favorites',
    favoriteById: (postId: string) => `/favorites/${postId}`,
    checkFavorite: (postId: string) => `/favorites/check/${postId}`,
    favoriteStats: (postId: string) => `/favorites/stats/${postId}`,

    // フォロー関連
    follows: '/follows',
    followUser: (userId: string) => `/follows/${userId}`,
    checkFollow: (userId: string) => `/follows/check/${userId}`,
    userFollowers: (userId: string) => `/follows/${userId}/followers`,
    userFollowing: (userId: string) => `/follows/${userId}/following`,
    followStats: (userId: string) => `/follows/${userId}/stats`,
  },

  getAuthHeaders: () => {
    const token = localStorage.getItem('jwt');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  getFormDataAuthHeaders: () => {
    const token = localStorage.getItem('jwt');
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
