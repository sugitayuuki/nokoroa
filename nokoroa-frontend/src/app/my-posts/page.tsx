'use client';

import FolderIcon from '@mui/icons-material/Folder';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { MyPostListLazy } from '@/components/post/MyPostCardLazy';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/providers/AuthProvider';
import { PostData } from '@/types/post';

export default function MyPostsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { user, isLoading, error, refetch } = useUser();
  const [activeTab, setActiveTab] = useState(0);
  const [posts, setPosts] = useState<PostData[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user && user.posts) {
      // user.postsをPostData形式に変換（author情報を追加）
      const transformedPosts = user.posts.map((post) => ({
        ...post,
        author: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
        _count: post._count || {
          favorites: post.favoritesCount || 0,
        },
      }));
      setPosts(transformedPosts);
    }
  }, [user]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handlePostUpdate = useCallback(
    (postId: number, updates: { isPublic?: boolean }) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId ? { ...post, ...updates } : post,
        ),
      );
    },
    [],
  );

  const handlePostDelete = useCallback((postId: number) => {
    setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
  }, []);

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

  const publicPosts = posts.filter((post) => post.isPublic);
  const privatePosts = posts.filter((post) => !post.isPublic);
  const allPosts = posts;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <FolderIcon sx={{ fontSize: '2rem', color: '#607d8b' }} />
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          自分の投稿
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label={`すべて (${allPosts.length})`} />
          <Tab label={`公開 (${publicPosts.length})`} />
          <Tab label={`非公開 (${privatePosts.length})`} />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <MyPostListLazy
          posts={allPosts}
          isLoading={false}
          onUpdate={handlePostUpdate}
          onDelete={handlePostDelete}
        />
      )}
      {activeTab === 1 && (
        <MyPostListLazy
          posts={publicPosts}
          isLoading={false}
          onUpdate={handlePostUpdate}
          onDelete={handlePostDelete}
        />
      )}
      {activeTab === 2 && (
        <MyPostListLazy
          posts={privatePosts}
          isLoading={false}
          onUpdate={handlePostUpdate}
          onDelete={handlePostDelete}
        />
      )}
    </Box>
  );
}
