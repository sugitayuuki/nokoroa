'use client';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

import BookmarkButton from '@/components/bookmarks/BookmarkButton';
import { LazyImage } from '@/components/common/LazyImage';
import { formatDistanceToNow } from '@/utils/dateFormat';
import { getFavoritesCount } from '@/utils/post';
import { getTagColor } from '@/utils/tagColors';

/**
 * PostCard が描画に必要とする投稿の最小形。
 * 一覧・検索・ブックマークが扱う PostData と、プロフィール API が返す
 * 投稿行 (author や集計を含まない) の双方を受け取れるよう、
 * feed 変種でしか使わない項目は任意にしている。
 */
export interface PostCardData {
  id: number;
  title: string;
  content: string;
  imageUrl?: string | null;
  location?: string | null;
  tags?: string[];
  createdAt?: string;
  /** 意味検索時のみ付与されるコサイン類似度 (0-1) */
  similarity?: number;
  favoritesCount?: number;
  _count?: { favorites: number };
  author?: { name?: string; avatar?: string | null };
}

/**
 * feed: 投稿一覧・検索結果・ブックマーク一覧。280px 画像 / 投稿日時 /
 *       投稿者 / ブックマークボタンを持つ標準カード。
 * owner: 自分の投稿一覧 (所有者向け)。feed をモバイル幅に合わせたうえで、
 *       badge (公開状態) と actions (編集・削除・公開設定) のスロットを受ける。
 * map: 地図ページの周辺投稿。200px 画像・タグ 2 件・1 行タイトルの密なカード。
 *       クリックで詳細ダイアログを開くためリンクにはしない (onClick を渡す)。
 * compact: ユーザープロフィールの投稿タブ。240px 画像・タグ 3 件までで、
 *       author と集計を返さない API に合わせてフッターを持たない。
 */
export type PostCardVariant = 'feed' | 'owner' | 'map' | 'compact';

/** compact 以外の 3 変種は同一のカード構造を共有し、ここの設定値だけが異なる */
type StandardVariant = Exclude<PostCardVariant, 'compact'>;

interface StandardVariantConfig {
  /** カード幅の制約。map は親グリッドの列幅に従うため指定しない */
  width: {
    minWidth?: number | { xs: string; sm: number };
    maxWidth?: number | { xs: string; sm: number };
    mx?: 'auto';
  };
  imageHeight: number | { xs: number; sm: number };
  /** タイトルを 1 行で省略表示するか */
  titleNoWrap: boolean;
  /** 投稿日時の下マージン */
  dateMarginBottom: number;
  /** 本文の表示行数 */
  contentLines: number;
  /** 表示するタグ数の上限。未指定なら全件 */
  tagLimit?: number;
  /** タグチップからタグ検索へ遷移させるか */
  interactiveTags: boolean;
  avatarSize: number;
}

const STANDARD_VARIANTS: Record<StandardVariant, StandardVariantConfig> = {
  feed: {
    width: { minWidth: 320, maxWidth: 400, mx: 'auto' },
    imageHeight: 280,
    titleNoWrap: false,
    dateMarginBottom: 2,
    contentLines: 3,
    interactiveTags: true,
    avatarSize: 32,
  },
  owner: {
    width: {
      minWidth: { xs: '100%', sm: 320 },
      maxWidth: { xs: '100%', sm: 400 },
      mx: 'auto',
    },
    imageHeight: { xs: 200, sm: 280 },
    titleNoWrap: false,
    dateMarginBottom: 2,
    contentLines: 3,
    interactiveTags: true,
    avatarSize: 32,
  },
  map: {
    width: {},
    imageHeight: 200,
    titleNoWrap: true,
    dateMarginBottom: 1,
    contentLines: 2,
    tagLimit: 2,
    interactiveTags: false,
    avatarSize: 24,
  },
};

interface PostCardProps {
  post: PostCardData;
  variant?: PostCardVariant;
  /**
   * 親が既にブックマーク状態を知っている場合に渡す。
   * 渡すとカード毎のブックマーク状態問い合わせを省略できる。
   * feed / owner 変種でのみ有効(compact はブックマークボタンを持たない)。
   */
  isBookmarked?: boolean;
  /** 画像左上に重ねる要素 (owner: 公開/非公開アイコン) */
  badge?: ReactNode;
  /** 画像右上に重ねる操作群 (owner: 編集/削除/公開設定) */
  actions?: ReactNode;
  /** フッター右端の要素。既定はブックマークボタン (map: 公開/非公開アイコン) */
  footerAction?: ReactNode;
  /** 渡すとカードはリンクではなくクリック可能な Card になる (map: 詳細ダイアログ) */
  onClick?: () => void;
}

/** compact 変種でチップ表示するタグの上限。超過分は「+N」でまとめる */
const COMPACT_TAG_LIMIT = 3;

const cardHoverSx = {
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
  },
} as const;

const overlaySx = {
  position: 'absolute',
  top: 8,
  zIndex: 2,
  bgcolor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: 1,
  p: 0.5,
} as const;

const tagChipSx = (tag: string, interactive: boolean) => ({
  backgroundColor: getTagColor(tag),
  color: '#fff',
  fontWeight: 500,
  cursor: interactive ? 'pointer' : 'default',
  ...(interactive
    ? {
        '&:hover': {
          backgroundColor: getTagColor(tag),
          filter: 'brightness(0.9)',
        },
      }
    : {}),
});

const formatTagLabel = (tag: string) => (tag.startsWith('#') ? tag : `#${tag}`);

export default function PostCard({
  post,
  variant = 'feed',
  isBookmarked,
  badge,
  actions,
  footerAction,
  onClick,
}: PostCardProps) {
  const router = useRouter();
  const tags = post.tags || [];

  // カード全体が <a> なので、タグは既定の遷移を止めてタグ検索へ送る
  const handleTagClick = (tag: string) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/search?tags=${encodeURIComponent(tag)}`);
  };

  // カード内に置いた要素のクリックを、カードのリンク遷移 (や onClick) から切り離す。
  // カード全体が <a> のため、stopPropagation だけではブラウザ既定の
  // リンク遷移が走ってしまうので preventDefault も必要。
  const stopCardActivation = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 表示専用チップ。カードのリンク遷移を発火させない。
  // clickable={false} を明示すると MUI は素の div(role/tabIndex なし)で描画するため、
  // 押しても何も起きない要素がフォーカス順・読み上げ対象に入らない
  const staticChipProps = {
    onClick: stopCardActivation,
    clickable: false,
  } as const;

  if (variant === 'compact') {
    return (
      <Card
        component={Link}
        href={`/posts/${post.id}`}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          overflow: 'hidden',
          textDecoration: 'none',
          color: 'inherit',
          cursor: 'pointer',
          ...cardHoverSx,
        }}
      >
        {post.imageUrl ? (
          <Box
            component="img"
            src={post.imageUrl}
            alt={post.title}
            sx={{
              height: 240,
              width: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              height: 240,
              background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="h2"
              sx={{
                color: 'white',
                opacity: 0.3,
                fontSize: '4rem',
              }}
            >
              {post.title.charAt(0)}
            </Typography>
          </Box>
        )}
        <CardContent
          sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
        >
          <Typography
            variant="h6"
            component="h3"
            gutterBottom
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '3.6em',
            }}
          >
            {post.title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              flexGrow: 1,
            }}
          >
            {post.content}
          </Typography>
          {post.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocationOnIcon
                sx={{
                  fontSize: '1rem',
                  mr: 0.5,
                  color: 'text.secondary',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {post.location}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {tags.slice(0, COMPACT_TAG_LIMIT).map((tag, index) => (
              <Chip
                key={index}
                label={formatTagLabel(tag)}
                size="small"
                onClick={handleTagClick(tag)}
                sx={{
                  fontSize: '0.75rem',
                  height: '24px',
                  ...tagChipSx(tag, true),
                }}
              />
            ))}
            {tags.length > COMPACT_TAG_LIMIT && (
              <Chip
                label={`+${tags.length - COMPACT_TAG_LIMIT}`}
                size="small"
                variant="outlined"
                {...staticChipProps}
                sx={{
                  fontSize: '0.75rem',
                  height: '24px',
                  borderColor: '#999',
                  color: '#666',
                  cursor: 'default',
                }}
              />
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  const config = STANDARD_VARIANTS[variant];
  const visibleTags =
    config.tagLimit === undefined ? tags : tags.slice(0, config.tagLimit);

  const cardBody = (
    <>
      <Box sx={{ position: 'relative' }}>
        <LazyImage
          src={post.imageUrl || '/top.jpg'}
          alt={post.title}
          height={config.imageHeight}
        />
        {badge && <Box sx={{ ...overlaySx, left: 8 }}>{badge}</Box>}
        {actions && (
          <Box
            sx={{ ...overlaySx, right: 8, display: 'flex', gap: 1 }}
            onClick={stopCardActivation}
          >
            {actions}
          </Box>
        )}
        {typeof post.similarity === 'number' && (
          <Chip
            icon={<AutoAwesomeIcon fontSize="small" />}
            label={`類似度 ${Math.round(post.similarity * 100)}%`}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor:
                post.similarity >= 0.3
                  ? 'rgba(255, 152, 0, 0.95)'
                  : 'rgba(120, 120, 120, 0.85)',
              color: '#fff',
              fontWeight: 600,
            }}
          />
        )}
      </Box>
      <CardContent sx={{ flexGrow: 1, bgcolor: 'background.paper' }}>
        <Stack spacing={2}>
          <Box>
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                ...(config.titleNoWrap
                  ? {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }
                  : {}),
              }}
            >
              {post.title}
            </Typography>
            {post.createdAt && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: config.dateMarginBottom }}
              >
                {formatDistanceToNow(post.createdAt)}
              </Typography>
            )}
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: config.contentLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.content}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {post.location && (
              <Chip
                icon={<LocationOnIcon />}
                label={post.location}
                size="small"
                {...staticChipProps}
                sx={{
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  cursor: 'default',
                }}
              />
            )}
            {visibleTags.map((tag, index) => (
              <Chip
                key={index}
                label={formatTagLabel(tag)}
                size="small"
                {...(config.interactiveTags
                  ? { onClick: handleTagClick(tag) }
                  : staticChipProps)}
                sx={tagChipSx(tag, config.interactiveTags)}
              />
            ))}
          </Stack>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar
                src={post.author?.avatar || undefined}
                sx={{ width: config.avatarSize, height: config.avatarSize }}
              >
                {!post.author?.avatar &&
                  post.author?.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {post.author?.name}
              </Typography>
            </Box>
            {footerAction ?? (
              <Box onClick={stopCardActivation}>
                <BookmarkButton
                  postId={post.id}
                  initialBookmarkCount={getFavoritesCount(post)}
                  initialIsBookmarked={isBookmarked}
                  size="small"
                />
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
    </>
  );

  const cardSx = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 2,
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
    ...config.width,
    ...cardHoverSx,
  };

  if (onClick) {
    return (
      <Card sx={cardSx} onClick={onClick}>
        {cardBody}
      </Card>
    );
  }

  return (
    <Card component={Link} href={`/posts/${post.id}`} sx={cardSx}>
      {cardBody}
    </Card>
  );
}
