'use client';

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LanguageIcon from '@mui/icons-material/Language';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { LazyImage } from '@/components/common/LazyImage';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useUser } from '@/hooks/useUser';
import { API_CONFIG } from '@/lib/apiConfig';
import { formatDistanceToNow } from '@/utils/dateFormat';
import { getTagColor } from '@/utils/tagColors';

import { PostData } from '../../types/post';
import BookmarkButton from '../bookmarks/BookmarkButton';

interface MyPostListProps {
  posts: PostData[];
  isLoading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onUpdate?: (postId: number, updates: { isPublic?: boolean }) => void;
  onDelete?: (postId: number) => void;
}

const MyPostCard = ({
  post,
  onUpdate,
  onDelete,
}: {
  post: PostData;
  onUpdate?: (postId: number, updates: { isPublic?: boolean }) => void;
  onDelete?: (postId: number) => void;
}) => {
  const router = useRouter();
  const { user } = useUser();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visibilityMenuAnchor, setVisibilityMenuAnchor] =
    useState<null | HTMLElement>(null);
  const [localPost, setLocalPost] = useState(post);

  // 現在のユーザーが投稿の作者かどうかを判定
  const isOwner = user && user.id === localPost.author.id;

  // propsのpostが変更されたら、localPostも更新
  useEffect(() => {
    setLocalPost(post);
  }, [post]);

  // 削除ダイアログが開いている間、body要素のスクロールを無効化
  useBodyScrollLock(deleteDialogOpen);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/posts/${localPost.id}/edit`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/posts/${localPost.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        // 削除成功時は親コンポーネントに通知
        if (onDelete) {
          onDelete(localPost.id);
        }
        toast.success('投稿を削除しました');
      } else {
        // 削除に失敗した場合の処理
        toast.error('投稿の削除に失敗しました');
      }
    } catch {
      // エラーが発生した場合の処理
      toast.error('エラーが発生しました');
    }
    setDeleteDialogOpen(false);
  };

  const handleVisibilityClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setVisibilityMenuAnchor(e.currentTarget);
  };

  const handleVisibilityChange = async (isPublic: boolean) => {
    try {
      const token = localStorage.getItem('jwt');

      if (!token) {
        // 認証トークンが見つからない場合の処理
        toast.error('ログインが必要です');
        return;
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/posts/${localPost.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isPublic }),
        },
      );

      if (response.ok) {
        // ローカルの状態を更新（スクロール位置を保持）
        setLocalPost((prev) => ({ ...prev, isPublic }));
        // 親コンポーネントに通知
        if (onUpdate) {
          onUpdate(localPost.id, { isPublic });
        }
        toast.success(
          isPublic ? '投稿を公開しました' : '投稿を非公開にしました',
        );
      } else {
        await response.text();
        if (response.status === 401) {
          // 認証エラー: トークンが無効
          toast.error('認証エラー: 再度ログインしてください');
        } else if (response.status === 403) {
          // 権限エラー: 自分の投稿のみ編集可能
          toast.error('権限エラー: 自分の投稿のみ編集できます');
        } else {
          // その他のエラー
          toast.error('公開設定の変更に失敗しました');
        }
      }
    } catch {
      // エラーが発生した場合の処理
      toast.error('エラーが発生しました');
    }
    setVisibilityMenuAnchor(null);
  };

  return (
    <Box>
      <Card
        component={Link}
        href={`/posts/${localPost.id}`}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          overflow: 'hidden',
          minWidth: { xs: '100%', sm: 320 },
          maxWidth: { xs: '100%', sm: 400 },
          mx: 'auto',
          transition: 'transform 0.2s, box-shadow 0.2s',
          textDecoration: 'none',
          color: 'inherit',
          cursor: 'pointer',
          position: 'relative',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        {/* 編集・削除・公開設定ボタン（投稿の作者のみ表示） */}
        {isOwner && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 2,
              display: 'flex',
              gap: 1,
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 1,
              p: 0.5,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton size="small" color="primary" onClick={handleEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={handleDeleteClick}>
              <DeleteIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="default"
              onClick={handleVisibilityClick}
            >
              <LanguageIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* 公開/非公開アイコン */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 2,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 1,
            p: 0.5,
          }}
        >
          {localPost.isPublic ? (
            <PublicIcon fontSize="small" color="success" />
          ) : (
            <LockIcon fontSize="small" color="action" />
          )}
        </Box>

        <LazyImage
          src={localPost.imageUrl || '/top.jpg'}
          alt={localPost.title}
          height={{ xs: 200, sm: 280 }}
        />
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
                {localPost.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {formatDistanceToNow(localPost.createdAt)}
              </Typography>
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
              {localPost.content}
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', gap: 1 }}
            >
              {localPost.location && (
                <Chip
                  icon={<LocationOnIcon />}
                  label={localPost.location}
                  size="small"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  sx={{
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    cursor: 'default',
                  }}
                />
              )}
              {localPost.tags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag.startsWith('#') ? tag : `#${tag}`}
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
                  src={localPost.author.avatar || undefined}
                  sx={{ width: 32, height: 32 }}
                >
                  {!localPost.author.avatar && localPost.author.name.charAt(0)}
                </Avatar>
                <Typography variant="body2" color="text.secondary">
                  {localPost.author.name}
                </Typography>
              </Box>
              <Box onClick={(e) => e.stopPropagation()}>
                <BookmarkButton
                  postId={localPost.id}
                  initialBookmarkCount={
                    localPost.favoritesCount || localPost._count?.favorites || 0
                  }
                  size="small"
                />
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* 公開設定メニュー */}
      <Menu
        anchorEl={visibilityMenuAnchor}
        open={Boolean(visibilityMenuAnchor)}
        onClose={() => setVisibilityMenuAnchor(null)}
        disableScrollLock={true}
      >
        <MenuItem onClick={() => handleVisibilityChange(true)}>
          <PublicIcon fontSize="small" sx={{ mr: 1 }} />
          公開
        </MenuItem>
        <MenuItem onClick={() => handleVisibilityChange(false)}>
          <LockIcon fontSize="small" sx={{ mr: 1 }} />
          非公開
        </MenuItem>
      </Menu>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>投稿を削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この投稿を削除してもよろしいですか？この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
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
};

export const MyPostList = ({
  posts,
  isLoading,
  hasMore: _hasMore,
  onLoadMore: _onLoadMore,
  onUpdate,
  onDelete,
}: MyPostListProps) => {
  if (isLoading && posts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (posts.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          投稿がありません
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
          lg: 'repeat(3, 1fr)',
          xl: 'repeat(3, 1fr)',
        },
        gap: { xs: 2, sm: 3, md: 4 },
        maxWidth: '1400px',
        mx: 'auto',
        px: { xs: 2, sm: 0 },
      }}
    >
      {posts.map((post) => (
        <MyPostCard
          key={post.id}
          post={post}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </Box>
  );
};
