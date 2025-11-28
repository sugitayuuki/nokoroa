'use client';

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PublicIcon from '@mui/icons-material/Public';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { formatDistanceToNow } from '@/utils/dateFormat';
import { getTagColor } from '@/utils/tagColors';

interface Post {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  location: string | null;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserPostsListProps {
  posts: Post[];
  showPrivatePosts?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isOwnProfile?: boolean;
  onPostUpdate?: () => void;
}

export default function UserPostsList({
  posts,
  showPrivatePosts = true,
  hasMore: _hasMore,
  onLoadMore: _onLoadMore,
  isOwnProfile = false,
  onPostUpdate,
}: UserPostsListProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);

  // 削除ダイアログが開いている間、body要素のスクロールを無効化
  useBodyScrollLock(deleteDialogOpen);

  const handleEditClick = (e: React.MouseEvent, post: Post) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/posts/${post.id}/edit`);
  };

  const handleDeleteClick = (e: React.MouseEvent, post: Post) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPost(post);
    setDeleteDialogOpen(true);
  };

  const handleVisibilityClick = (e: React.MouseEvent, post: Post) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPost(post);
    setAnchorEl(e.currentTarget as HTMLElement);
    setVisibilityMenuOpen(true);
  };

  const handleVisibilityClose = () => {
    setAnchorEl(null);
    setVisibilityMenuOpen(false);
  };

  const handleVisibilityChange = async (isPublic: boolean) => {
    if (!selectedPost) return;

    try {
      const response = await fetch(`/api/posts/${selectedPost.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPublic }),
      });

      if (response.ok) {
        if (onPostUpdate) {
          onPostUpdate();
        }
      }
    } catch {
      // 可視性の更新に失敗
    }

    handleVisibilityClose();
  };

  const handleDeleteConfirm = async () => {
    if (!selectedPost) return;

    try {
      const response = await fetch(`/api/posts/${selectedPost.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (onPostUpdate) {
          onPostUpdate();
        }
      }
    } catch {
      // 投稿の削除に失敗
    }

    setDeleteDialogOpen(false);
    setSelectedPost(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedPost(null);
  };

  const filteredPosts = showPrivatePosts
    ? posts
    : posts.filter((post) => post.isPublic);

  if (filteredPosts.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          backgroundColor: 'grey.50',
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          まだ投稿がありません
        </Typography>
        <Typography variant="body2" color="text.secondary">
          最初の投稿を作成してみましょう！
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        },
        gap: 3,
      }}
    >
      {filteredPosts.map((post) => (
        <Card
          key={post.id}
          elevation={2}
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: 4,
            },
          }}
        >
          <Link
            href={`/posts/${post.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {post.imageUrl && (
              <CardMedia
                component="img"
                height="200"
                image={post.imageUrl}
                alt={post.title}
                sx={{ objectFit: 'cover' }}
              />
            )}

            <CardContent sx={{ flexGrow: 1, p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Typography
                  variant="h6"
                  component="h3"
                  noWrap
                  sx={{ flexGrow: 1 }}
                >
                  {post.title}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {isOwnProfile && (
                    <>
                      <IconButton
                        size="small"
                        onClick={(e) => handleEditClick(e, post)}
                        sx={{ p: 0.5 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => handleDeleteClick(e, post)}
                        sx={{ p: 0.5 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => handleVisibilityClick(e, post)}
                        sx={{ p: 0.5 }}
                      >
                        <PublicIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  {post.isPublic ? (
                    <VisibilityIcon color="action" fontSize="small" />
                  ) : (
                    <VisibilityOffIcon color="action" fontSize="small" />
                  )}
                </Box>
              </Box>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 2,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {post.content}
              </Typography>

              {post.location && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 1,
                  }}
                >
                  <LocationOnIcon color="action" fontSize="small" />
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {post.location}
                  </Typography>
                </Box>
              )}

              {post.tags.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}
                >
                  {post.tags.slice(0, 3).map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/search?tags=${encodeURIComponent(tag)}`);
                      }}
                      sx={{
                        backgroundColor: getTagColor(tag),
                        color: '#fff',
                        fontWeight: 500,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: getTagColor(tag),
                          filter: 'brightness(0.9)',
                        },
                      }}
                    />
                  ))}
                  {post.tags.length > 3 && (
                    <Chip
                      label={`+${post.tags.length - 3}`}
                      size="small"
                      variant="outlined"
                      color="default"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      sx={{
                        cursor: 'default',
                      }}
                    />
                  )}
                </Stack>
              )}

              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(post.createdAt)}
              </Typography>
            </CardContent>
          </Link>
        </Card>
      ))}

      <Menu
        anchorEl={anchorEl}
        open={visibilityMenuOpen}
        onClose={handleVisibilityClose}
        disableScrollLock={true}
      >
        <MenuItem onClick={() => handleVisibilityChange(true)}>
          <PublicIcon fontSize="small" sx={{ mr: 1 }} />
          公開
        </MenuItem>
        <MenuItem onClick={() => handleVisibilityChange(false)}>
          <VisibilityOffIcon fontSize="small" sx={{ mr: 1 }} />
          非公開
        </MenuItem>
      </Menu>

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>投稿を削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この投稿を削除してもよろしいですか？この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>キャンセル</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
