'use client';

import SettingsIcon from '@mui/icons-material/Settings';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MyPostList } from '@/components/post/MyPostCard';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/providers/AuthProvider';
import { PostData } from '@/types/post';

import ProfileCard from './components/ProfileCard';

export default function ProfilePage() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { user, isLoading, error, refetch } = useUser();
  const [activeTab, setActiveTab] = useState(0);
  const [localPosts, setLocalPosts] = useState<PostData[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // user.postsが更新されたら、localPostsも更新
  useEffect(() => {
    if (user?.posts) {
      const transformed = (user.posts || []).map((post) => ({
        ...post,
        author: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
        _count: {
          favorites: 0,
        },
      }));
      setLocalPosts(transformed);
    }
  }, [user]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // 投稿の公開/非公開が変更されたときのハンドラー
  const handlePostUpdate = (
    postId: number,
    updates: { isPublic?: boolean },
  ) => {
    setLocalPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, ...updates } : post,
      ),
    );
  };

  // 認証されていない場合は即座にnullを返す
  if (!isAuthenticated) {
    return null;
  }

  if (authLoading || isLoading) {
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

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              再試行
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="info">ユーザー情報を読み込んでいます...</Alert>
      </Container>
    );
  }

  const publicPosts = localPosts.filter((post) => post.isPublic);
  const privatePosts = localPosts.filter((post) => !post.isPublic);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 4, gap: { xs: 2, sm: 0 } }}
      >
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontSize: { xs: '2rem', sm: '3rem' },
          }}
        >
          プロフィール
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button
            component={Link}
            href="/settings"
            startIcon={<SettingsIcon />}
            variant="outlined"
            size={isMobile ? 'small' : 'medium'}
          >
            設定
          </Button>
        </Stack>
      </Stack>

      <ProfileCard user={user} />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          sx={{
            '& .MuiTab-root': {
              minWidth: { xs: 'auto', sm: 120 },
              fontSize: { xs: '0.875rem', sm: '1rem' },
              px: { xs: 1.5, sm: 2 },
            },
          }}
        >
          <Tab
            label={
              isMobile
                ? `公開 (${publicPosts.length})`
                : `公開投稿 (${publicPosts.length})`
            }
          />
          <Tab
            label={
              isMobile
                ? `非公開 (${privatePosts.length})`
                : `非公開投稿 (${privatePosts.length})`
            }
          />
          <Tab
            label={
              isMobile
                ? `全て (${localPosts.length})`
                : `すべて (${localPosts.length})`
            }
          />
        </Tabs>
      </Box>

      <Box>
        {activeTab === 0 && (
          <MyPostList
            posts={publicPosts}
            isLoading={false}
            hasMore={false}
            onLoadMore={() => {}}
            onUpdate={handlePostUpdate}
          />
        )}
        {activeTab === 1 && (
          <MyPostList
            posts={privatePosts}
            isLoading={false}
            hasMore={false}
            onLoadMore={() => {}}
            onUpdate={handlePostUpdate}
          />
        )}
        {activeTab === 2 && (
          <MyPostList
            posts={localPosts}
            isLoading={false}
            hasMore={false}
            onLoadMore={() => {}}
            onUpdate={handlePostUpdate}
          />
        )}
      </Box>
    </Container>
  );
}
