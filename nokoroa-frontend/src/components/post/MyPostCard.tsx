'use client';

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LanguageIcon from '@mui/icons-material/Language';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { EmptyState } from '@/components/common/EmptyState';
import { GRID_LAYOUT } from '@/constants/theme';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useUser } from '@/hooks/useUser';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { useAuth } from '@/providers/AuthProvider';
import { getToken } from '@/utils/auth';

import { PostData } from '../../types/post';
import PostCard from './PostCard';

interface MyPostListProps {
  posts: PostData[];
  isLoading: boolean;
  onUpdate?: (postId: number, updates: { isPublic?: boolean }) => void;
  onDelete?: (postId: number) => void;
}

/**
 * 所有者向けの投稿カード。
 * 表示は PostCard の owner 変種に委ね、この層は公開切替・削除・編集導線と
 * それらに伴う状態 (メニュー / 確認ダイアログ / 楽観的更新) だけを持つ。
 */
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
  // 認証セッションの本人情報はアプリ全体で 1 回だけ取得済み。
  // ログイン直後の取得失敗等で authUser が無いときだけ useUser() に
  // フォールバックする(SWR キャッシュ共有のため N+1 にはならない)。
  const { user: authUser } = useAuth();
  const { user: profileUser } = useUser();
  const user = authUser ?? profileUser;
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
      const response = await createApiRequest(
        API_CONFIG.endpoints.postById(String(localPost.id)),
        {
          method: 'DELETE',
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
      if (!getToken()) {
        // 認証トークンが見つからない場合の処理
        toast.error('ログインが必要です');
        return;
      }

      const response = await createApiRequest(
        API_CONFIG.endpoints.postById(String(localPost.id)),
        {
          method: 'PUT',
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
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          // 認証エラー: トークンが無効
          toast.error('認証エラー: 再度ログインしてください');
        } else if (response.status === 403) {
          // 権限エラー: 自分の投稿のみ編集可能
          toast.error('権限エラー: 自分の投稿のみ編集できます');
        } else {
          // その他のエラー
          toast.error(errorData.message || '公開設定の変更に失敗しました');
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
      <PostCard
        post={localPost}
        variant="owner"
        badge={
          localPost.isPublic ? (
            <PublicIcon fontSize="small" color="success" />
          ) : (
            <LockIcon fontSize="small" color="action" />
          )
        }
        actions={
          isOwner ? (
            <>
              <IconButton size="small" color="primary" onClick={handleEdit}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={handleDeleteClick}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="default"
                onClick={handleVisibilityClick}
              >
                <LanguageIcon fontSize="small" />
              </IconButton>
            </>
          ) : undefined
        }
      />

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
    return <EmptyState message="投稿がありません" />;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID_LAYOUT,
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
