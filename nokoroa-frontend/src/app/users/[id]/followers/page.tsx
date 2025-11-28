'use client';

import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import UserCard from '@/components/follow/UserCard';
import { getFollowers } from '@/lib/follows';
import { UserFollowData } from '@/types/user';

export default function FollowersPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);
  const [followers, setFollowers] = useState<UserFollowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tabValue, setTabValue] = useState(0);

  const fetchFollowers = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFollowers(userId, page, 20);
      setFollowers(data.followers || []);
      setTotalPages(data.totalPages);
    } catch {
      // フォロワーの取得でエラーが発生した場合の処理
      toast.error('フォロワーの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId, page]);

  useEffect(() => {
    fetchFollowers();
  }, [fetchFollowers]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 1) {
      router.push(`/users/${userId}/following`);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/users/${userId}`)}
          >
            プロフィールに戻る
          </Button>
        </Box>

        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
          <Tab label="フォロワー" />
          <Tab label="フォロー中" />
        </Tabs>

        <Typography variant="h5" gutterBottom>
          フォロワー
        </Typography>

        {followers.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 3 }}>
            まだフォロワーはいません
          </Typography>
        ) : (
          <Box sx={{ mt: 3 }}>
            {followers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                showFollowButton={true}
                onFollowChange={fetchFollowers}
              />
            ))}
          </Box>
        )}

        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              前へ
            </Button>
            <Typography sx={{ mx: 2, alignSelf: 'center' }}>
              {page} / {totalPages}
            </Typography>
            <Button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              次へ
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
