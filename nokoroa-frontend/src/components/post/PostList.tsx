'use client';

import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';

import { formatDistanceToNow } from '@/utils/dateFormat';
import { getTagColor } from '@/utils/tagColors';

import { PostData } from '../../types/post';
import BookmarkButton from '../bookmarks/BookmarkButton';

interface PostListProps {
  posts: PostData[];
  isLoading: boolean;
  error?: Error;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  lastElementRef?: (node: HTMLDivElement) => void;
  onLoadMore?: () => void;
}

const PostCard = ({ post }: { post: PostData }) => {
  const router = useRouter();

  const handleCardClick = () => {
    router.push(`/posts/${post.id}`);
  };

  return (
    <Box>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          overflow: 'hidden',
          minWidth: 320,
          maxWidth: 400,
          mx: 'auto',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <Box
          onClick={handleCardClick}
          sx={{
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
          }}
        >
          <CardMedia
            component="img"
            height="280"
            image={post.imageUrl || '/top.jpg'}
            alt={post.title}
          />
          <CardContent sx={{ flexGrow: 1, bgcolor: 'background.paper' }}>
            <Stack spacing={2}>
              <Box>
                <Typography
                  variant="h6"
                  component="h2"
                  gutterBottom
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                  }}
                >
                  {post.title}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {formatDistanceToNow(post.createdAt)}
                </Typography>
              </Box>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {post.content}
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: 'wrap', gap: 1 }}
              >
                {post.location && (
                  <Chip
                    icon={<LocationOnIcon />}
                    label={post.location}
                    size="small"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    sx={{
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      cursor: 'default',
                    }}
                  />
                )}
                {(post.tags || []).map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag.startsWith('#') ? tag : `#${tag}`}
                    size="small"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/search?tags=${encodeURIComponent(tag)}`);
                    }}
                    sx={{
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
              </Stack>
            </Stack>
          </CardContent>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            pb: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              src={post.author.avatar || undefined}
              sx={{ width: 32, height: 32 }}
            >
              {!post.author.avatar && post.author.name?.charAt(0)}
            </Avatar>
            <Typography variant="body2" color="text.secondary">
              {post.author.name}
            </Typography>
          </Box>
          <BookmarkButton
            postId={post.id}
            initialBookmarkCount={
              post.favoritesCount || post._count?.favorites || 0
            }
            size="small"
          />
        </Box>
      </Card>
    </Box>
  );
};

export const PostList = ({
  posts,
  isLoading,
  error,
  isLoadingMore = false,
  lastElementRef,
  onLoadMore: _onLoadMore,
}: PostListProps) => {
  if (isLoading && posts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        投稿の読み込み中にエラーが発生しました。
      </Alert>
    );
  }

  if (posts.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          投稿がありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(3, 1fr)',
          },
          gap: 4,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {posts.map((post, index) => (
          <div
            key={post.id}
            ref={
              index === posts.length - 1 && lastElementRef
                ? lastElementRef
                : null
            }
          >
            <PostCard post={post} />
          </div>
        ))}
      </Box>

      {isLoadingMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, py: 4 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};
