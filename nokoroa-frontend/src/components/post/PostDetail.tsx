'use client';

import {
  CalendarToday as CalendarTodayIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  Lock as LockIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { SyntheticEvent, useState } from 'react';

import { getTagColor } from '@/utils/tagColors';

import { useAuth } from '../../providers/AuthProvider';
import { PostData } from '../../types/post';
import BookmarkButton from '../bookmarks/BookmarkButton';

interface PostDetailProps {
  post: PostData;
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PostDetail = ({ post }: PostDetailProps) => {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarError2, setAvatarError2] = useState(false);
  const isOwner = user?.id === post.author.id;

  const handleAvatarError = (_e: SyntheticEvent<HTMLImageElement, Event>) => {
    setAvatarError(true);
  };

  const handleAvatarError2 = (_e: SyntheticEvent<HTMLImageElement, Event>) => {
    setAvatarError2(true);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    router.push(`/posts/${post.id}/edit`);
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!confirm('この投稿を削除しますか？')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`http://localhost:4000/posts/${post.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      router.push('/posts');
    } catch {
      // 投稿削除時にエラーが発生した場合の処理
      alert('削除に失敗しました。');
    } finally {
      setIsDeleting(false);
    }
    handleMenuClose();
  };

  return (
    <Card
      elevation={3}
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)'
            : 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
      }}
    >
      {/* Hero Image Section */}
      <CardMedia
        component="img"
        image={post.imageUrl || '/top.jpg'}
        alt={post.title}
        sx={{
          height: { xs: 200, sm: 300, md: 400 },
          objectFit: 'cover',
          borderRadius: 0,
          filter: 'brightness(0.9)',
        }}
      />

      <CardContent sx={{ p: 0 }}>
        {/* Header Section */}
        <Box sx={{ p: { xs: 2, sm: 3 }, pb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: { xs: 2, sm: 3 },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 0 },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: { xs: 1.5, sm: 2 },
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              <Avatar
                src={
                  !avatarError && post.author.avatar
                    ? post.author.avatar
                    : undefined
                }
                imgProps={{ onError: handleAvatarError }}
                sx={{
                  bgcolor: 'primary.main',
                  width: { xs: 48, sm: 56 },
                  height: { xs: 48, sm: 56 },
                  boxShadow: theme.shadows[4],
                }}
              >
                {(avatarError || !post.author.avatar) && post.author.name
                  ? post.author.name.charAt(0).toUpperCase()
                  : (avatarError || !post.author.avatar) && (
                      <PersonIcon fontSize="large" />
                    )}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="h6"
                  component="h2"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '1rem', sm: '1.25rem' },
                    cursor: 'pointer',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                  onClick={() => router.push(`/users/${post.author.id}`)}
                >
                  {post.author.name}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 0.5,
                  }}
                >
                  <CalendarTodayIcon
                    fontSize="small"
                    sx={{ color: 'text.secondary' }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(post.createdAt)}
                  </Typography>
                </Box>
                {post.location && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mt: 0.5,
                    }}
                  >
                    <LocationIcon
                      fontSize="small"
                      sx={{ color: 'text.secondary' }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {post.location}
                    </Typography>
                  </Box>
                )}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 0.5,
                  }}
                >
                  {post.isPublic ? (
                    <>
                      <PublicIcon
                        fontSize="small"
                        sx={{ color: 'success.main' }}
                      />
                      <Typography variant="caption" color="success.main">
                        公開
                      </Typography>
                    </>
                  ) : (
                    <>
                      <LockIcon
                        fontSize="small"
                        sx={{ color: 'warning.main' }}
                      />
                      <Typography variant="caption" color="warning.main">
                        非公開
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>
            </Box>

            {isOwner && (
              <Box
                sx={{
                  position: { xs: 'absolute', sm: 'static' },
                  top: { xs: 16, sm: 'auto' },
                  right: { xs: 16, sm: 'auto' },
                }}
              >
                <IconButton
                  onClick={handleMenuOpen}
                  sx={{
                    bgcolor: 'background.paper',
                    boxShadow: theme.shadows[2],
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                  disableScrollLock={true}
                  PaperProps={{
                    elevation: 8,
                    sx: {
                      borderRadius: 2,
                      mt: 1,
                    },
                  }}
                >
                  <MenuItem onClick={handleEdit} sx={{ gap: 1 }}>
                    <EditIcon fontSize="small" />
                    編集
                  </MenuItem>
                  <MenuItem
                    onClick={handleDelete}
                    disabled={isDeleting}
                    sx={{ gap: 1 }}
                  >
                    <DeleteIcon fontSize="small" />
                    削除
                  </MenuItem>
                </Menu>
              </Box>
            )}
          </Box>
        </Box>

        <Divider />

        {/* Content Section */}
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
              background:
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)'
                  : 'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: { xs: 2, sm: 3 },
            }}
          >
            {post.title}
          </Typography>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 3 },
              mb: { xs: 2, sm: 3 },
              bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography
              variant="body1"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                fontSize: { xs: '0.95rem', sm: '1.1rem' },
                color: 'text.primary',
                wordBreak: 'break-word',
              }}
            >
              {post.content}
            </Typography>
          </Paper>

          {post.tags.length > 0 && (
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <Typography
                variant="subtitle2"
                sx={{
                  mb: 1,
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                }}
              >
                タグ
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(post.tags || []).map((tag) => (
                  <Chip
                    key={tag}
                    label={tag.startsWith('#') ? tag : `#${tag}`}
                    size="medium"
                    onClick={() =>
                      router.push(`/search?tags=${encodeURIComponent(tag)}`)
                    }
                    sx={{
                      backgroundColor: getTagColor(tag),
                      color: '#fff',
                      fontWeight: 500,
                      borderRadius: 2,
                      transition: 'all 0.2s ease-in-out',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: getTagColor(tag),
                        filter: 'brightness(0.9)',
                        transform: 'scale(1.05)',
                        boxShadow: theme.shadows[4],
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Author Info Section */}
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography
            variant="subtitle2"
            sx={{
              mb: 2,
              fontWeight: 600,
              fontSize: { xs: '0.875rem', sm: '1rem' },
            }}
          >
            投稿者情報
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1.5, sm: 2 },
              p: { xs: 1.5, sm: 2 },
              bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
              borderRadius: 2,
            }}
          >
            <Avatar
              src={
                !avatarError2 && post.author.avatar
                  ? post.author.avatar
                  : undefined
              }
              imgProps={{ onError: handleAvatarError2 }}
              sx={{
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
                bgcolor: 'primary.main',
              }}
            >
              {(avatarError2 || !post.author.avatar) && post.author.name
                ? post.author.name.charAt(0).toUpperCase()
                : (avatarError2 || !post.author.avatar) && <PersonIcon />}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                noWrap
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'pointer',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
                onClick={() => router.push(`/users/${post.author.id}`)}
              >
                {post.author.name}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                {formatDate(post.createdAt)}
              </Typography>
              {post.location && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    display: 'flex',
                    alignItems: 'center',
                    mt: 0.5,
                  }}
                >
                  <LocationIcon
                    sx={{ fontSize: { xs: 16, sm: 18 }, mr: 0.5 }}
                  />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {post.location}
                  </span>
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Footer Section */}
        <Box sx={{ p: { xs: 2, sm: 3 }, pt: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <BookmarkButton
              postId={post.id}
              initialBookmarkCount={
                post.favoritesCount || post._count?.favorites || 0
              }
              size="large"
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
