'use client';

import { Box } from '@mui/material';
import { motion } from 'framer-motion';

export default function TypingIndicator() {
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
