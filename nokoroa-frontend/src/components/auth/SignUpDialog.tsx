'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import CloseIcon from '@mui/icons-material/Close';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useSmoothNavigation } from '@/hooks/useSmoothNavigation';
import { API_CONFIG } from '@/lib/apiConfig';
import { useAuth } from '@/providers/AuthProvider';

/* ------------------ スキーマ & 型 ------------------ */
const schema = z
  .object({
    name: z.string().min(2, '2文字以上入力してください'),
    email: z.string().email('メールアドレスが不正です'),
    password: z.string().min(6, '6文字以上入力してください'),
    confirmPassword: z.string().min(6, '6文字以上入力してください'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: '確認用パスワードが一致しません',
  });

type FormType = z.infer<typeof schema>;

/* ------------------ Props 定義 ------------------ */
interface SignUpDialogProps {
  /** `router.back()` などで「戻る」挙動をさせるコールバック */
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

/* ------------------ Dialog 本体 ------------------ */
export default function SignUpDialog({
  onClose,
  onSwitchToLogin,
}: SignUpDialogProps) {
  const navigation = useSmoothNavigation();
  const { register: authRegister } = useAuth();
  const theme = useTheme();

  // モーダルが開いている間、body要素のスクロールを無効化
  useBodyScrollLock(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormType>({ resolver: zodResolver(schema) });

  /* ----- フォーム送信 ----- */
  const onSubmit = async (data: FormType) => {
    const success = await authRegister(data.name, data.email, data.password);
    if (success) {
      onClose();
      // トースト表示後にスムーズにホーム画面に遷移
      setTimeout(() => {
        navigation.push('/');
      }, 500);
    }
  };

  /* ----- リンククリック時：まず閉じて、その後に遷移 ----- */
  const jump = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onClose();
    setTimeout(() => navigation.push(path), 0);
  };

  const handleGoogleSignup = () => {
    // Google OAuth認証URLにリダイレクト
    window.location.href = `${API_CONFIG.BASE_URL}/auth/google`;
  };

  return (
    <Dialog
      open
      maxWidth="xs"
      fullWidth
      onClose={onClose}
      disableScrollLock={false}
    >
      {/* ---------- ヘッダー ---------- */}
      <DialogTitle sx={{ pr: 6 }}>
        新規登録
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* ---------- 本体 ---------- */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <MuiLink href="/terms" underline="hover" onClick={jump('/terms')}>
              利用規約
            </MuiLink>
            および
            <MuiLink
              href="/privacy"
              underline="hover"
              onClick={jump('/privacy')}
            >
              プライバシーポリシー
            </MuiLink>
            に同意した上で、以下の「登録」ボタンを押してください。
          </Typography>

          <Stack spacing={2}>
            <TextField
              label="ユーザー名"
              fullWidth
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <TextField
              label="メールアドレス"
              type="email"
              fullWidth
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              label="パスワード"
              type="password"
              fullWidth
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message}
            />
            <TextField
              label="パスワード（確認用）"
              type="password"
              fullWidth
              {...register('confirmPassword')}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
            />

            <Divider sx={{ my: 2 }}>または</Divider>

            <Button
              variant="outlined"
              fullWidth
              onClick={handleGoogleSignup}
              sx={{
                borderColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.3)'
                    : '#dadce0',
                color: theme.palette.mode === 'dark' ? '#ffffff' : '#3c4043',
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.05)'
                    : '#ffffff',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 500,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                '&:hover': {
                  borderColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.5)'
                      : '#d2d2d2',
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.1)'
                      : '#f8f9fa',
                },
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                style={{ width: 18, height: 18 }}
              />
              <span>Googleで登録</span>
            </Button>
          </Stack>
        </DialogContent>

        {/* ---------- アクション ---------- */}
        <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
          <Button
            variant="contained"
            type="submit"
            fullWidth
            disabled={isSubmitting}
          >
            登録
          </Button>
        </DialogActions>

        {/* ---------- フッター ---------- */}
        <Typography variant="body2" align="center" sx={{ mb: 2 }}>
          会員登録済の方は{' '}
          <MuiLink
            component="button"
            underline="hover"
            onClick={(e) => {
              e.preventDefault();
              onSwitchToLogin?.();
            }}
          >
            こちら
          </MuiLink>
        </Typography>
      </form>
    </Dialog>
  );
}
