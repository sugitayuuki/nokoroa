import { Box, CircularProgress } from '@mui/material';

interface LoadingSpinnerProps {
  size?: number;
  py?: number;
}

export default function LoadingSpinner({
  size = 40,
  py = 4,
}: LoadingSpinnerProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        py,
        animation: 'fadeIn 0.3s ease-in',
        '@keyframes fadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      <CircularProgress
        size={size}
        sx={{
          color: 'primary.main',
          animationDuration: '1.4s',
        }}
      />
    </Box>
  );
}
