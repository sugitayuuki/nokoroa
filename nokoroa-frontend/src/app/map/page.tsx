'use client';

import LocationOnIcon from '@mui/icons-material/LocationOn';
import LockIcon from '@mui/icons-material/Lock';
import MapIcon from '@mui/icons-material/Map';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { API_CONFIG } from '@/lib/apiConfig';
import { formatDistanceToNow } from '@/utils/dateFormat';

import { GoogleMap } from '../../components/map/GoogleMap';
import { PostDetail } from '../../components/post/PostDetail';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAuth } from '../../providers/AuthProvider';
import { PostData } from '../../types/post';
import { getTagColor } from '../../utils/tagColors';

const API_BASE_URL = API_CONFIG.BASE_URL || 'http://localhost:4000';

export default function MapPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 35.6762,
    lng: 139.6503, // Tokyo default
  });
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [ipLocation, setIpLocation] = useState<{
    lat: number;
    lng: number;
    city?: string;
    country?: string;
    accuracy?: string;
  } | null>(null);

  // 投稿を検索（全世界のデータを取得）
  const searchPosts = async (query?: string) => {
    try {
      const params = new URLSearchParams();
      if (query) {
        params.append('q', query);
      }
      params.append('limit', '100');

      const url = `${API_BASE_URL}/posts/search-by-location?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('投稿の検索に失敗しました');
      }

      const data = await response.json();
      setPosts(data.posts || []);
      return data.posts || [];
    } catch {
      setPosts([]);
      toast.error('投稿の取得に失敗しました。通信状況をご確認ください');
      return [];
    }
  };

  // IP-based位置情報を取得（ユーザー許可不要）
  const getIpLocation = async () => {
    try {
      // 無料のIP位置情報サービスを使用
      const response = await fetch('https://ipapi.co/json/');

      if (!response.ok) {
        throw new Error('IP位置情報の取得に失敗');
      }

      const data = await response.json();

      const lat = parseFloat(data.latitude);
      const lng = parseFloat(data.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const location = {
          lat,
          lng,
          city: data.city,
          country: data.country_name,
          accuracy: 'IP-based (約10-50km)',
        };

        setIpLocation(location);
        return location;
      }
      return null;
    } catch {
      return null;
    }
  };

  // 初期化処理
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      // 認証チェック完了まで待機
      if (authLoading) {
        return;
      }

      // 未認証の場合はローディングを止めて終了
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        // まずIP位置情報を取得（バックアップとして）
        const ipLoc = await getIpLocation();
        if (ipLoc && isMounted) {
          setMapCenter({ lat: ipLoc.lat, lng: ipLoc.lng });
        }

        // 高精度位置情報を試行
        if (navigator.geolocation) {
          const options = {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 300000,
          };

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              if (!isMounted) return;

              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setUserLocation(location);
              setMapCenter(location);

              // 全世界の投稿を検索
              await searchPosts();
              if (isMounted) {
                setLoading(false);
              }
            },
            async () => {
              if (!isMounted) return;

              // 高精度位置情報の取得に失敗
              // 全世界の投稿を検索
              await searchPosts();
              if (isMounted) {
                setLoading(false);
              }
            },
            options,
          );
        } else {
          // 位置情報APIが利用できない場合
          // 全世界の投稿を検索
          await searchPosts();
          if (isMounted) {
            setLoading(false);
          }
        }
      } catch {
        // 初期化エラー
        await searchPosts();
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // 認証状態が確定してから初期化を実行
    if (!authLoading) {
      initialize();
    }

    // クリーンアップ関数
    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated]); // 認証状態の変化を監視

  // 検索実行
  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      await searchPosts(searchQuery || undefined);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // 投稿クリック時の処理
  const handlePostClick = useCallback((post: PostData) => {
    if (post && post.id) {
      setSelectedPost(post);
    }
  }, []);

  // 投稿詳細ダイアログを閉じる
  const handleCloseDialog = useCallback(() => {
    setSelectedPost(null);
  }, []);

  // ダイアログが開いている間、body要素のスクロールを無効化
  useBodyScrollLock(!!selectedPost);

  if (authLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="400px"
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          ログインが必要です
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <MapIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            地図から探す
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          地図上で投稿を確認し、周辺の投稿を探すことができます
        </Typography>

        {/* 検索バー */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="場所や投稿内容で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSearch} edge="end">
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* 統計情報 */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              bgcolor: posts.length > 0 ? 'primary.light' : 'grey.300',
              color: posts.length > 0 ? 'primary.dark' : 'grey.600',
              borderRadius: 2,
              border: '1px solid',
              borderColor: posts.length > 0 ? 'primary.main' : 'grey.400',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {posts.length}件の投稿
          </Box>
          {userLocation && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: 'success.light',
                color: 'success.dark',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'success.main',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
              title={`高精度位置情報: ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`}
            >
              📍 GPS位置: {userLocation.lat.toFixed(4)},{' '}
              {userLocation.lng.toFixed(4)}
            </Box>
          )}
          {ipLocation && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: 'info.light',
                color: 'info.dark',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'info.main',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
              title={`IP-based位置: ${ipLocation.lat.toFixed(6)}, ${ipLocation.lng.toFixed(6)} (${ipLocation.accuracy})`}
            >
              🌐 IP位置: {ipLocation.city}, {ipLocation.country}
            </Box>
          )}
        </Box>
      </Box>

      {/* 地図 */}
      <Paper
        elevation={3}
        sx={{ height: { xs: '400px', sm: '500px', md: '600px' }, mb: 3 }}
      >
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100%"
          >
            <CircularProgress />
          </Box>
        ) : (
          <GoogleMap
            posts={posts}
            center={mapCenter}
            zoom={userLocation ? 12 : ipLocation ? 8 : 6}
            onPostClick={handlePostClick}
            userLocation={userLocation}
            ipLocation={ipLocation}
          />
        )}
      </Paper>

      {/* 投稿一覧 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Typography variant="h6" sx={{ color: 'primary.main' }}>
            📍 周辺の投稿
          </Typography>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              bgcolor: posts.length > 0 ? 'success.light' : 'grey.300',
              color: posts.length > 0 ? 'success.dark' : 'grey.600',
              borderRadius: 2,
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {posts.length}件
          </Box>
          {userLocation && (
            <Box
              sx={{
                px: 1,
                py: 0.25,
                bgcolor: 'info.light',
                color: 'info.dark',
                borderRadius: 1,
                fontSize: '0.7rem',
              }}
            >
              📍GPS位置
            </Box>
          )}
          {ipLocation && !userLocation && (
            <Box
              sx={{
                px: 1,
                py: 0.25,
                bgcolor: 'warning.light',
                color: 'warning.dark',
                borderRadius: 1,
                fontSize: '0.7rem',
              }}
            >
              🌐IP位置
            </Box>
          )}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 3,
          }}
        >
          {posts.map((post) => (
            <Card
              key={post.id}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
                },
              }}
              onClick={() => {
                if (post && typeof handlePostClick === 'function') {
                  handlePostClick(post);
                }
              }}
            >
              <CardMedia
                component="img"
                height="200"
                image={post.imageUrl || '/top.jpg'}
                alt={post.title}
                sx={{ objectFit: 'cover' }}
              />
              <CardContent sx={{ flexGrow: 1, bgcolor: 'background.paper' }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography
                      variant="h6"
                      component="h2"
                      gutterBottom
                      sx={{
                        fontWeight: 600,
                        color: 'text.primary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {post.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      {formatDistanceToNow(post.createdAt)}
                    </Typography>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {post.content}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: 'wrap', gap: 1 }}
                  >
                    {post.location && (
                      <Chip
                        icon={<LocationOnIcon />}
                        label={post.location}
                        size="small"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        sx={{
                          bgcolor: 'primary.light',
                          color: 'primary.contrastText',
                          cursor: 'default',
                        }}
                      />
                    )}
                    {post.tags?.slice(0, 2).map((tag, index) => (
                      <Chip
                        key={index}
                        label={tag.startsWith('#') ? tag : `#${tag}`}
                        size="small"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        sx={{
                          backgroundColor: getTagColor(tag),
                          color: 'white',
                          fontSize: '0.75rem',
                        }}
                      />
                    ))}
                  </Stack>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      pt: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        src={post.author?.avatar || undefined}
                        sx={{ width: 24, height: 24 }}
                      >
                        {!post.author?.avatar && post.author?.name
                          ? post.author.name.charAt(0).toUpperCase()
                          : null}
                      </Avatar>
                      <Typography variant="body2" color="text.secondary">
                        {post.author?.name || 'Unknown'}
                      </Typography>
                    </Box>
                    {post.isPublic ? (
                      <PublicIcon
                        sx={{ fontSize: 18, color: 'text.secondary' }}
                      />
                    ) : (
                      <LockIcon
                        sx={{ fontSize: 18, color: 'text.secondary' }}
                      />
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>

        {posts.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              投稿が見つかりませんでした
            </Typography>
            <Typography variant="body2" color="text.secondary">
              検索条件を変更してお試しください
            </Typography>
          </Box>
        )}
      </Box>

      {/* 投稿詳細ダイアログ */}
      <Dialog
        open={!!selectedPost}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        disableScrollLock={false}
        sx={{
          '& .MuiDialog-paper': {
            maxHeight: '90vh',
            overflow: 'auto',
          },
        }}
      >
        <DialogTitle>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            投稿詳細
            <Button onClick={handleCloseDialog}>閉じる</Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPost && <PostDetail post={selectedPost} />}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
