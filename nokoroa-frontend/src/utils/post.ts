/**
 * 投稿のブックマーク(お気に入り)件数を取得する。
 *
 * 集計は API の応答によって `_count.favorites` と `favoritesCount` の
 * どちらで届くかが異なる。表示側で毎回読み分けないよう、取得口をここに寄せる。
 */
export const getFavoritesCount = (post: {
  favoritesCount?: number;
  _count?: { favorites: number } | null;
}): number => post.favoritesCount || post._count?.favorites || 0;
