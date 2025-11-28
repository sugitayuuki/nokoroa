import { Alert, AlertTitle } from '@mui/material';

interface ErrorAlertProps {
  message?: string;
  title?: string;
  sx?: object;
}

export default function ErrorAlert({
  message = 'エラーが発生しました。',
  title,
  sx = { mb: 2 },
}: ErrorAlertProps) {
  return (
    <Alert severity="error" sx={sx}>
      {title && <AlertTitle>{title}</AlertTitle>}
      {message}
    </Alert>
  );
}
