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

/**
 * InfoWindow の中身を DOM として組み立てる。
 *
 * content に HTML 文字列を渡すと、投稿のタイトル・本文・画像URL(いずれも
 * ユーザーの自由入力)がそのまま HTML として解釈され XSS が成立する。
 * textContent / setAttribute 経由で組むことで、値は常にデータとして扱われる。
 */
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

        // city / country / accuracy は外部API(ipapi.co)の応答なので、
        // 投稿本文と同様に HTML 文字列へ埋め込まず DOM として組み立てる
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
      }

      setMarkers(newMarkers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, posts, onPostClick, userLocation, ipLocation]);

  // unmount 時のマーカー破棄。markers を依存に入れると「生成 → 破棄」を
  // 繰り返すため、ref 経由で最新値を読む。
  //
  // map インスタンスには clearInstanceListeners を呼んではいけない。
  // Maps API 内部のリスナー(パン/ズーム等)まで消えて地図が操作不能になり、
  // StrictMode の effect 二重実行では initializeMap の `!map` ガードにより
  // 再生成されないため復帰しない。Maps JS に destroy API は無いので、
  // Map 自体の解放は GC に委ねる。
  const markersRef = useRef<google.maps.Marker[]>([]);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(
    () => () => {
      markersRef.current.forEach((marker) => {
        // 先に地図から外す。clearInstanceListeners は Maps API 内部の
        // リスナー(map_changed 等)まで消すので、先に呼ぶと setMap(null) の
        // 反映が保証されない。
        marker.setMap(null);
        window.google?.maps?.event?.clearInstanceListeners(marker);
      });
    },
    [],
  );

  if (!apiKey || apiKey === 'development_mode') {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        height="100%"
        minHeight="400px"
        bgcolor="grey.100"
        borderRadius={1}
        p={3}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          地図を利用するには APIキーを設定してください
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Google Maps JavaScript API
          のキーを環境変数に設定すると地図が表示されます。
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, fontFamily: 'monospace' }}
        >
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </Typography>
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
