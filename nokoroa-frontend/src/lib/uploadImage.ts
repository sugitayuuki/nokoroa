import { API_CONFIG, createFormDataRequest } from '@/lib/apiConfig';
import { getToken } from '@/utils/auth';

/**
 * 投稿画像をアップロードして公開 URL を返す。
 * 新規投稿・投稿編集の双方がここを通る唯一の経路。
 *
 * 失敗時は throw する(呼び出し側がフォーム上のエラー表示を担当する)。
 */
export const uploadPostImage = async (file: File): Promise<string> => {
  // 送信前に弾いた方が、401 を往復するより原因が伝わりやすい
  if (!getToken()) {
    throw new Error('認証トークンが見つかりません');
  }

  const formData = new FormData();
  formData.append('image', file);

  const response = await createFormDataRequest(
    API_CONFIG.endpoints.uploadPostImage,
    formData,
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証が必要です。再度ログインしてください。');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || '画像のアップロードに失敗しました');
  }

  const result = await response.json();
  return result.url as string;
};
