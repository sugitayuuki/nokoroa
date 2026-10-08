'use client';

import { Box, Container } from '@mui/material';

import SignUpDialog from '@/components/auth/SignUpDialog';

export default function SignupPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Box boxShadow={3} borderRadius={2} overflow="hidden">
        <SignUpDialog
          onClose={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
          // 登録できたがサインインは未完了のとき、ここを渡さないと
          // 「ログインしてご利用ください」と案内した先へ進めない
          onSwitchToLogin={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          }}
        />
      </Box>
    </Container>
  );
}
