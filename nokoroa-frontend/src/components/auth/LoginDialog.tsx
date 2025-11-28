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

const schema = z.object({
  email: z.string().email('メールアドレスが不正です'),
  password: z.string().min(6, '6文字以上入力してください'),
});

type FormType = z.infer<typeof schema>;

interface LoginDialogProps {
  onClose: () => void;
  onSwitchToSignup?: () => void;
}

export default function LoginDialog({
  onClose,
  onSwitchToSignup,
}: LoginDialogProps) {
  const { login } = useAuth();
  const navigation = useSmoothNavigation();
  const theme = useTheme();

  // モーダルが開いている間、body要素のスクロールを無効化
  useBodyScrollLock(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormType>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormType) => {
    const success = await login(data.email, data.password);
    if (success) {
      onClose();
      // スムーズなナビゲーションを使用してページリロードを避ける
      navigation.push('/');
    }
  };

  const handleGoogleLogin = () => {
    // Google OAuth認証URLにリダイレクト
    window.location.href = API_CONFIG.buildUrl(API_CONFIG.endpoints.googleAuth);
  };

  return (
    <Dialog
      open
      maxWidth="xs"
      fullWidth
      onClose={onClose}
      disableScrollLock={false}
    >
      <DialogTitle sx={{ pr: 6 }}>
        ログイン
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2}>
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

            <Divider sx={{ my: 2 }}>または</Divider>

            <Button
              variant="outlined"
              fullWidth
              onClick={handleGoogleLogin}
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
              <span>Googleでログイン</span>
            </Button>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
          <Button
            variant="contained"
            type="submit"
            fullWidth
            disabled={isSubmitting}
          >
            ログイン
          </Button>
        </DialogActions>

        <Typography variant="body2" align="center" sx={{ mb: 2 }}>
          アカウントをお持ちでない方は{' '}
          <MuiLink
            component="button"
            underline="hover"
            onClick={(e) => {
              e.preventDefault();
              onSwitchToSignup?.();
            }}
          >
            こちら
          </MuiLink>
        </Typography>
      </form>
    </Dialog>
  );
}
