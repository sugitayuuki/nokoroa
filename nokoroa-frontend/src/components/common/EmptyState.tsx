import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

interface EmptyStateProps {
  message: string;
  description?: string;
  /** グリッド内に置く場合の `gridColumn: '1 / -1'` などを渡す */
  sx?: SxProps<Theme>;
}

/** 「該当なし」の中央寄せ表示。8 箇所に逐語コピーされていたため集約した。 */
export const EmptyState = ({ message, description, sx }: EmptyStateProps) => (
  <Box sx={{ p: 4, textAlign: 'center', ...sx }}>
    <Typography variant="h6" color="text.secondary">
      {message}
    </Typography>
    {description && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {description}
      </Typography>
    )}
  </Box>
);
