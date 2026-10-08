import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

interface PageSpinnerProps {
  /**
   * `page`: 画面全体がまだ描けない状態。縦方向に 50vh 取って中央へ置く。
   * `inline`: 一覧の末尾など、既にコンテンツがある中での追加読み込み。
   */
  variant?: 'page' | 'inline';
}

/**
 * 「読み込み中」の中央寄せスピナー。
 *
 * 同じ Box + sx が 12 ファイルに逐語コピーされていたため集約した。
 * ページ本体のロジックを読む前に毎回同じ 10 行を読み飛ばす必要があり、
 * デザインを変えるときの修正漏れ箇所も同数あった。
 */
export const PageSpinner = ({ variant = 'page' }: PageSpinnerProps) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      ...(variant === 'page' ? { minHeight: '50vh' } : { py: 4 }),
    }}
  >
    <CircularProgress />
  </Box>
);
