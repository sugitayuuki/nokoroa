'use client';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import { Avatar, useMediaQuery, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';

import { API_CONFIG } from '@/lib/apiConfig';
import { useAuth } from '@/providers/AuthProvider';
import { useDialog } from '@/providers/DialogProvider';

interface HeaderProps {
  onMobileToggle?: () => void;
}

export default function Header({ onMobileToggle }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { openLogin, openSignup } = useDialog();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar disableGutters sx={{ px: 3, height: '9vh' }}>
        {/* ハンバーガーメニューボタン（ログイン後のモバイルのみ） */}
        {isMobile && isAuthenticated && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMobileToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <Link
          href="/"
          style={{
            flexGrow: 1,
            display: 'block',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              textDecoration: 'none',
              letterSpacing: '-0.5px',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: 'primary.main',
              },
            }}
          >
            Nokoroa
          </Typography>
        </Link>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isAuthenticated ? (
            <>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push('/post/new')}
                sx={{
                  borderRadius: 8,
                  px: 3,
                  bgcolor: 'secondary.main',
                  color: 'white',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px rgba(156, 39, 176, 0.2)',
                  '&:hover': {
                    bgcolor: 'secondary.dark',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 12px rgba(156, 39, 176, 0.3)',
                  },
                }}
              >
                投稿
              </Button>
              <IconButton
                onClick={() => router.push('/profile')}
                sx={{
                  p: 0.5,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.1)',
                  },
                }}
              >
                {user?.avatar ? (
                  <Avatar
                    src={
                      user.avatar.startsWith('http')
                        ? user.avatar
                        : `${API_CONFIG.BASE_URL}/uploads/avatars/${user.avatar}`
                    }
                    alt={user.name}
                    sx={{
                      width: 32,
                      height: 32,
                      border: '2px solid',
                      borderColor: 'primary.main',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ) : (
                  <AccountCircleIcon sx={{ fontSize: 32 }} />
                )}
              </IconButton>
            </>
          ) : (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                onClick={openLogin}
                variant="outlined"
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  borderRadius: 8,
                  px: 3,
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    bgcolor: 'primary.main',
                    color: 'white',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(25, 118, 210, 0.2)',
                  },
                }}
              >
                ログイン
              </Button>
              <Button
                onClick={openSignup}
                variant="contained"
                sx={{
                  bgcolor: 'secondary.main',
                  color: 'white',
                  borderRadius: 8,
                  px: 3,
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px rgba(156, 39, 176, 0.2)',
                  '&:hover': {
                    bgcolor: 'secondary.dark',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 12px rgba(156, 39, 176, 0.3)',
                  },
                }}
              >
                新規登録
              </Button>
            </Box>
          )}
        </Box>
      </Toolbar>
    </Box>
  );
}
