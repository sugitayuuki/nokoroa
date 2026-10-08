'use client';

import { useCallback, useEffect, useState } from 'react';

import { API_CONFIG, API_FETCH_OPTIONS } from '@/lib/apiConfig';

interface Tag {
  name: string;
  count: number;
}

interface TagsResponse {
  tags: Tag[];
  total: number;
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      // タグ一覧は公開エンドポイントだが、自社 API への fetch は
      // 認証クッキーを送る設定で統一する(付け忘れの混在を避ける)
      const response = await fetch(
        API_CONFIG.buildUrl(API_CONFIG.endpoints.postTags),
        API_FETCH_OPTIONS,
      );

      if (!response.ok) {
        throw new Error('タグの取得に失敗しました');
      }

      const data: TagsResponse = await response.json();
      setTags(data.tags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'タグの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    tags,
    isLoading,
    error,
    refetch: fetchTags,
  };
}
