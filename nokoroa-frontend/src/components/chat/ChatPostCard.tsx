'use client';

import LocationOnIcon from '@mui/icons-material/LocationOn';
import { Box, Chip, Paper, Typography } from '@mui/material';
import { PostData } from '@/types/post';
import { getTagColor } from '@/utils/tagColors';

interface ChatPostCardProps {
  post: PostData;
}

export default function ChatPostCard({ post }: ChatPostCardProps) {
  const handleClick = () => {
    window.open(`/posts/${post.id}`, '_blank');
  };

  return (
    <Paper
      variant="outlined"
      onClick={handleClick}
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        '&:hover': {
          bgcolor: 'action.hover',
        },
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      {post.imageUrl && (
        <Box
          component="img"
          src={post.imageUrl}
          alt={post.title}
          sx={{
            width: 80,
            height: 80,
            objectFit: 'cover',
            borderRadius: 1,
            flexShrink: 0,
          }}
        />
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {post.title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
            mt: 0.3,
          }}
        >
          {post.content}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          {post.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {post.location}
              </Typography>
            </Box>
          )}
          {post.location && post.author && (
            <Typography variant="caption" color="text.secondary">
              ·
            </Typography>
          )}
          {post.author && (
            <Typography variant="caption" color="text.secondary">
              {post.author.name}
            </Typography>
          )}
        </Box>
        {post.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {post.tags.slice(0, 3).map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  backgroundColor: getTagColor(tag),
                  color: '#fff',
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
