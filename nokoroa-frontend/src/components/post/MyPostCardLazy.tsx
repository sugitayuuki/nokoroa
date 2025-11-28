import { Box, Skeleton } from '@mui/material';
import dynamic from 'next/dynamic';

// MyPostListコンポーネントを動的インポート
export const MyPostCardLazy = dynamic(
  () => import('./MyPostCard').then((mod) => ({ default: mod.MyPostList })),
  {
    loading: () => (
      <Box sx={{ height: 400 }}>
        <Skeleton variant="rectangular" width="100%" height={280} />
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" width="80%" height={24} />
          <Skeleton variant="text" width="60%" height={16} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="100%" height={60} sx={{ mt: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Skeleton variant="rounded" width={60} height={24} />
            <Skeleton variant="rounded" width={80} height={24} />
          </Box>
        </Box>
      </Box>
    ),
    ssr: false,
  },
);

// MyPostListコンポーネントも動的インポート
export const MyPostListLazy = dynamic(
  () => import('./MyPostCard').then((mod) => ({ default: mod.MyPostList })),
  {
    loading: () => (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 4,
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <Box key={index} sx={{ height: 400 }}>
            <Skeleton variant="rectangular" width="100%" height={280} />
            <Box sx={{ p: 2 }}>
              <Skeleton variant="text" width="80%" height={24} />
              <Skeleton variant="text" width="60%" height={16} sx={{ mt: 1 }} />
              <Skeleton
                variant="text"
                width="100%"
                height={60}
                sx={{ mt: 2 }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    ),
    ssr: false,
  },
);
