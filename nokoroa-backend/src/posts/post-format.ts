import { Prisma } from '@prisma/client';
import { publicAuthorSelect } from '../common/public-author.select';

/** 投稿を API 形式に整形するために必要な関連。posts / favorites で共有する */
export const postInclude = {
  author: {
    select: publicAuthorSelect,
  },
  location: true,
  postTags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.PostInclude;

// 手書きすると schema.prisma の変更に追随できず、実体と食い違ったまま
// キャストで通ってしまう。include から導出して常に一致させる。
export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

export function formatPost(post: PostWithRelations) {
  return {
    ...post,
    tags: post.postTags.map((pt) => pt.tag.name),
    // ?? を使う。|| だと緯度0(赤道)・経度0(本初子午線)・空文字が null に潰れる
    location: post.location?.name ?? null,
    latitude: post.location?.latitude ?? null,
    longitude: post.location?.longitude ?? null,
    prefecture: post.location?.prefecture ?? null,
  };
}

/** 投稿 API が外部に返す形。呼び出し側が再定義せずに済むよう公開する */
export type FormattedPost = ReturnType<typeof formatPost>;

/** ブックマーク数も要る呼び出し(favorites)向けの include */
export const postWithFavoritesCountInclude = {
  ...postInclude,
  _count: {
    select: { bookmarks: true },
  },
} satisfies Prisma.PostInclude;

export type PostWithFavoritesCount = Prisma.PostGetPayload<{
  include: typeof postWithFavoritesCountInclude;
}>;

/**
 * formatPost と同じ形に favoritesCount を足して返す。
 * _count は集計の内部表現なので、そのまま外へは出さない。
 */
export function formatPostWithFavoritesCount(post: PostWithFavoritesCount) {
  const { _count, ...rest } = post;
  return {
    ...formatPost(rest),
    favoritesCount: _count.bookmarks,
  };
}
