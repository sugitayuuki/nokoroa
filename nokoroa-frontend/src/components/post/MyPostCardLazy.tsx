import { Box, Skeleton } from '@mui/material';
import dynamic from 'next/dynamic';

import { GRID_LAYOUT } from '@/constants/theme';

// MyPostListコンポーネントを動的インポート
export const MyPostListLazy = dynamic(
  () => import('./MyPostCard').then((mod) => ({ default: mod.MyPostList })),
  {
    loading: () => (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID_LAYOUT,
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
