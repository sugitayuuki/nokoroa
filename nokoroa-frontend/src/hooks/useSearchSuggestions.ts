'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { API_CONFIG } from '@/lib/apiConfig';

interface SearchSuggestionsHook {
  suggestions: string[];
  isLoading: boolean;
  getSuggestions: (query: string) => void;
}

export function useSearchSuggestions(
  type: 'keyword' | 'location',
): SearchSuggestionsHook {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 進行中のリクエスト。新しい入力が来たら中断する。
  const controllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const getSuggestions = useCallback(
    async (query: string) => {
      // 入力が変わった時点で前のリクエストは不要。中断しないと、
      // 遅い先行応答が後発応答を上書きして入力と無関係な候補が出る。
      controllerRef.current?.abort();

      // 空文字の場合はサジェストをクリア
      if (!query.trim()) {
        controllerRef.current = null;
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      // このリクエストが最新かどうか。中断済み/世代交代後は state を触らない
      // (先行の finally が後発中のスピナーを消すのも防ぐ)。
      const isCurrent = () =>
        isMountedRef.current && controllerRef.current === controller;

      setIsLoading(true);
      try {
        // サジェストは公開エンドポイントのため認証ヘッダは付けない(既存挙動を維持)
        const endpoint =
          type === 'keyword'
            ? API_CONFIG.endpoints.keywordSuggestions
            : API_CONFIG.endpoints.locationSuggestions;

        const response = await fetch(
          API_CONFIG.buildUrl(`${endpoint}?q=${encodeURIComponent(query)}`),
          { signal: controller.signal },
        );

        if (!isCurrent()) return;

        if (response.ok) {
          const data = await response.json();
          if (!isCurrent()) return;
          setSuggestions(data.suggestions || []);
        } else {
          // APIが404の場合は、ローカルでサジェストを生成
          setSuggestions(generateLocalSuggestions(query, type));
        }
      } catch (error) {
        // 中断は正常系なので何も出さない
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (!isCurrent()) return;
        console.error('Failed to fetch suggestions:', error);
        // エラー時はローカルサジェスト
        setSuggestions(generateLocalSuggestions(query, type));
      } finally {
        if (isCurrent()) {
          setIsLoading(false);
        }
      }
    },
    [type],
  );

  return {
    suggestions,
    isLoading,
    getSuggestions,
  };
}

// ローカルサジェスト生成（APIが利用できない場合のフォールバック）
function generateLocalSuggestions(
  query: string,
  type: 'keyword' | 'location',
): string[] {
  if (type === 'location') {
    // よくある場所のサンプル
    const commonLocations = [
      '東京',
      '大阪',
      '京都',
      '福岡',
      '札幌',
      '名古屋',
      '横浜',
      '神戸',
      '沖縄',
      '北海道',
      'パリ',
      'ロンドン',
      'ニューヨーク',
      'ローマ',
      'バルセロナ',
      'ドバイ',
      'シンガポール',
      'バンコク',
      'ソウル',
      '台北',
    ];

    return commonLocations
      .filter((loc) => loc.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
  }

  // キーワードの場合は空配列を返す（サジェストなし）
  return [];
}
