'use client';

import {
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material';
import { Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { checkFollowStatus, followUser, unfollowUser } from '@/lib/follows';
import { useAuth } from '@/providers/AuthProvider';

interface FollowButtonProps {
  userId: number;
  initialFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export default function FollowButton({
  userId,
  initialFollowing = false,
  onFollowChange,
  size = 'medium',
  fullWidth = false,
}: FollowButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      if (!isAuthenticated) {
        setChecking(false);
        return;
      }

      try {
        const status = await checkFollowStatus(userId);
        setIsFollowing(status.isFollowing);
      } catch {
        // フォロー状態の確認に失敗した場合の処理
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
  }, [userId, isAuthenticated]);

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      toast.error('フォローするにはログインが必要です');
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        toast.success('フォローを解除しました');
        onFollowChange?.(false);
      } else {
        await followUser(userId);
        setIsFollowing(true);
        toast.success('フォローしました');
        onFollowChange?.(true);
      }
    } catch (error) {
      // フォロー操作が失敗した場合の処理
      toast.error(
        error instanceof Error ? error.message : 'エラーが発生しました',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Button
        variant="contained"
        color="primary"
        size={size}
        fullWidth={fullWidth}
        startIcon={<PersonAddIcon />}
        onClick={() => {
          toast.error('フォローするにはログインが必要です');
          router.push('/login');
        }}
      >
        フォロー
      </Button>
    );
  }

  if (checking) {
    return (
      <Button variant="outlined" size={size} fullWidth={fullWidth} disabled>
        <CircularProgress size={20} />
      </Button>
    );
  }

  return (
    <Button
      variant={isFollowing ? 'outlined' : 'contained'}
      color={isFollowing ? 'inherit' : 'primary'}
      size={size}
      fullWidth={fullWidth}
      startIcon={
        loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : isFollowing ? (
          <PersonRemoveIcon />
        ) : (
          <PersonAddIcon />
        )
      }
      onClick={handleFollowToggle}
      disabled={loading}
      sx={{
        transition: 'all 0.3s ease',
        borderRadius: 8,
        textTransform: 'none',
        fontWeight: 500,
        ...(isFollowing
          ? {
              '&:hover': {
                borderColor: 'error.main',
                color: 'error.main',
                backgroundColor: 'error.light',
                bgcolor: 'rgba(211, 47, 47, 0.04)',
              },
            }
          : {
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 8px rgba(25, 118, 210, 0.25)',
              },
            }),
      }}
    >
      {isFollowing ? 'フォロー中' : 'フォロー'}
    </Button>
  );
}
