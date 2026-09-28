'use client';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
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

import { MAX_INPUT_LENGTH, useChatStream } from '@/hooks/useChatStream';
import { isComposingEvent } from '@/utils/ime';

import ChatMessageBubble from './ChatMessageBubble';
import TypingIndicator from './TypingIndicator';

interface ChatPanelProps {
  isOpen: boolean;
}

type PanelSize = 'small' | 'medium' | 'large';

const MotionPaper = motion.create(Paper);
const MotionBox = motion.create(Box);

const SUGGESTIONS = ['京都 2泊3日', '沖縄 おすすめ', '温泉旅行', '週末旅行'];

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
    [isMobile],
  );

  const [panelSize, setPanelSize] = useState<PanelSize>('medium');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const {
    messages,
    input,
    setInput,
    isLoading,
    isResponding,
    dynamicSuggestions,
    sendMessage,
    stopResponding,
  } = useChatStream({ isOpen, scrollToBottom });

  const handleToggleSize = () => {
    setPanelSize((prev) => {
      if (prev === 'small') return 'medium';
      if (prev === 'medium') return 'large';
      return 'small';
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 日本語入力の変換確定 Enter で送信してしまうのを防ぐ
    if (isComposingEvent(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const currentSize = panelSizes[panelSize];
  const activeSuggestions =
    dynamicSuggestions.length > 0 ? dynamicSuggestions : SUGGESTIONS;
  const showSuggestions =
    (messages.length <= 2 || dynamicSuggestions.length > 0) && !isResponding;

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
                  <ChatMessageBubble message={message} />
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
                disabled={isResponding}
                multiline
                maxRows={3}
                slotProps={{ htmlInput: { maxLength: MAX_INPUT_LENGTH } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
              {isResponding ? (
                <Tooltip title="停止">
                  <IconButton
                    color="primary"
                    onClick={stopResponding}
                    aria-label="応答を停止"
                    sx={{
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    }}
                  >
                    <StopIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <IconButton
                  color="primary"
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  aria-label="送信"
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
              )}
            </Box>
          </Box>
        </MotionPaper>
      )}
    </AnimatePresence>
  );
}
