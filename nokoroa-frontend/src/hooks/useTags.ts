'use client';

import { useCallback, useEffect, useState } from 'react';

import { API_CONFIG } from '@/lib/apiConfig';

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

      // タグ一覧は公開エンドポイントのため認証ヘッダは付けない(既存挙動を維持)
      const response = await fetch(`${API_CONFIG.BASE_URL}/posts/tags`);

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
