'use client';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Typography,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { PostForm } from '@/components/post/PostForm';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { CreatePostData, PostData } from '@/types/post';
import { geocodeLocation } from '@/utils/geocoding';

export default function EditPostPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated, isAuthLoading, isReady } = useRequireAuth();

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    try {
      const response = await createApiRequest(
        API_CONFIG.endpoints.postById(id as string),
      );

      if (!response.ok) {
        throw new Error('投稿の取得に失敗しました');
      }

      const data = await response.json();
      setPost(data);
    } catch (error) {
      setError((error as Error).message);
      toast.error('投稿の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id && isAuthenticated) {
      fetchPost();
    }
  }, [id, isAuthenticated, fetchPost]);

  /**
   * 送信する座標を決める。
   * 場所テキストが変わっていなければ既存の座標をそのまま維持し、
   * 変わっていれば再ジオコーディングする(座標を送らないと地図が古い位置のままズレる)。
   */
  const resolveCoordinates = async (
    currentPost: PostData,
    nextLocation: string,
    // PostForm が入力欄の blur 時点で解決済みの座標。
    // 場所テキストを変えると PostForm 側で undefined に戻るため、
    // 値が入っていれば必ず nextLocation に対応する座標である
    formCoordinates: { latitude?: number; longitude?: number },
  ): Promise<{ latitude?: number | null; longitude?: number | null }> => {
    // backend の getOrCreateLocation は lat/lng が両方あると座標込みで、
    // 省略すると名前のみで既存 Location を検索する。分岐ごとの正解が違う:
    // - 未変更: 今の値をそのまま送る(座標 null の投稿は null を明示送信し、
    //   null 込み一致で自分の行を再利用する。省略すると名前一致で同名の
    //   座標付き別行に黙って張り替わってしまう)
    // - 変更してジオコーディング成功: 新しい座標を送る
    // - 変更したが座標不明: フィールドごと省略し、名前のみ検索(main と同挙動)
    //   に倒す(null を明示すると同名の座標付き行を再利用できず重複行を作る)
    const previousLocation = (currentPost.location ?? '').trim();

    if (nextLocation === previousLocation) {
      return {
        latitude: currentPost.latitude ?? null,
        longitude: currentPost.longitude ?? null,
      };
    }

    if (!nextLocation) {
      return {};
    }

    // PostForm が既に解決済みならそれを使う(同じ場所を二重に問い合わせない)
    if (
      formCoordinates.latitude !== undefined &&
      formCoordinates.longitude !== undefined
    ) {
      return {
        latitude: formCoordinates.latitude,
        longitude: formCoordinates.longitude,
      };
    }

    // blur 前に送信された等で未解決の場合は、ここで解決してから送る
    try {
      const geocoded = await geocodeLocation(nextLocation);
      if (!geocoded) {
        toast.warn(
          '場所の位置情報が見つかりませんでした（同名の既知の地点があればそこにひもづきます）',
        );
        return {};
      }
      return {
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      };
    } catch {
      toast.warn(
        '位置情報の取得に失敗しました（同名の既知の地点があればそこにひもづきます）',
      );
      return {};
    }
  };

  const handleSubmit = async (data: CreatePostData) => {
    if (!post) {
      return;
    }

    if (!data.title.trim() || !data.content.trim()) {
      toast.error('タイトルと内容は必須です');
      return;
    }

    setSubmitting(true);
    try {
      const location = (data.location ?? '').trim();
      const { latitude, longitude } = await resolveCoordinates(post, location, {
        latitude: data.latitude,
        longitude: data.longitude,
      });

      const response = await createApiRequest(
        API_CONFIG.endpoints.postById(id as string),
        {
          method: 'PUT',
          body: JSON.stringify({
            title: data.title,
            content: data.content,
            location: location || null,
            latitude,
            longitude,
            tags: data.tags ?? [],
            isPublic: data.isPublic,
            imageUrl: data.imageUrl || null,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '投稿の更新に失敗しました');
      }

      toast.success('投稿を更新しました');
      router.push(`/posts/${id}`);
    } catch (error) {
      toast.error((error as Error).message || '投稿の更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  // 未認証が確定したらガードのリダイレクトに任せて何も描画しない
  // (loading は fetchPost が isAuthenticated ガードで走らず true のままになるため、
  //  これが無いと未認証時にスピナーが出続ける)
  if (!isReady && !isAuthLoading) {
    return null;
  }

  if (isAuthLoading || loading) {
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
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mt: 2 }}
        >
          戻る
        </Button>
      </Container>
    );
  }

  if (!post) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">投稿が見つかりません</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mt: 2 }}
        >
          戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ display: 'inline' }}>
          投稿を編集
        </Typography>
      </Box>

      <PostForm
        initialData={{
          title: post.title,
          content: post.content,
          imageUrl: post.imageUrl ?? '',
          location: post.location ?? '',
          latitude: post.latitude ?? undefined,
          longitude: post.longitude ?? undefined,
          tags: post.tags,
          isPublic: post.isPublic,
        }}
        onSubmit={handleSubmit}
        isLoading={submitting}
        submitLabel="更新"
        submittingLabel="更新中..."
        onCancel={() => router.back()}
        // 既存投稿は画像なしでも保存できる必要があるため必須にしない
        requireImage={false}
      />
    </Container>
  );
}
