'use client';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import SecurityIcon from '@mui/icons-material/Security';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import Link from 'next/link';

import { PageSpinner } from '@/components/common/PageSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useUser } from '@/hooks/useUser';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: SettingsItem[];
}

/** 遷移先を持つ項目のみを扱う。保存先のない飾りのトグルは置かない */
interface SettingsItem {
  id: string;
  title: string;
  description: string;
  href: string;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'account',
    title: 'アカウント',
    icon: <AccountCircleIcon />,
    items: [
      {
        id: 'profile-edit',
        title: 'プロフィール編集',
        description: 'プロフィール情報を編集',
        href: '/profile/edit',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'プライバシー',
    icon: <PrivacyTipIcon />,
    items: [
      {
        id: 'privacy-policy',
        title: 'プライバシーポリシー',
        description: 'プライバシーポリシーを確認',
        href: '/privacy',
      },
      {
        id: 'terms',
        title: '利用規約',
        description: '利用規約を確認',
        href: '/terms',
      },
    ],
  },
  {
    id: 'security',
    title: 'セキュリティ',
    icon: <SecurityIcon />,
    items: [
      {
        id: 'password-change',
        title: 'パスワード変更',
        description: 'アカウントのパスワードを変更',
        href: '/settings/change-password',
      },
    ],
  },
];

export default function SettingsPage() {
  const { isAuthLoading, isReady } = useRequireAuth();
  const { user, isLoading, error } = useUser();

  if (!isReady && !isAuthLoading) {
    return null;
  }

  if (isAuthLoading || isLoading) {
    return <PageSpinner />;
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" sx={{ mb: 4 }}>
        設定
      </Typography>

      {user && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              アカウント情報
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ユーザー名: {user.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              メールアドレス: {user.email}
            </Typography>
          </CardContent>
        </Card>
      )}

      {SETTINGS_SECTIONS.map((section) => (
        <Card key={section.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {section.icon}
              <Typography variant="h6" sx={{ ml: 1 }}>
                {section.title}
              </Typography>
            </Box>

            <List disablePadding>
              {section.items.map((item, itemIndex) => (
                <Box key={item.id}>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} href={item.href}>
                      <ListItemText
                        primary={item.title}
                        secondary={item.description}
                      />
                    </ListItemButton>
                  </ListItem>
                  {itemIndex < section.items.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>
      ))}
    </Container>
  );
}
