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
import type { MouseEvent } from 'react';

import BookmarkButton from '@/components/bookmarks/BookmarkButton';
import { LazyImage } from '@/components/common/LazyImage';
import { formatDistanceToNow } from '@/utils/dateFormat';
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
 * compact: ユーザープロフィールの投稿タブ。240px 画像・タグ 3 件までで、
 *       author と集計を返さない API に合わせてフッターを持たない。
 */
export type PostCardVariant = 'feed' | 'compact';

interface PostCardProps {
  post: PostCardData;
  variant?: PostCardVariant;
  /**
   * 親が既にブックマーク状態を知っている場合に渡す。
   * 渡すとカード毎のブックマーク状態問い合わせを省略できる。
   */
  isBookmarked?: boolean;
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

const tagChipSx = (tag: string) => ({
  backgroundColor: getTagColor(tag),
  color: '#fff',
  fontWeight: 500,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: getTagColor(tag),
    filter: 'brightness(0.9)',
  },
});

const formatTagLabel = (tag: string) => (tag.startsWith('#') ? tag : `#${tag}`);

export default function PostCard({
  post,
  variant = 'feed',
  isBookmarked,
}: PostCardProps) {
  const router = useRouter();
  const tags = post.tags || [];

  // カード全体が <a> なので、タグは既定の遷移を止めてタグ検索へ送る
  const handleTagClick = (tag: string) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/search?tags=${encodeURIComponent(tag)}`);
  };

  // 表示専用チップ。カードのリンク遷移を発火させない
  const handleStaticChipClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

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
              {(post.title ?? '').charAt(0)}
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
                  ...tagChipSx(tag),
                }}
              />
            ))}
            {tags.length > COMPACT_TAG_LIMIT && (
              <Chip
                label={`+${tags.length - COMPACT_TAG_LIMIT}`}
                size="small"
                variant="outlined"
                onClick={handleStaticChipClick}
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
        minWidth: 320,
        maxWidth: 400,
        mx: 'auto',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        ...cardHoverSx,
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <LazyImage
          src={post.imageUrl || '/top.jpg'}
          alt={post.title}
          height={280}
        />
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
              }}
            >
              {post.title}
            </Typography>
            {post.createdAt && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {formatDistanceToNow(post.createdAt)}
              </Typography>
            )}
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
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
                onClick={handleStaticChipClick}
                sx={{
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  cursor: 'default',
                }}
              />
            )}
            {tags.map((tag, index) => (
              <Chip
                key={index}
                label={formatTagLabel(tag)}
                size="small"
                onClick={handleTagClick(tag)}
                sx={tagChipSx(tag)}
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
                sx={{ width: 32, height: 32 }}
              >
                {!post.author?.avatar && post.author?.name?.charAt(0)}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {post.author?.name}
              </Typography>
            </Box>
            <Box
              onClick={(e) => {
                // カード全体が <a> のため、ボタン外(件数テキスト等)のクリックが
                // ブラウザ既定のリンク遷移にならないよう preventDefault も必要
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <BookmarkButton
                postId={post.id}
                initialBookmarkCount={
                  post.favoritesCount || post._count?.favorites || 0
                }
                initialIsBookmarked={isBookmarked}
                size="small"
              />
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
