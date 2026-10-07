'use client';

import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { Box, Chip, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/common/EmptyState';
import { PageSpinner } from '@/components/common/PageSpinner';
import { RetryableError } from '@/components/common/RetryableError';
import { useTags } from '@/hooks/useTags';
import { getTagColor } from '@/utils/tagColors';

export default function TagsPage() {
  const router = useRouter();
  const { tags, isLoading, error, refetch } = useTags();

  const handleTagClick = (tagName: string) => {
    // タグをクリックした時に検索画面に遷移
    const searchParams = new URLSearchParams();
    searchParams.set('tags', tagName);
    router.push(`/search?${searchParams.toString()}`);
  };

  if (isLoading) {
    return <PageSpinner />;
  }

  if (error) {
    return <RetryableError message={error} onRetry={refetch} />;
  }

  if (tags.length === 0) {
    return <EmptyState message="タグがありません" />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <LocalOfferIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          タグ一覧 ({tags.length}件)
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}
      >
        {tags.map((tag, index) => {
          const tagColor = getTagColor(tag.name);
          return (
            <Box key={index}>
              <Chip
                icon={<LocalOfferIcon />}
                label={`${tag.name.startsWith('#') ? tag.name : `#${tag.name}`} (${tag.count})`}
                onClick={() => handleTagClick(tag.name)}
                sx={{
                  width: '100%',
                  height: 'auto',
                  minHeight: 48,
                  bgcolor: tagColor,
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 500,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    filter: 'brightness(0.85)',
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 12px ${tagColor}40`,
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                  '& .MuiChip-icon': {
                    color: 'white',
                    fontSize: '1.2rem',
                  },
                  '& .MuiChip-label': {
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    lineHeight: 1.4,
                  },
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
