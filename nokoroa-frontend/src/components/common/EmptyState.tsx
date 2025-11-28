import { Box, Typography } from '@mui/material';
import React from 'react';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  sx?: object;
}

export default function EmptyState({
  message,
  icon,
  sx = { py: 8 },
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        animation: 'fadeIn 0.5s ease-out',
        '@keyframes fadeIn': {
          from: {
            opacity: 0,
            transform: 'translateY(10px)',
          },
          to: {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
        ...sx,
      }}
    >
      {icon && (
        <Box
          sx={{
            mb: 3,
            '& > *': {
              fontSize: '3rem',
              color: 'text.secondary',
              opacity: 0.5,
            },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography
        variant="h6"
        color="text.secondary"
        sx={{
          fontWeight: 400,
          letterSpacing: '0.5px',
        }}
      >
        {message}
      </Typography>
    </Box>
  );
}
