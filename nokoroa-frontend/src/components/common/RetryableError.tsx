import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';

interface RetryableErrorProps {
  message: string;
  onRetry: () => void;
}

/**
 * 画面そのものが描けない失敗を伝え、再試行手段を添える。
 *
 * トーストではなく Alert を使うのは、ユーザー操作への即時フィードバックでは
 * なく「この画面は今データを持てていない」という状態表示だから。
 * 操作に対する通知は toast 側の役割。
 */
export const RetryableError = ({ message, onRetry }: RetryableErrorProps) => (
  <Container maxWidth="md" sx={{ py: 4 }}>
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          再試行
        </Button>
      }
    >
      {message}
    </Alert>
  </Container>
);
