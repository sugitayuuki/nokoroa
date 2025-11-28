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
        />
      </Box>
    </Container>
  );
}
