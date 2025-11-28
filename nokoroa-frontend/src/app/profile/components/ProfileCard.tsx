'use client';

import EditIcon from '@mui/icons-material/Edit';
import EmailIcon from '@mui/icons-material/Email';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';

import { User, UserPost } from '@/types/user';
import { formatJoinedDate } from '@/utils/dateFormat';

type ProfileUser = User & {
  posts?: UserPost[];
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
};

interface ProfileCardProps {
  user: ProfileUser;
}

export default function ProfileCard({ user }: ProfileCardProps) {
  const router = useRouter();
  const joinedDate = new Date(user.createdAt);
  const postsCount = user.posts?.length || 0;
  const publicPostsCount =
    user.posts?.filter((post) => post.isPublic).length || 0;

  const handleEditProfile = () => {
    router.push('/profile/edit');
  };

  return (
    <Card elevation={3} sx={{ mb: 3 }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'center', sm: 'flex-start' },
            mb: 3,
            gap: { xs: 2, sm: 0 },
          }}
        >
          <Avatar
            src={user.avatar || undefined}
            sx={{
              width: { xs: 100, sm: 80 },
              height: { xs: 100, sm: 80 },
              bgcolor: 'primary.main',
              fontSize: '2rem',
              mr: { xs: 0, sm: 3 },
              mb: { xs: 2, sm: 0 },
            }}
          >
            {!user.avatar && user.name.charAt(0).toUpperCase()}
          </Avatar>

          <Box sx={{ flexGrow: 1, width: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: { xs: 'center', sm: 'space-between' },
                alignItems: { xs: 'center', sm: 'flex-start' },
                mb: 1,
                gap: { xs: 1, sm: 0 },
              }}
            >
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontSize: { xs: '1.75rem', sm: '2.125rem' },
                  textAlign: { xs: 'center', sm: 'left' },
                }}
              >
                {user.name}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                onClick={handleEditProfile}
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    bgcolor: 'primary.main',
                    color: 'white',
                  },
                }}
              >
                編集
              </Button>
            </Box>

            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent={{ xs: 'center', sm: 'flex-start' }}
              sx={{ mb: 1 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <EmailIcon color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
            </Stack>

            {user.bio && (
              <Typography
                variant="body1"
                sx={{
                  mb: 1,
                  textAlign: { xs: 'center', sm: 'left' },
                }}
              >
                {user.bio}
              </Typography>
            )}

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              参加日: {formatJoinedDate(joinedDate)}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { elevation: 3 },
              }}
              onClick={() => router.push(`/users/${user.id}/followers`)}
            >
              <Typography variant="h6" color="primary">
                {user.followersCount || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                フォロワー
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { elevation: 3 },
              }}
              onClick={() => router.push(`/users/${user.id}/following`)}
            >
              <Typography variant="h6" color="primary">
                {user.followingCount || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                フォロー中
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {user.postsCount || postsCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                投稿数
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {publicPostsCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                公開投稿
              </Typography>
            </Paper>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
