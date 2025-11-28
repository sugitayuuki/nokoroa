'use client';

import { Box, Container, Paper, Typography } from '@mui/material';

import { useAuth } from '@/providers/AuthProvider';

export default function Privacy() {
  const { isAuthenticated } = useAuth();

  return (
    <Box
      component="main"
      sx={{
        bgcolor: 'background.default',
        minHeight: isAuthenticated ? 'calc(100vh - 9vh)' : '100vh',
        mt: '9vh',
        pb: isAuthenticated ? 0 : 4,
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'background.default',
          zIndex: -1,
        },
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: 4,
            my: 4,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: '0 4px 6px rgba(0 0 0 / 0.1)',
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 500,
              mb: 4,
              color: 'text.primary',
            }}
          >
            プライバシーポリシー
          </Typography>

          <Typography variant="body1" sx={{ mb: 4, color: 'text.primary' }}>
            本プライバシーポリシーは、Nokoroa（以下「当サービス」）における個人情報の取り扱いについて定めるものです。
          </Typography>

          <Section title="第1条（個人情報の収集）">
            当サービスは、以下の情報を収集する場合があります：
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <li>メールアドレス</li>
              <li>ユーザー名</li>
              <li>プロフィール画像</li>
              <li>旅の記録に関する情報</li>
            </Box>
          </Section>

          <Section title="第2条（個人情報の利用目的）">
            当サービスは、収集した個人情報を以下の目的で利用します：
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <li>サービスの提供・運営</li>
              <li>ユーザーサポート</li>
              <li>サービスの改善</li>
              <li>セキュリティの確保</li>
            </Box>
          </Section>

          <Section title="第3条（個人情報の管理）">
            当サービスは、個人情報の漏洩、滅失、毀損を防止するため、適切なセキュリティ対策を実施します。
          </Section>

          <Section title="第4条（個人情報の第三者提供）">
            当サービスは、以下の場合を除き、個人情報を第三者に提供することはありません：
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <li>法令に基づく場合</li>
              <li>ユーザーの同意がある場合</li>
              <li>統計的な情報として、個人を特定できない形式で提供する場合</li>
            </Box>
          </Section>

          <Section title="第5条（個人情報の開示・訂正・削除）">
            ユーザーは、当サービスが保有する個人情報の開示、訂正、削除を請求することができます。
            請求があった場合は、合理的な範囲で対応いたします。
          </Section>

          <Section title="第6条（プライバシーポリシーの変更）">
            当サービスは、必要に応じて本プライバシーポリシーを変更することがあります。
            変更があった場合は、当サービス上で通知します。
          </Section>

          <Typography variant="body2" sx={{ mt: 4, color: 'text.secondary' }}>
            制定日：2025年6月8日
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h6"
        component="h2"
        gutterBottom
        sx={{
          fontWeight: 500,
          color: 'primary.main',
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body1"
        component="div"
        sx={{ color: 'text.primary' }}
      >
        {children}
      </Typography>
    </Box>
  );
}
