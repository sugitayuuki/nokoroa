'use client';

import { Box, Container, Paper, Typography } from '@mui/material';
import React from 'react';

import { useAuth } from '@/providers/AuthProvider';

export default function Terms() {
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
            利用規約
          </Typography>

          <Typography variant="body1" sx={{ mb: 4, color: 'text.primary' }}>
            本規約は、Nokoroa（以下「当サービス」）の利用条件を定めるものです。
            ユーザーは本規約に同意の上、当サービスを利用するものとします。
          </Typography>

          <Section title="第1条（適用）">
            本規約は、当サービスの利用に関する一切の関係に適用されるものとします。
          </Section>

          <Section title="第2条（利用登録）">
            当サービスの利用を希望する者は、本規約に同意の上、当サービスが定める方法により利用登録を申請し、
            当サービスがこれを承認することによって利用登録が完了するものとします。
          </Section>

          <Section title="第3条（禁止事項）">
            ユーザーは、以下の行為をしてはなりません：
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <li>法令または公序良俗に違反する行為</li>
              <li>当サービスの運営を妨害する行為</li>
              <li>他のユーザーに迷惑をかける行為</li>
              <li>当サービスの知的財産権を侵害する行為</li>
            </Box>
          </Section>

          <Section title="第4条（当サービスの提供の停止等）">
            当サービスは、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく
            当サービスの全部または一部の提供を停止または中断することができるものとします：
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <li>
                当サービスにかかるコンピュータシステムの保守点検または更新を行う場合
              </li>
              <li>
                地震、落雷、火災、停電または天災などの不可抗力により、当サービスの提供が困難となった場合
              </li>
              <li>その他、当サービスが当サービスの提供が困難と判断した場合</li>
            </Box>
          </Section>

          <Section title="第5条（免責事項）">
            当サービスは、当サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、
            連絡または紛争等について一切責任を負いません。
          </Section>

          <Section title="第6条（サービス内容の変更等）">
            当サービスは、ユーザーに通知することなく、本サービス内容を変更しまたは本サービスの提供を中止することができるものとし、
            これによってユーザーに生じた損害について一切の責任を負いません。
          </Section>

          <Section title="第7条（利用規約の変更）">
            当サービスは、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。
            なお、本規約の変更の際は、変更後の規約の内容を当サービス上に掲載するものとします。
          </Section>

          <Section title="第8条（通知または連絡）">
            ユーザーと当サービスとの間の通知または連絡は、当サービスの定める方法によって行うものとします。
            当サービスは、ユーザーから、当サービスが定める方法に従った変更の届け出がない限り、
            現在登録されている連絡先が有効なものとみなして当該連絡先へ通知または連絡を行い、
            これらは、発信時にユーザーへ到達したものとみなします。
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
