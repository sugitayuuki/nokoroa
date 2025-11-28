'use client';

import {
  BookmarkBorder,
  CalendarToday,
  FavoriteBorder,
  LocationOn,
  Person,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { PostData } from '@/types/post';
import { formatPostDate } from '@/utils/dateFormat';
import { getTagColor } from '@/utils/tagColors';

interface UnifiedPostCardProps {
  post: PostData;
  variant?: 'default' | 'compact' | 'detailed';
  showActions?: boolean;
  onBookmark?: (postId: number) => void;
  onLike?: (postId: number) => void;
  onClick?: () => void;
}

export default function UnifiedPostCard({
  post,
  variant = 'default',
  showActions = true,
  onBookmark,
  onLike,
  onClick,
}: UnifiedPostCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(
    post.favoritesCount || post._count?.favorites || 0,
  );
  const [likeCount, setLikeCount] = useState(0);

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/posts/${post.id}`);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (onBookmark) {
      onBookmark(post.id);
    }

    setIsBookmarked(!isBookmarked);
    setBookmarkCount(isBookmarked ? bookmarkCount - 1 : bookmarkCount + 1);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (onLike) {
      onLike(post.id);
    }

    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  const imageHeight = variant === 'compact' ? 140 : 200;

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-6px)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
        },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={handleCardClick}
    >
      {post.imageUrl && (
        <Box sx={{ overflow: 'hidden', height: imageHeight }}>
          <CardMedia
            component="img"
            height={imageHeight}
            image={post.imageUrl}
            alt={post.title}
            sx={{
              objectFit: 'cover',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
          />
        </Box>
      )}

      <CardContent
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 2.5,
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          gutterBottom
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            fontWeight: 600,
            lineHeight: 1.3,
            mb: 1.5,
          }}
        >
          {post.title}
        </Typography>

        {variant !== 'compact' && (
          <Typography
            variant="body2"
            color="text.secondary"
            paragraph
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              minHeight: '60px',
              lineHeight: 1.6,
              mb: 2,
            }}
          >
            {post.content}
          </Typography>
        )}

        <Box sx={{ mt: 'auto' }}>
          {post.tags && post.tags.length > 0 && (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}
            >
              {post.tags.slice(0, 3).map((tag) => (
                <Chip
                  key={tag}
                  label={tag.startsWith('#') ? tag : `#${tag}`}
                  size="small"
                  sx={{
                    backgroundColor: getTagColor(tag),
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    height: 24,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      filter: 'brightness(1.1)',
                    },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/search?tags=${encodeURIComponent(tag)}`);
                  }}
                />
              ))}
              {post.tags.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  +{post.tags.length - 3}
                </Typography>
              )}
            </Stack>
          )}

          <Stack spacing={1}>
            {post.location && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 1,
                }}
              >
                <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {post.location}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar
                  src={post.author?.avatar || undefined}
                  sx={{
                    width: 28,
                    height: 28,
                    border: '2px solid',
                    borderColor: 'background.paper',
                  }}
                >
                  <Person sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="caption" color="text.secondary">
                  {post.author?.name || 'Unknown'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {formatPostDate(post.createdAt)}
                </Typography>
              </Box>
            </Box>

            {showActions && (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}
              >
                <Tooltip title={isLiked ? 'いいねを取り消す' : 'いいね'}>
                  <IconButton
                    size="small"
                    onClick={handleLike}
                    sx={{
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.15)',
                      },
                    }}
                  >
                    <FavoriteBorder
                      sx={{
                        fontSize: 20,
                        color: isLiked ? 'error.main' : 'text.secondary',
                        transition: 'color 0.2s ease',
                      }}
                    />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  {likeCount}
                </Typography>

                <Tooltip
                  title={isBookmarked ? 'ブックマーク解除' : 'ブックマーク'}
                >
                  <IconButton
                    size="small"
                    onClick={handleBookmark}
                    sx={{
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.15)',
                      },
                    }}
                  >
                    <BookmarkBorder
                      sx={{
                        fontSize: 20,
                        color: isBookmarked ? 'primary.main' : 'text.secondary',
                        transition: 'color 0.2s ease',
                      }}
                    />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  {bookmarkCount}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
