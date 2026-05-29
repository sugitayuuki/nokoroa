'use client';

/// <reference types="@types/google.maps" />

import { Box, CircularProgress, Typography } from '@mui/material';
import Script from 'next/script';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { PostData } from '../../types/post';

const isSafeImageUrl = (url: string | null | undefined): url is string => {
  if (!url) return false;
  try {
    const u = new URL(url, window.location.href);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const buildPostInfoContent = (post: PostData): HTMLElement => {
  const root = document.createElement('div');
  root.style.maxWidth = '250px';
  root.style.padding = '8px';

  const title = document.createElement('h3');
  title.textContent = post.title;
  title.style.margin = '0 0 8px 0';
  title.style.fontSize = '16px';
  title.style.color = '#333';
  root.appendChild(title);

  if (isSafeImageUrl(post.imageUrl)) {
    const img = document.createElement('img');
    img.src = post.imageUrl as string;
    img.alt = post.title;
    img.style.width = '100%';
    img.style.height = '120px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '4px';
    img.style.marginBottom = '8px';
    root.appendChild(img);
  }

  const snippet =
    post.content.length > 100
      ? `${post.content.substring(0, 100)}...`
      : post.content;
  const body = document.createElement('p');
  body.textContent = snippet;
  body.style.margin = '0 0 8px 0';
  body.style.fontSize = '14px';
  body.style.color = '#666';
  body.style.lineHeight = '1.4';
  root.appendChild(body);

  if (post.location) {
    const loc = document.createElement('p');
    loc.textContent = post.location;
    loc.style.margin = '0';
    loc.style.fontSize = '12px';
    loc.style.color = '#999';
    root.appendChild(loc);
  }

  return root;
};

const buildLocationInfoContent = (params: {
  heading: string;
  headingColor: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  accuracy?: string;
}): HTMLElement => {
  const root = document.createElement('div');
  root.style.padding = '8px';
  root.style.textAlign = 'center';

  const h = document.createElement('h4');
  h.textContent = params.heading;
  h.style.margin = '0 0 4px 0';
  h.style.color = params.headingColor;
  root.appendChild(h);

  if (params.city || params.country) {
    const loc = document.createElement('p');
    loc.textContent = [params.city, params.country].filter(Boolean).join(', ');
    loc.style.margin = '0 0 4px 0';
    loc.style.fontSize = '14px';
    loc.style.color = '#333';
    root.appendChild(loc);
  }

  const coords = document.createElement('p');
  coords.style.margin = '0';
  coords.style.fontSize = '12px';
  coords.style.color = '#666';
  coords.appendChild(document.createTextNode(`緯度: ${params.lat.toFixed(6)}`));
  coords.appendChild(document.createElement('br'));
  coords.appendChild(document.createTextNode(`経度: ${params.lng.toFixed(6)}`));
  if (params.accuracy) {
    coords.appendChild(document.createElement('br'));
    coords.appendChild(document.createTextNode(params.accuracy));
  }
  root.appendChild(coords);

  return root;
};

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

interface GoogleMapProps {
  posts: PostData[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onPostClick?: (post: PostData) => void;
  userLocation?: { lat: number; lng: number } | null;
  ipLocation?: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
    accuracy?: string;
  } | null;
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
  posts,
  center = { lat: 35.6762, lng: 139.6503 }, // Tokyo default
  zoom = 10,
  onPostClick,
  userLocation,
  ipLocation,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const initializeMap = useCallback(() => {
    if (mapRef.current && window.google && !map) {
      try {
        const newMap = new window.google.maps.Map(mapRef.current, {
          center,
          zoom,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });
        setMap(newMap);
        setIsLoaded(true);
      } catch (err) {
        console.error('Map initialization error:', err);
        setError('地図の初期化に失敗しました');
      }
    }
  }, [map, center, zoom]);

  // Check if Google Maps script is already loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      setScriptLoaded(true);
      initializeMap();
    }
  }, [initializeMap]);

  const handleScriptLoad = () => {
    setScriptLoaded(true);
    initializeMap();
  };

  const handleScriptError = () => {
    console.error('Google Maps script failed to load');
    setError('Google Maps APIの読み込みに失敗しました');
  };

  useEffect(() => {
    if (map && window.google) {
      // Clear existing markers
      markers.forEach((marker) => marker.setMap(null));

      const newMarkers: google.maps.Marker[] = [];

      posts.forEach((post) => {
        if (post.latitude && post.longitude) {
          const marker = new window.google.maps.Marker({
            position: { lat: post.latitude, lng: post.longitude },
            map,
            title: post.title,
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: buildPostInfoContent(post),
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
            if (onPostClick && typeof onPostClick === 'function') {
              onPostClick(post);
            }
          });

          newMarkers.push(marker);
        }
      });

      // 現在位置マーカーを追加
      if (userLocation) {
        const currentLocationMarker = new window.google.maps.Marker({
          position: { lat: userLocation.lat, lng: userLocation.lng },
          map,
          title: '現在位置',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#2196f3',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 8,
          },
        });

        const currentLocationInfoWindow = new window.google.maps.InfoWindow({
          content: buildLocationInfoContent({
            heading: '📍 現在位置',
            headingColor: '#2196f3',
            lat: userLocation.lat,
            lng: userLocation.lng,
          }),
        });

        currentLocationMarker.addListener('click', () => {
          currentLocationInfoWindow.open(map, currentLocationMarker);
        });

        newMarkers.push(currentLocationMarker);

        // 現在位置周辺の範囲を表示するCircle（オプション）
        // 必要に応じて有効化
        /*
        new window.google.maps.Circle({
          center: { lat: userLocation.lat, lng: userLocation.lng },
          radius: 1000, // 1km
          strokeColor: '#2196f3',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#2196f3',
          fillOpacity: 0.1,
          map,
        });
        */
      }

      // IP位置情報マーカーを追加（高精度位置情報がない場合のみ）
      if (ipLocation && !userLocation) {
        const ipLocationMarker = new window.google.maps.Marker({
          position: { lat: ipLocation.lat, lng: ipLocation.lng },
          map,
          title: `IP-based位置: ${ipLocation.city}, ${ipLocation.country}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#ff9800',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 10,
          },
        });

        const ipLocationInfoWindow = new window.google.maps.InfoWindow({
          content: buildLocationInfoContent({
            heading: '🌐 IP-based位置',
            headingColor: '#ff9800',
            lat: ipLocation.lat,
            lng: ipLocation.lng,
            city: ipLocation.city,
            country: ipLocation.country,
            accuracy: ipLocation.accuracy,
          }),
        });

        ipLocationMarker.addListener('click', () => {
          ipLocationInfoWindow.open(map, ipLocationMarker);
        });

        newMarkers.push(ipLocationMarker);

        // IP位置周辺の大きな範囲表示（オプション）
        /*
        new window.google.maps.Circle({
          center: { lat: ipLocation.lat, lng: ipLocation.lng },
          radius: 25000, // 25km
          strokeColor: '#ff9800',
          strokeOpacity: 0.6,
          strokeWeight: 2,
          fillColor: '#ff9800',
          fillOpacity: 0.1,
          map,
        });
        */
      }

      setMarkers(newMarkers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, posts, onPostClick, userLocation, ipLocation]);

  if (!apiKey || apiKey === 'development_mode') {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        height="600px"
        bgcolor="grey.50"
        borderRadius={2}
        p={3}
      >
        <Typography variant="h5" color="primary" gutterBottom sx={{ mb: 3 }}>
          🗾 地図ビュー（開発モード）
        </Typography>

        {/* 改善された簡易マップエリア */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 600,
            height: 350,
            bgcolor: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
            borderRadius: 3,
            border: '3px solid #1976d2',
            overflow: 'hidden',
            mb: 3,
            boxShadow: '0 4px 20px rgba(25, 118, 210, 0.2)',
          }}
        >
          {/* 日本地図風の背景 */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `
                radial-gradient(circle at 30% 30%, rgba(76, 175, 80, 0.2) 20%, transparent 50%),
                radial-gradient(circle at 70% 60%, rgba(33, 150, 243, 0.2) 15%, transparent 40%),
                linear-gradient(45deg, rgba(156, 39, 176, 0.1) 0%, rgba(255, 193, 7, 0.1) 100%)
              `,
            }}
          />

          {/* 投稿マーカー（改善版） */}
          {posts.slice(0, 15).map((post, index) => {
            if (!post.latitude || !post.longitude) return null;

            // より分散的に配置
            const gridCols = 5;
            const col = index % gridCols;
            const row = Math.floor(index / gridCols);
            const x = col * 100 + 80 + (Math.random() * 40 - 20);
            const y = row * 80 + 60 + (Math.random() * 30 - 15);

            return (
              <Box
                key={post.id}
                onClick={() => {
                  if (onPostClick && typeof onPostClick === 'function') {
                    onPostClick(post);
                  }
                }}
                sx={{
                  position: 'absolute',
                  left: Math.min(Math.max(x, 20), 550),
                  top: Math.min(Math.max(y, 20), 320),
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.4)',
                    zIndex: 20,
                  },
                }}
                title={`📍 ${post.title}\n📍 ${post.location || '場所不明'}\n💬 ${post.content.substring(0, 50)}...`}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    bgcolor: '#e53935',
                    borderRadius: '50% 50% 50% 0',
                    border: '3px solid white',
                    boxShadow: '0 3px 8px rgba(229, 57, 53, 0.4)',
                    transform: 'rotate(-45deg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      bgcolor: 'white',
                      borderRadius: '50%',
                      transform: 'rotate(45deg)',
                    }}
                  />
                </Box>
              </Box>
            );
          })}

          {/* 現在位置マーカー */}
          {userLocation && (
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 20,
              }}
              title="あなたの現在位置"
            >
              {/* 現在位置の円 */}
              <Box
                sx={{
                  position: 'absolute',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'rgba(33, 150, 243, 0.2)',
                  border: '2px solid #2196f3',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': {
                      transform: 'translate(-50%, -50%) scale(1)',
                      opacity: 1,
                    },
                    '70%': {
                      transform: 'translate(-50%, -50%) scale(1.3)',
                      opacity: 0.7,
                    },
                    '100%': {
                      transform: 'translate(-50%, -50%) scale(1)',
                      opacity: 1,
                    },
                  },
                }}
              />
              {/* 現在位置の中心点 */}
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: '#2196f3',
                  border: '2px solid white',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  position: 'relative',
                  zIndex: 25,
                }}
              />
              {/* 現在位置ラベル */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  mb: 1,
                  p: 0.5,
                  bgcolor: 'rgba(33, 150, 243, 0.9)',
                  color: 'white',
                  borderRadius: 1,
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                }}
              >
                📍 現在位置
              </Box>
            </Box>
          )}

          {/* IP位置マーカー */}
          {ipLocation && !userLocation && (
            <Box
              sx={{
                position: 'absolute',
                left: '40%',
                top: '40%',
                transform: 'translate(-50%, -50%)',
                zIndex: 15,
              }}
              title={`IP-based位置: ${ipLocation.city}, ${ipLocation.country}`}
            >
              {/* IP位置の円 */}
              <Box
                sx={{
                  position: 'absolute',
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255, 152, 0, 0.2)',
                  border: '2px dashed #ff9800',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              {/* IP位置の中心点 */}
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: '#ff9800',
                  border: '2px solid white',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  position: 'relative',
                  zIndex: 20,
                }}
              />
              {/* IP位置ラベル */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  mb: 1,
                  p: 0.5,
                  bgcolor: 'rgba(255, 152, 0, 0.9)',
                  color: 'white',
                  borderRadius: 1,
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                }}
              >
                🌐 {ipLocation.city}
              </Box>
            </Box>
          )}

          {/* マップ情報 */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              p: 1,
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 1,
              fontSize: '0.75rem',
            }}
          >
            📍 {posts.length}件の投稿
          </Box>
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          sx={{ mb: 2 }}
        >
          マーカーをクリックして投稿詳細を表示
        </Typography>

        {/* Google Maps API設定案内 */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'info.light',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'info.main',
            textAlign: 'center',
            maxWidth: 500,
          }}
        >
          <Typography variant="subtitle2" color="info.dark" gutterBottom>
            🗺️ 実際のGoogle Mapsを表示するには
          </Typography>
          <Typography
            variant="caption"
            color="info.dark"
            sx={{ display: 'block', mb: 1 }}
          >
            1. <strong>Google Cloud Console</strong> でプロジェクト作成
            <br />
            2. <strong>Maps JavaScript API</strong> を有効化
            <br />
            3. <strong>APIキー</strong> を取得
            <br />
            4. <strong>.env.local</strong> ファイルを作成
          </Typography>
          <Typography
            variant="caption"
            color="info.dark"
            sx={{
              fontFamily: 'monospace',
              bgcolor: 'rgba(0,0,0,0.1)',
              px: 1,
              py: 0.5,
              borderRadius: 1,
            }}
          >
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=あなたのAPIキー
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="400px"
        bgcolor="grey.100"
        borderRadius={1}
      >
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <>
      {!scriptLoaded && (
        <Script
          id="google-maps-script"
          src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`}
          strategy="lazyOnload"
          onLoad={handleScriptLoad}
          onError={handleScriptError}
        />
      )}
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        {!isLoaded && (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="400px"
          >
            <CircularProgress />
          </Box>
        )}
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
            display: isLoaded ? 'block' : 'none',
          }}
        />
      </Box>
    </>
  );
};
