'use client';

import { useCallback, useState } from 'react';

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

  const getSuggestions = useCallback(
    async (query: string) => {
      // 空文字の場合はサジェストをクリア
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        // サジェストは公開エンドポイントのため認証ヘッダは付けない(既存挙動を維持)
        const endpoint =
          type === 'keyword'
            ? API_CONFIG.endpoints.keywordSuggestions
            : API_CONFIG.endpoints.locationSuggestions;

        const response = await fetch(
          API_CONFIG.buildUrl(`${endpoint}?q=${encodeURIComponent(query)}`),
        );

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        } else {
          // APIが404の場合は、ローカルでサジェストを生成
          setSuggestions(generateLocalSuggestions(query, type));
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        // エラー時はローカルサジェスト
        setSuggestions(generateLocalSuggestions(query, type));
      } finally {
        setIsLoading(false);
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
