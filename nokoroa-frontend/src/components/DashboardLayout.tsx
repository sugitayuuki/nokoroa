'use client';

import BookmarkIcon from '@mui/icons-material/Bookmark';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FolderIcon from '@mui/icons-material/Folder';
import GitHubIcon from '@mui/icons-material/GitHub';
import HomeIcon from '@mui/icons-material/Home';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import MapIcon from '@mui/icons-material/Map';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import NextLink from 'next/link';
import React from 'react';

import { MENU_COLORS } from '@/constants/theme';
import { useSmoothNavigation } from '@/hooks/useSmoothNavigation';
import { useAuth } from '@/providers/AuthProvider';

const drawerWidth = 240;

interface DashboardLayoutProps {
  children: React.ReactNode;
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
}

export default function DashboardLayout({
  children,
  mobileOpen = false,
  onMobileToggle,
}: DashboardLayoutProps) {
  const navigation = useSmoothNavigation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const menuItems = [
    { text: 'ホーム', icon: <HomeIcon />, path: '/', color: MENU_COLORS.home },
    {
      text: '検索',
      icon: <SearchIcon />,
      path: '/search',
      color: MENU_COLORS.search,
    },
    {
      text: '地図から探す',
      icon: <MapIcon />,
      path: '/map',
      color: MENU_COLORS.map,
    },
    {
      text: 'タグ一覧',
      icon: <LocalOfferIcon />,
      path: '/tags',
      color: MENU_COLORS.tags,
    },
    {
      text: 'ブックマーク',
      icon: <BookmarkIcon />,
      path: '/bookmarks',
      color: MENU_COLORS.bookmarks,
    },
    {
      text: '自分の投稿',
      icon: <FolderIcon />,
      path: '/my-posts',
      color: MENU_COLORS.myPosts,
    },
  ];

  const drawerContent = (
    <>
      {/* ユーザープロフィールセクション */}
      <Box sx={{ p: 2, pb: 1 }}>
        <ListItemButton
          onClick={() => {
            navigation.push('/profile');
            if (isMobile && onMobileToggle) {
              onMobileToggle();
            }
          }}
          sx={{
            borderRadius: 2,
            '&:hover': {
              bgcolor: 'action.hover',
            },
            minHeight: 'auto',
            py: 1,
            px: 1,
            width: '100%',
          }}
        >
          <ListItemIcon sx={{ minWidth: 48 }}>
            <Avatar
              src={user?.avatar || undefined}
              sx={{ width: 32, height: 32 }}
            >
              {!user?.avatar && <PersonIcon />}
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={user?.name || 'ユーザー名'}
            secondary={user?.email || 'メールアドレス'}
            sx={{ minWidth: 0, flex: 1 }}
            slotProps={{
              primary: {
                fontSize: '0.9rem',
                fontWeight: 500,
                sx: {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              },
              secondary: {
                fontSize: '0.75rem',
                sx: {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                },
              },
            }}
          />
        </ListItemButton>
      </Box>

      <Divider sx={{ mx: 2 }} />
      <Box sx={{ overflow: 'auto', height: '100%' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => {
                  navigation.push(item.path);
                  if (isMobile && onMobileToggle) {
                    onMobileToggle();
                  }
                }}
                sx={{
                  py: 1.5,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: item.color || 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  slotProps={{
                    primary: {
                      fontSize: '0.9rem',
                      fontWeight: 500,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                navigation.push('/settings');
                if (isMobile && onMobileToggle) {
                  onMobileToggle();
                }
              }}
              sx={{
                py: 1.5,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: 'text.secondary',
                }}
              >
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText
                primary="設定"
                slotProps={{
                  primary: {
                    fontSize: '0.9rem',
                    fontWeight: 500,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                py: 1.5,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: 'text.secondary',
                }}
              >
                <ExitToAppIcon />
              </ListItemIcon>
              <ListItemText
                primary="ログアウト"
                slotProps={{
                  primary: {
                    fontSize: '0.9rem',
                    fontWeight: 500,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>

        {/* フッターセクション */}
        <Box sx={{ mt: 'auto', p: 2, textAlign: 'center' }}>
          <Stack spacing={1} alignItems="center">
            <Stack
              direction="row"
              spacing={2}
              justifyContent="center"
              alignItems="center"
              divider={
                <Box
                  component="span"
                  sx={{
                    width: '1px',
                    height: '12px',
                    bgcolor: 'divider',
                  }}
                />
              }
            >
              <Link
                component={NextLink}
                href="/terms"
                color="text.secondary"
                underline="hover"
                onClick={() => {
                  if (isMobile && onMobileToggle) {
                    onMobileToggle();
                  }
                }}
                sx={{
                  fontSize: '0.75rem',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                利用規約
              </Link>
              <Link
                component={NextLink}
                href="/privacy"
                color="text.secondary"
                underline="hover"
                onClick={() => {
                  if (isMobile && onMobileToggle) {
                    onMobileToggle();
                  }
                }}
                sx={{
                  fontSize: '0.75rem',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                プライバシーポリシー
              </Link>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              alignItems="center"
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                }}
              >
                © 2025 Nokoroa
              </Typography>
              <IconButton
                component="a"
                href="https://github.com/reri2525/nokoroa-frontend"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                size="small"
                sx={{
                  p: 0.5,
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <GitHubIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </>
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `${drawerWidth}px 1fr` },
        gridTemplateRows: '1fr',
        minHeight: '100vh',
        pt: '9vh',
      }}
    >
      {/* モバイル用の一時的なDrawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* デスクトップ用の固定サイドバー */}
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          position: 'fixed',
          top: '9vh',
          left: 0,
          width: drawerWidth,
          height: 'calc(100vh - 9vh)',
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          zIndex: 1100,
          overflow: 'auto',
        }}
      >
        {drawerContent}
      </Box>

      <Box
        component="main"
        sx={{
          gridColumn: { xs: '1', md: '2' },
          p: 3,
          minHeight: 'calc(100vh - 9vh)',
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
