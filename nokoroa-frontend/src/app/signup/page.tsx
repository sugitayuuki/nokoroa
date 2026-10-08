'use client';

import { Box, Container } from '@mui/material';
import { useRouter } from 'next/navigation';

import SignUpDialog from '@/components/auth/SignUpDialog';

export default function SignupPage() {
  const router = useRouter();

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
          // 「ログインしてご利用ください」と案内した先へ進めない。
          // 直前に出した「アカウントを作成しました」のトーストを残すため
          // フルロードではなく SPA 遷移にする
          onSwitchToLogin={() => {
            router.replace('/login');
          }}
        />
      </Box>
    </Container>
  );
}
