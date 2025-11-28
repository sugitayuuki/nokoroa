'use client';

import {
  Edit as EditIcon,
  LocationOn as LocationOnIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import FollowButton from '@/components/follow/FollowButton';
import { useUser } from '@/hooks/useUser';
import { API_CONFIG } from '@/lib/apiConfig';
import { UserProfile } from '@/types/user';
import { getTagColor } from '@/utils/tagColors';

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
      const token = localStorage.getItem('jwt');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/users/${userId}`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      } else if (response.status === 401) {
        // 認証エラーの場合は、認証なしで再度取得を試みる
        const publicResponse = await fetch(
          `${API_CONFIG.BASE_URL}/users/${userId}`,
        );
        if (publicResponse.ok) {
          const data = await publicResponse.json();
          setUserData(data);
        } else {
          // ユーザー情報の取得に失敗した場合の処理
        }
      } else {
        // ユーザー情報の取得に失敗した場合の処理
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
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 3,
          }}
        >
          {userData.posts?.map((post) => (
            <Card
              key={post.id}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
                },
              }}
              onClick={() => router.push(`/posts/${post.id}`)}
            >
              {post.imageUrl ? (
                <Box
                  component="img"
                  src={post.imageUrl}
                  alt={post.title}
                  sx={{
                    height: 240,
                    width: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    height: 240,
                    background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    variant="h2"
                    sx={{
                      color: 'white',
                      opacity: 0.3,
                      fontSize: '4rem',
                    }}
                  >
                    {post.title.charAt(0)}
                  </Typography>
                </Box>
              )}
              <CardContent
                sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
              >
                <Typography
                  variant="h6"
                  component="h3"
                  gutterBottom
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: '3.6em',
                  }}
                >
                  {post.title}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    flexGrow: 1,
                  }}
                >
                  {post.content}
                </Typography>
                {post.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <LocationOnIcon
                      sx={{
                        fontSize: '1rem',
                        mr: 0.5,
                        color: 'text.secondary',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {post.location}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {post.tags?.slice(0, 3).map((tag: string, index: number) => (
                    <Chip
                      key={index}
                      label={tag.startsWith('#') ? tag : `#${tag}`}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/search?tags=${encodeURIComponent(tag)}`);
                      }}
                      sx={{
                        fontSize: '0.75rem',
                        height: '24px',
                        backgroundColor: getTagColor(tag),
                        color: '#fff',
                        fontWeight: 500,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: getTagColor(tag),
                          filter: 'brightness(0.9)',
                        },
                      }}
                    />
                  ))}
                  {post.tags && post.tags.length > 3 && (
                    <Chip
                      label={`+${post.tags.length - 3}`}
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      sx={{
                        fontSize: '0.75rem',
                        height: '24px',
                        borderColor: '#999',
                        color: '#666',
                        cursor: 'default',
                      }}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
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
