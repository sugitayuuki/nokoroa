/**
 * 投稿に紐づく「投稿者」として外部に返してよいフィールド。
 *
 * 投稿系エンドポイントは未認証でも閲覧できるため、email などの個人情報は含めない。
 * 各サービスが同じ include を個別に書くと片方だけ修正が漏れるので、ここに集約する。
 */
export const publicAuthorSelect = {
  id: true,
  name: true,
  avatar: true,
} as const;
