'use client';

import { Box, Button, Paper, Typography } from '@mui/material';
import NextLink from 'next/link';

import { ChatMessage } from '@/hooks/useChatStream';

import ChatPostCard from './ChatPostCard';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export default function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  return (
    <Box sx={{ maxWidth: '80%' }}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          bgcolor:
            message.role === 'user' ? 'primary.main' : 'background.paper',
          color:
            message.role === 'user' ? 'primary.contrastText' : 'text.primary',
          borderRadius: 2,
          borderColor: message.role === 'user' ? 'primary.main' : 'divider',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
          }}
        >
          {message.content}
        </Typography>
        {message.needsLogin && (
          <Button
            component={NextLink}
            href="/login"
            size="small"
            variant="contained"
            color="primary"
            sx={{ mt: 1, textTransform: 'none' }}
          >
            ログインページへ
          </Button>
        )}
      </Paper>
      {message.relatedPosts && message.relatedPosts.length > 0 && (
        <Box
          sx={{
            mt: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
            関連する投稿
          </Typography>
          {message.relatedPosts.map((post) => (
            <ChatPostCard key={post.id} post={post} />
          ))}
        </Box>
      )}
    </Box>
  );
}
