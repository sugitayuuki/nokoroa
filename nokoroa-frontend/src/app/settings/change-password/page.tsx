'use client';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useChangePassword } from '@/hooks/useChangePassword';
import { useAuth } from '@/providers/AuthProvider';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { changePassword, isLoading, error, success } = useChangePassword();

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 認証チェック
  if (!authLoading && !isAuthenticated) {
    router.push('/login');
    return null;
  }

  if (authLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.currentPassword) {
      errors.currentPassword = '現在のパスワードを入力してください';
    }

    if (!formData.newPassword) {
      errors.newPassword = '新しいパスワードを入力してください';
    } else if (formData.newPassword.length < 6) {
      errors.newPassword = 'パスワードは6文字以上である必要があります';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'パスワードの確認を入力してください';
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'パスワードが一致しません';
    }

    if (formData.currentPassword === formData.newPassword) {
      errors.newPassword =
        '新しいパスワードは現在のパスワードと異なる必要があります';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await changePassword(formData);

    if (success) {
      // 成功時はフォームをリセット
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  };

  const handleChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));

      // エラーをクリア
      if (formErrors[field]) {
        setFormErrors((prev) => ({
          ...prev,
          [field]: '',
        }));
      }
    };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            component={Link}
            href="/settings"
            startIcon={<ArrowBackIcon />}
            sx={{ minWidth: 'auto', p: 1 }}
          >
            戻る
          </Button>
          <Typography variant="h4" component="h1">
            パスワード変更
          </Typography>
        </Box>

        <Paper elevation={1} sx={{ p: 4 }}>
          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              パスワードが正常に変更されました
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <TextField
                label="現在のパスワード"
                type="password"
                fullWidth
                required
                value={formData.currentPassword}
                onChange={handleChange('currentPassword')}
                error={!!formErrors.currentPassword}
                helperText={formErrors.currentPassword}
                disabled={isLoading}
              />

              <TextField
                label="新しいパスワード"
                type="password"
                fullWidth
                required
                value={formData.newPassword}
                onChange={handleChange('newPassword')}
                error={!!formErrors.newPassword}
                helperText={
                  formErrors.newPassword || '6文字以上で入力してください'
                }
                disabled={isLoading}
              />

              <TextField
                label="新しいパスワード（確認）"
                type="password"
                fullWidth
                required
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                error={!!formErrors.confirmPassword}
                helperText={formErrors.confirmPassword}
                disabled={isLoading}
              />

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  component={Link}
                  href="/settings"
                  variant="outlined"
                  disabled={isLoading}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} /> : null}
                >
                  {isLoading ? '変更中...' : 'パスワードを変更'}
                </Button>
              </Box>
            </Stack>
          </form>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>パスワードのセキュリティについて：</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            • パスワードは6文字以上で設定してください
            <br />
            • 英数字や記号を組み合わせることを推奨します
            <br />• 他のサービスで使用しているパスワードは避けてください
          </Typography>
        </Paper>
      </Stack>
    </Container>
  );
}
