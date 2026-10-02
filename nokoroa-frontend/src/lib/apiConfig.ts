export const API_CONFIG = {
  BASE_URL:
    (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api',

  endpoints: {
    // 認証関連
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    signup: '/users/signup',
    googleAuth: '/auth/google',

    // 投稿関連
    posts: '/posts',
    postById: (id: string) => `/posts/${id}`,
    uploadPostImage: '/posts/upload-image',
    postTags: '/posts/tags',

    // ユーザー関連
    users: '/users',
    userById: (id: string) => `/users/${id}`,
    userProfile: '/users/profile',
    changePassword: '/users/change-password',
    uploadAvatar: '/users/upload-avatar',
    follow: (userId: string) => `/users/${userId}/follow`,
    unfollow: (userId: string) => `/users/${userId}/unfollow`,
    followers: (userId: string) => `/users/${userId}/followers`,
    following: (userId: string) => `/users/${userId}/following`,

    // ブックマーク関連
    bookmarks: '/bookmarks',
    bookmarkPost: (postId: string) => `/bookmarks/${postId}`,

    // 検索関連
    search: '/posts/search',
    semanticSearch: '/posts/search/semantic',
    searchByLocation: '/posts/search-by-location',
    keywordSuggestions: '/posts/suggestions/keywords',
    locationSuggestions: '/posts/suggestions/locations',

    // チャット関連
    chatStream: '/chat/stream',
    chatSuggestions: '/chat/suggestions',

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

  buildUrl: (endpoint: string): string => {
    return `${API_CONFIG.BASE_URL}${endpoint}`;
  },
};

/**
 * 自社 API へのリクエストに必ず付ける設定。
 *
 * 認証は httpOnly クッキー(nokoroa_token)で行うため、credentials: 'include' が
 * 無いと**未ログイン扱いになる**。フロントからはクッキーを読めないので、
 * 付け忘れは「認証ヘッダが無い」のような分かりやすい形では現れず、
 * 401 や「公開データしか返らない」として出る。
 *
 * 自社 API を叩く fetch は、createApiRequest を通すか、この値を展開すること。
 */
export const API_FETCH_OPTIONS = {
  credentials: 'include',
} as const satisfies RequestInit;

export const createApiRequest = async (
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> => {
  const url = API_CONFIG.buildUrl(endpoint);

  return fetch(url, {
    ...API_FETCH_OPTIONS,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
};

export const createFormDataRequest = async (
  endpoint: string,
  formData: FormData,
): Promise<Response> => {
  const url = API_CONFIG.buildUrl(endpoint);

  // Content-Type は指定しない。指定すると multipart の boundary が壊れる
  return fetch(url, {
    ...API_FETCH_OPTIONS,
    method: 'POST',
    body: formData,
  });
};
