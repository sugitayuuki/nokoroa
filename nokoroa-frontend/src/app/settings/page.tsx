'use client';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import SecurityIcon from '@mui/icons-material/Security';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Switch,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/providers/AuthProvider';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  title: string;
  description: string;
  type: 'toggle' | 'link';
  value?: boolean;
  href?: string;
  onChange?: (value: boolean) => void;
}

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { user, isLoading, error } = useUser();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    profileVisible: true,
    postsVisible: true,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleToggleChange = (settingKey: string) => (value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      [settingKey]: value,
    }));
  };

  if (!isAuthenticated) {
    return null;
  }

  if (authLoading || isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const settingsSections: SettingsSection[] = [
    {
      id: 'account',
      title: 'アカウント',
      icon: <AccountCircleIcon />,
      items: [
        {
          id: 'profile-edit',
          title: 'プロフィール編集',
          description: 'プロフィール情報を編集',
          type: 'link',
          href: '/profile/edit',
        },
      ],
    },
    {
      id: 'notifications',
      title: '通知',
      icon: <NotificationsIcon />,
      items: [
        {
          id: 'email-notifications',
          title: 'メール通知',
          description: '新しいいいねやコメントをメールで通知',
          type: 'toggle',
          value: settings.emailNotifications,
          onChange: handleToggleChange('emailNotifications'),
        },
        {
          id: 'push-notifications',
          title: 'プッシュ通知',
          description: 'ブラウザのプッシュ通知を有効にする',
          type: 'toggle',
          value: settings.pushNotifications,
          onChange: handleToggleChange('pushNotifications'),
        },
      ],
    },
    {
      id: 'privacy',
      title: 'プライバシー',
      icon: <PrivacyTipIcon />,
      items: [
        {
          id: 'profile-visible',
          title: 'プロフィール公開',
          description: '他のユーザーにプロフィールを表示',
          type: 'toggle',
          value: settings.profileVisible,
          onChange: handleToggleChange('profileVisible'),
        },
        {
          id: 'posts-visible',
          title: '投稿の公開設定',
          description: 'デフォルトで投稿を公開する',
          type: 'toggle',
          value: settings.postsVisible,
          onChange: handleToggleChange('postsVisible'),
        },
        {
          id: 'privacy-policy',
          title: 'プライバシーポリシー',
          description: 'プライバシーポリシーを確認',
          type: 'link',
          href: '/privacy',
        },
        {
          id: 'terms',
          title: '利用規約',
          description: '利用規約を確認',
          type: 'link',
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
          type: 'link',
          href: '/settings/change-password',
        },
      ],
    },
  ];

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

      {settingsSections.map((section) => (
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
                  {item.type === 'link' ? (
                    <ListItem disablePadding>
                      <ListItemButton
                        component={item.href?.startsWith('#') ? 'button' : Link}
                        href={
                          item.href?.startsWith('#') ? undefined : item.href
                        }
                        onClick={
                          item.href?.startsWith('#') ? () => {} : undefined
                        }
                      >
                        <ListItemText
                          primary={item.title}
                          secondary={item.description}
                        />
                      </ListItemButton>
                    </ListItem>
                  ) : (
                    <ListItem>
                      <ListItemText
                        primary={item.title}
                        secondary={item.description}
                      />
                      <Switch
                        edge="end"
                        checked={item.value || false}
                        onChange={(event) => {
                          if (item.onChange) {
                            item.onChange(event.target.checked);
                          }
                        }}
                      />
                    </ListItem>
                  )}
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
