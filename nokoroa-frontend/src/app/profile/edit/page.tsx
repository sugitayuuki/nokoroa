'use client';

import { Box, CircularProgress, Typography } from '@mui/material';

import ProfileEditForm from '@/components/profile/ProfileEditForm';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function ProfileEditPage() {
  const { isAuthLoading, isReady } = useRequireAuth();

  if (!isReady) {
    return isAuthLoading ? (
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
    ) : null;
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        プロフィール編集
      </Typography>
      <ProfileEditForm />
    </Box>
  );
}
