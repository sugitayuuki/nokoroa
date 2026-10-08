'use client';

import { Box, Container } from '@mui/material';

import LoginDialog from '@/components/auth/LoginDialog';

export default function LoginPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Box boxShadow={3} borderRadius={2} overflow="hidden">
        <LoginDialog
          onClose={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
          // コールバックの失敗画面からはフルロードでこのページに着地するため、
          // ここを渡さないとフッタの「新規登録」が無反応になる
          onSwitchToSignup={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/signup';
            }
          }}
        />
      </Box>
    </Container>
  );
}
