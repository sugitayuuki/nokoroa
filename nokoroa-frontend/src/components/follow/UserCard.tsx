'use client';

import {
  Article as ArticleIcon,
  Group as GroupIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';

import { useUser } from '@/hooks/useUser';
import { UserFollowData } from '@/types/user';

import FollowButton from './FollowButton';

interface UserCardProps {
  user: UserFollowData;
  showFollowButton?: boolean;
  onFollowChange?: () => void;
}

export default function UserCard({
  user,
  showFollowButton = true,
  onFollowChange,
}: UserCardProps) {
  const router = useRouter();
  const { user: currentUser } = useUser();
  const isOwnProfile = currentUser?.id === user.id;

  const handleCardClick = () => {
    router.push(`/users/${user.id}`);
  };

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        p: 2,
        mb: 2,
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <CardActionArea
        onClick={handleCardClick}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'center', sm: 'flex-start' },
          justifyContent: 'flex-start',
          p: { xs: 1, sm: 0 },
        }}
      >
        <Avatar
          src={user.avatar || undefined}
          alt={user.name}
          sx={{
            width: { xs: 60, sm: 80 },
            height: { xs: 60, sm: 80 },
            mr: { xs: 0, sm: 2 },
            mb: { xs: 1, sm: 0 },
          }}
        >
          {user.name?.charAt(0).toUpperCase()}
        </Avatar>

        <CardContent sx={{ flex: 1, p: { xs: 1, sm: 2 } }}>
          <Typography
            variant="h6"
            component="h3"
            gutterBottom
            sx={{ textAlign: { xs: 'center', sm: 'left' } }}
          >
            {user.name}
          </Typography>

          {user.bio && (
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
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              {user.bio}
            </Typography>
          )}

          {user._count && (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                justifyContent: { xs: 'center', sm: 'flex-start' },
              }}
            >
              <Chip
                icon={<ArticleIcon />}
                label={`${user._count.posts} 投稿`}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<GroupIcon />}
                label={`${user._count.followers} フォロワー`}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<PersonIcon />}
                label={`${user._count.following} フォロー中`}
                size="small"
                variant="outlined"
              />
            </Box>
          )}

          {user.followedAt && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 1,
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              {new Date(user.followedAt).toLocaleDateString('ja-JP')}
              からフォロー
            </Typography>
          )}
        </CardContent>
      </CardActionArea>

      {showFollowButton && !isOwnProfile && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: { xs: 2, sm: 0 },
            pb: { xs: 2, sm: 0 },
          }}
        >
          <FollowButton
            userId={user.id}
            onFollowChange={onFollowChange}
            fullWidth
          />
        </Box>
      )}
    </Card>
  );
}
