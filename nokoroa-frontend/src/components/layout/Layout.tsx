'use client';

import { Box, CircularProgress, Fade } from '@mui/material';
import { useEffect, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';

import DashboardLayout from '../DashboardLayout';
import Footer from './Footer';
import Header from './Header';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // 認証状態が確定したらコンテンツを表示
  useEffect(() => {
    if (!isLoading) {
      setShowContent(true);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <Fade in={showContent} timeout={300}>
      <Box>
        {isAuthenticated ? (
          <>
            <Header onMobileToggle={handleMobileToggle} />
            <DashboardLayout
              mobileOpen={mobileOpen}
              onMobileToggle={handleMobileToggle}
            >
              {children}
            </DashboardLayout>
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100vh',
            }}
          >
            <Header />
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {children}
            </Box>
            <Footer />
          </Box>
        )}
      </Box>
    </Fade>
  );
}
