'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PhotoCamera } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

import { useUpdateUser } from '@/hooks/useUpdateUser';
import { useUser } from '@/hooks/useUser';
import { API_CONFIG } from '@/lib/apiConfig';

const schema = z
  .object({
    name: z.string().min(2, '名前は2文字以上入力してください'),
    email: z.string().email('有効なメールアドレスを入力してください'),
    bio: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return data.password.length >= 6;
      }
      return true;
    },
    {
      path: ['password'],
      message: 'パスワードは6文字以上入力してください',
    },
  )
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      path: ['confirmPassword'],
      message: 'パスワードが一致しません',
    },
  );

type FormType = z.infer<typeof schema>;

export default function ProfileEditForm() {
  const router = useRouter();
  const { user, isLoading: userLoading, refetch } = useUser();
  const { updateUser, isLoading: updateLoading } = useUpdateUser();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormType>({
    resolver: zodResolver(schema),
  });

  // ユーザー情報をフォームに設定
  useEffect(() => {
    if (user) {
      setValue('name', user.name);
      setValue('email', user.email);
      setValue('bio', user.bio || '');
      if (user.avatar) {
        setAvatarPreview(user.avatar);
      }
    }
  }, [user, setValue]);

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('画像サイズは5MB以下にしてください');
      return;
    }

    // ファイル形式チェック
    if (!file.type.startsWith('image/')) {
      toast.error('画像ファイルを選択してください');
      return;
    }

    // プレビュー表示
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // アップロード処理
    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/users/upload-avatar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error('アバターのアップロードに失敗しました');
      }

      await response.json();
      toast.success('アバターを更新しました');
      await refetch(); // ユーザー情報を再取得
    } catch {
      // アバターのアップロードでエラーが発生した場合の処理
      toast.error('アバターのアップロードに失敗しました');
      // プレビューを元に戻す
      if (user?.avatar) {
        setAvatarPreview(user.avatar);
      } else {
        setAvatarPreview(null);
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const onSubmit = async (data: FormType) => {
    const updateData: {
      name: string;
      email: string;
      bio?: string;
      password?: string;
    } = {
      name: data.name,
      email: data.email,
      bio: data.bio,
    };

    // パスワードが入力されている場合のみ更新
    if (data.password && data.password.length > 0) {
      updateData.password = data.password;
    }

    const success = await updateUser(updateData);
    if (success) {
      // プロフィール情報を再取得
      await refetch();
      // プロフィールページに戻る
      router.push('/profile');
    }
  };

  const handleCancel = () => {
    router.push('/profile');
  };

  if (userLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
        }}
      >
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="error">
          ユーザー情報を取得できませんでした
        </Typography>
      </Box>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={3}>
            {/* アバター表示 */}
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  src={avatarPreview || undefined}
                  sx={{
                    width: 100,
                    height: 100,
                    mx: 'auto',
                    mb: 2,
                    bgcolor: 'primary.main',
                    fontSize: '2rem',
                    cursor: 'pointer',
                    opacity: isUploadingAvatar ? 0.5 : 1,
                  }}
                  onClick={handleAvatarClick}
                >
                  {!avatarPreview && user.name?.charAt(0).toUpperCase()}
                </Avatar>
                <IconButton
                  sx={{
                    position: 'absolute',
                    bottom: 10,
                    right: -5,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    '&:hover': {
                      bgcolor: 'background.paper',
                    },
                  }}
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                >
                  <PhotoCamera fontSize="small" />
                </IconButton>
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              <Typography variant="body2" color="text.secondary">
                アバター画像をクリックして変更
              </Typography>
            </Box>

            {/* 名前 */}
            <TextField
              label="名前"
              fullWidth
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
            />

            {/* メールアドレス */}
            <TextField
              label="メールアドレス"
              type="email"
              fullWidth
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />

            {/* 自己紹介 */}
            <TextField
              label="自己紹介"
              multiline
              rows={4}
              fullWidth
              {...register('bio')}
              error={!!errors.bio}
              helperText={
                errors.bio?.message ||
                '自分について簡単に紹介してください（任意）'
              }
            />

            {/* パスワード変更 */}
            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
              パスワード変更（任意）
            </Typography>

            <TextField
              label="新しいパスワード"
              type="password"
              fullWidth
              {...register('password')}
              error={!!errors.password}
              helperText={
                errors.password?.message ||
                'パスワードを変更する場合のみ入力してください'
              }
            />

            <TextField
              label="新しいパスワード（確認）"
              type="password"
              fullWidth
              {...register('confirmPassword')}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
            />

            {/* ボタン */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={handleCancel}
                disabled={updateLoading}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={updateLoading}
                sx={{
                  bgcolor: '#9c27b0',
                  '&:hover': {
                    bgcolor: '#7b1fa2',
                  },
                }}
              >
                {updateLoading ? '更新中...' : '更新'}
              </Button>
            </Box>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
