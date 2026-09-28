'use client';

import { Edit as EditIcon } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Container,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import FollowButton from '@/components/follow/FollowButton';
import PostCard from '@/components/post/PostCard';
import { GRID_LAYOUT } from '@/constants/theme';
import { useUser } from '@/hooks/useUser';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { UserProfile } from '@/types/user';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

type UserData = UserProfile & {
  posts?: Array<{
    id: number;
    title: string;
    content: string;
    imageUrl?: string;
    location?: string;
    tags: string[];
  }>;
  isFollowing?: boolean;
};

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);
  const { user: currentUser } = useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const isOwnProfile = currentUser?.id === userId;

  const fetchUserData = React.useCallback(async () => {
    try {
      const endpoint = API_CONFIG.endpoints.userById(String(userId));
      const response = await createApiRequest(endpoint);

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      } else if (response.status !== 404) {
        // 404 は下部の「ユーザーが見つかりません」表示に任せ、それ以外のみ通知する
        toast.error('ユーザー情報の取得に失敗しました');
      }
    } catch {
      // ユーザーデータの取得でエラーが発生した場合の処理
      toast.error('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleFollowChange = (isFollowing: boolean) => {
    setUserData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        followersCount: isFollowing
          ? prev.followersCount + 1
          : prev.followersCount - 1,
      };
    });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Skeleton variant="circular" width={120} height={120} />
            <Box sx={{ ml: 3, flex: 1 }}>
              <Skeleton variant="text" width={200} height={40} />
              <Skeleton variant="text" width={300} height={20} />
              <Skeleton variant="text" width={250} height={20} />
            </Box>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (!userData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h5">ユーザーが見つかりません</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
          <Avatar
            src={userData.avatar || undefined}
            alt={userData.name}
            sx={{ width: 120, height: 120, mr: 3 }}
          >
            {userData.name?.charAt(0).toUpperCase()}
          </Avatar>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1" sx={{ mr: 3 }}>
                {userData.name}
              </Typography>

              {isOwnProfile ? (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => router.push('/profile/edit')}
                >
                  プロフィール編集
                </Button>
              ) : (
                currentUser && (
                  <FollowButton
                    userId={userId}
                    initialFollowing={userData.isFollowing}
                    onFollowChange={handleFollowChange}
                  />
                )
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
              <Typography variant="body1">
                <strong>{userData.postsCount}</strong> 投稿
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
                onClick={() => router.push(`/users/${userId}/followers`)}
              >
                <strong>{userData.followersCount}</strong> フォロワー
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
                onClick={() => router.push(`/users/${userId}/following`)}
              >
                <strong>{userData.followingCount}</strong> フォロー中
              </Typography>
            </Box>

            {userData.bio && (
              <Typography variant="body1" color="text.secondary">
                {userData.bio}
              </Typography>
            )}
          </Box>
        </Box>

        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="profile tabs"
        >
          <Tab label="投稿" />
          <Tab label="いいね" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: GRID_LAYOUT,
            gap: 3,
          }}
        >
          {userData.posts?.map((post) => (
            <PostCard key={post.id} post={post} variant="compact" />
          ))}
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="body1" color="text.secondary">
          いいねした投稿がここに表示されます
        </Typography>
      </TabPanel>
    </Container>
  );
}
