'use client';

import { Box, Container, Paper, Typography } from '@mui/material';
import React from 'react';

export default function About() {
  return (
    <Box
      component="main"
      sx={{
        bgcolor: 'background.default',
        minHeight: '100vh',
        mt: '9vh',
      }}
    >
      {/* ヒーローセクション */}
      <Box
        sx={{
          position: 'relative',
          height: '40vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          mb: 6,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0 0 0 / 0.4)',
            },
          }}
        >
          <Box
            component="img"
            src="/top.jpg"
            alt="旅の風景"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
        <Typography
          variant="h2"
          component="h1"
          sx={{
            color: 'white',
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            fontWeight: 500,
            textShadow: '2px 2px 4px rgba(0 0 0 / 0.5)',
          }}
        >
          Nokoroaについて
        </Typography>
      </Box>

      <Container maxWidth="lg">
        {/* メインコンテンツ */}
        <Box sx={{ display: 'grid', gap: 4 }}>
          {/* 概要セクション */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: '0 4px 6px rgba(0 0 0 / 0.1)',
              }}
            >
              <Typography
                variant="h4"
                component="h2"
                gutterBottom
                sx={{
                  fontWeight: 500,
                  mb: 3,
                  color: 'text.primary',
                }}
              >
                旅の思い出を、永遠に
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: '1.1rem',
                  lineHeight: 1.8,
                  color: 'text.primary',
                }}
              >
                Nokoroaは、あなたの心に刻まれた旅の思い出を、より深く、より特別なものにするためのアプリケーションです。
                写真やメモを残すだけでなく、その場所での感動や想いを記録することで、
                心に残る思い出として永遠に残すことができます。
              </Typography>
            </Paper>
          </Box>

          {/* 機能と使い方セクション */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 4,
            }}
          >
            {/* 機能セクション */}
            <Box>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  height: '100%',
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: '0 4px 6px rgba(0 0 0 / 0.1)',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <Typography
                  variant="h5"
                  component="h3"
                  gutterBottom
                  sx={{
                    fontWeight: 500,
                    mb: 3,
                    color: 'primary.main',
                  }}
                >
                  主な機能
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <FeatureItem>
                    ユーザー登録 / ログイン（Email認証）
                  </FeatureItem>
                  <FeatureItem>
                    旅行記の投稿（タイトル・本文・写真アップロード）
                  </FeatureItem>
                  <FeatureItem>投稿への「いいね」機能</FeatureItem>
                  <FeatureItem>旅行計画やプランの共有機能</FeatureItem>
                  <FeatureItem>投稿へのコメント機能</FeatureItem>
                  <FeatureItem>位置情報の紐付けと地図表示</FeatureItem>
                  <FeatureItem>
                    タグ付け機能（#絶景 #グルメ #温泉など）
                  </FeatureItem>
                  <FeatureItem>
                    プロフィール管理（自己紹介、投稿一覧、プロフィール画像）
                  </FeatureItem>
                  <FeatureItem>他ユーザーのプロフィール閲覧</FeatureItem>
                  <FeatureItem>フォロー・フォロワー機能</FeatureItem>
                  <FeatureItem>
                    検索機能（タグ、位置情報、キーワード）
                  </FeatureItem>
                  <FeatureItem>投稿の編集・削除機能</FeatureItem>
                  <FeatureItem>ログインユーザー専用機能</FeatureItem>
                  <FeatureItem>
                    レスポンシブ対応（スマホ・PC両対応）
                  </FeatureItem>
                </Box>
              </Paper>
            </Box>

            {/* 使い方セクション */}
            <Box>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  height: '100%',
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: '0 4px 6px rgba(0 0 0 / 0.1)',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <Typography
                  variant="h5"
                  component="h3"
                  gutterBottom
                  sx={{
                    fontWeight: 500,
                    mb: 3,
                    color: 'primary.main',
                  }}
                >
                  使い方
                </Typography>
                <Box component="ol" sx={{ pl: 2 }}>
                  <FeatureItem>
                    Emailアドレスでアカウントを作成し、ログイン
                  </FeatureItem>
                  <FeatureItem>
                    プロフィール画像を設定し、自己紹介を記入
                  </FeatureItem>
                  <FeatureItem>
                    新しい旅行記を投稿（タイトル、本文、写真、位置情報、タグを設定）
                  </FeatureItem>
                  <FeatureItem>
                    旅行計画がある場合は、投稿にプラン情報を追加
                  </FeatureItem>
                  <FeatureItem>
                    他のユーザーの投稿を閲覧し、いいねやコメントで交流
                  </FeatureItem>
                  <FeatureItem>
                    気になるユーザーをフォローして、最新の投稿をチェック
                  </FeatureItem>
                  <FeatureItem>
                    タグや位置情報、キーワードで旅行記を検索
                  </FeatureItem>
                  <FeatureItem>
                    自分の投稿はいつでも編集・削除が可能
                  </FeatureItem>
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* 開発の背景セクション */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: '0 4px 6px rgba(0 0 0 / 0.1)',
              }}
            >
              <Typography
                variant="h5"
                component="h3"
                gutterBottom
                sx={{
                  fontWeight: 500,
                  mb: 3,
                  color: 'primary.main',
                }}
              >
                開発の背景
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: '1.1rem',
                  lineHeight: 1.8,
                  color: 'text.primary',
                }}
              >
                私たちは、旅の思い出をより豊かに残したいという想いから、
                このアプリケーションの開発を始めました。
                単なる写真アルバムではなく、その時の感情や体験まで含めた
                より深い思い出の記録を可能にすることで、
                旅の体験をより特別なものにしたいと考えています。
              </Typography>
            </Paper>
          </Box>

          {/* お問い合わせセクション */}
          <Box sx={{ mb: 4 }}>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: '0 4px 6px rgba(0 0 0 / 0.1)',
              }}
            >
              <Typography
                variant="h5"
                component="h3"
                gutterBottom
                sx={{
                  fontWeight: 500,
                  mb: 3,
                  color: 'primary.main',
                }}
              >
                お問い合わせ
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: '1.1rem',
                  color: 'text.primary',
                }}
              >
                サービスに関するお問い合わせは、
                <Box
                  component="span"
                  sx={{
                    fontWeight: 'bold',
                    color: 'primary.main',
                    mx: 1,
                  }}
                >
                  support.nokoroa@gmail.com
                </Box>
                までご連絡ください。
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/*                               補助コンポーネント                            */
/* -------------------------------------------------------------------------- */

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="li"
      sx={{
        mb: 2,
        fontSize: '1.1rem',
        lineHeight: 1.6,
        color: 'text.primary',
        '&:last-child': { mb: 0 },
      }}
    >
      {children}
    </Typography>
  );
}
