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
        />
      </Box>
    </Container>
  );
}
