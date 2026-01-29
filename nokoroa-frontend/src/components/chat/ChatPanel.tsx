'use client';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SendIcon from '@mui/icons-material/Send';
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PostData } from '@/types/post';
import ChatPostCard from './ChatPostCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  relatedPosts?: PostData[];
}

interface ChatPanelProps {
  isOpen: boolean;
}

type PanelSize = 'small' | 'medium' | 'large';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const MotionPaper = motion.create(Paper);
const MotionBox = motion.create(Box);

const SUGGESTIONS = [
  '京都 2泊3日',
  '沖縄 おすすめ',
  '温泉旅行',
  '週末旅行',
];

function TypingIndicator() {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, pl: 1 }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#888',
          }}
          animate={{
            y: [0, -4, 0],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </Box>
  );
}

export default function ChatPanel({ isOpen }: ChatPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark = theme.palette.mode === 'dark';

  const panelSizes = useMemo(
    () => ({
      small: {
        width: isMobile ? window.innerWidth - 48 : 320,
        height: isMobile ? 350 : 400,
      },
      medium: {
        width: isMobile ? window.innerWidth - 48 : 380,
        height: isMobile ? 400 : 480,
      },
      large: {
        width: isMobile ? window.innerWidth - 48 : 550,
        height: isMobile ? 450 : 550,
      },
    }),
    [isMobile]
  );

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'こんにちは！Sora AIです。旅行の相談があればお気軽にどうぞ！',
      id: 'initial',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [panelSize, setPanelSize] = useState<PanelSize>('medium');
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleToggleSize = () => {
    setPanelSize((prev) => {
      if (prev === 'small') return 'medium';
      if (prev === 'medium') return 'large';
      return 'small';
    });
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage = textToSend;
    setInput('');
    setDynamicSuggestions([]);
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, id: userMsgId }]);
    setIsLoading(true);

    setTimeout(scrollToBottom, 100);

    try {
      const history = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        content: msg.content,
      }));

      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: '', id: assistantMsgId }]);
      setIsLoading(false);

      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            if (data.startsWith('[ERROR]')) {
              throw new Error(data);
            }
            fullResponse += data;
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, content: lastMessage.content + data },
                ];
              }
              return prev;
            });
            setTimeout(scrollToBottom, 10);
          }
        }
      }

      if (fullResponse) {
        const requestBody = JSON.stringify({
          message: userMessage,
          ai_response: fullResponse,
        });
        const headers = { 'Content-Type': 'application/json' };

        const [suggestionsResult, relatedPostsResult] = await Promise.allSettled([
          fetch(`${API_URL}/api/chat/suggestions`, {
            method: 'POST',
            headers,
            body: requestBody,
          }).then((res) => (res.ok ? res.json() : null)),
          fetch(`${API_URL}/api/chat/related-posts`, {
            method: 'POST',
            headers,
            body: requestBody,
          }).then((res) => (res.ok ? res.json() : null)),
        ]);

        if (
          suggestionsResult.status === 'fulfilled' &&
          suggestionsResult.value?.suggestions?.length > 0
        ) {
          setDynamicSuggestions(suggestionsResult.value.suggestions);
        }

        if (
          relatedPostsResult.status === 'fulfilled' &&
          relatedPostsResult.value?.posts?.length > 0
        ) {
          const posts = relatedPostsResult.value.posts as PostData[];
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, relatedPosts: posts },
              ];
            }
            return prev;
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.content === '') {
          return [
            ...prev.slice(0, -1),
            {
              role: 'assistant',
              content: '申し訳ありません。エラーが発生しました。もう一度お試しください。',
              id: `error-${Date.now()}`,
            },
          ];
        }
        return [
          ...prev,
          {
            role: 'assistant',
            content: '申し訳ありません。エラーが発生しました。もう一度お試しください。',
            id: `error-${Date.now()}`,
          },
        ];
      });
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const currentSize = panelSizes[panelSize];
  const activeSuggestions = dynamicSuggestions.length > 0 ? dynamicSuggestions : SUGGESTIONS;
  const showSuggestions = (messages.length <= 2 || dynamicSuggestions.length > 0) && !isLoading;

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionPaper
          elevation={4}
          initial={{
            opacity: 0,
            y: 50,
            scale: 0.95,
            width: currentSize.width,
            height: currentSize.height,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            width: currentSize.width,
            height: currentSize.height,
          }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            width: { type: 'spring', stiffness: 300, damping: 30 },
            height: { type: 'spring', stiffness: 300, damping: 30 },
          }}
          sx={{
            position: 'fixed',
            bottom: 88,
            right: 24,
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1299,
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              p: 1.5,
              px: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={500}>
                Sora AI
              </Typography>
            </Box>
            <Tooltip
              title={
                panelSize === 'large'
                  ? '縮小'
                  : panelSize === 'medium'
                    ? '拡大'
                    : '標準サイズ'
              }
            >
              <IconButton
                size="small"
                onClick={handleToggleSize}
                sx={{ color: 'primary.contrastText' }}
              >
                {panelSize === 'large' ? (
                  <CloseFullscreenIcon fontSize="small" />
                ) : (
                  <OpenInFullIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              bgcolor: isDark ? 'background.default' : 'grey.50',
            }}
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MotionBox
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  sx={{
                    display: 'flex',
                    justifyContent:
                      message.role === 'user' ? 'flex-end' : 'flex-start',
                    gap: 1,
                  }}
                >
                  {message.role === 'assistant' && (
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                      }}
                    >
                      <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                  )}
                  <Box sx={{ maxWidth: '80%' }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                        color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
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
                    </Paper>
                    {message.relatedPosts && message.relatedPosts.length > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                          関連する投稿
                        </Typography>
                        {message.relatedPosts.map((post) => (
                          <ChatPostCard key={post.id} post={post} />
                        ))}
                      </Box>
                    )}
                  </Box>
                </MotionBox>
              ))}
            </AnimatePresence>

            {isLoading && (
              <MotionBox
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
              >
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: 28,
                    height: 28,
                  }}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Paper
                  variant="outlined"
                  sx={{
                    py: 1,
                    px: 1.5,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                  }}
                >
                  <TypingIndicator />
                </Paper>
              </MotionBox>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Suggestions */}
          {showSuggestions && (
            <Box
              sx={{
                px: 2,
                pb: 1,
                pt: 0.5,
                display: 'flex',
                gap: 0.5,
                flexWrap: 'wrap',
                bgcolor: isDark ? 'background.default' : 'grey.50',
              }}
            >
              {activeSuggestions.map((suggestion) => (
                <Chip
                  key={suggestion}
                  label={suggestion}
                  size="small"
                  variant="outlined"
                  onClick={() => handleSuggestionClick(suggestion)}
                  sx={{
                    fontSize: '0.75rem',
                    height: 26,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                />
              ))}
            </Box>
          )}

          {/* Input */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'flex-end',
              }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="メッセージを入力..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                multiline
                maxRows={3}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
              <IconButton
                color="primary"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '&:disabled': {
                    bgcolor: 'action.disabledBackground',
                    color: 'action.disabled',
                  },
                }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </MotionPaper>
      )}
    </AnimatePresence>
  );
}
