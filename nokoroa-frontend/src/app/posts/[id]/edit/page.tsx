'use client';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import {
  ImageUploadField,
  uploadImageFile,
} from '@/components/post/ImageUploadField';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';
import { PostData } from '@/types/post';
import { geocodeLocation } from '@/utils/geocoding';

export default function EditPostPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated, isAuthLoading, isReady } = useRequireAuth();

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    location: '',
    tags: '',
    isPublic: true,
    imageUrl: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);

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

      // フォームデータを設定
      setFormData({
        title: data.title,
        content: data.content,
        location: data.location || '',
        tags: data.tags.join(', '),
        isPublic: data.isPublic,
        imageUrl: data.imageUrl || '',
      });

      // 既存の画像URLをプレビューに設定
      if (data.imageUrl) {
        setPreviewUrl(data.imageUrl);
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('タイトルと内容は必須です');
      return;
    }

    if (!post) {
      return;
    }

    setSubmitting(true);
    try {
      // 画像をアップロード
      let imageUrl = formData.imageUrl;
      if (selectedFile) {
        const uploadedUrl = await uploadImageFile(
          selectedFile,
          setUploadingImage,
        );
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const location = formData.location.trim();
      const { latitude, longitude } = await resolveCoordinates(post, location);

      const response = await createApiRequest(
        API_CONFIG.endpoints.postById(id as string),
        {
          method: 'PUT',
          body: JSON.stringify({
            title: formData.title,
            content: formData.content,
            location: location || null,
            latitude,
            longitude,
            tags: formData.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0),
            isPublic: formData.isPublic,
            imageUrl: imageUrl || null,
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

  const handleChange =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      isPublic: e.target.checked,
    }));
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

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <TextField
                label="タイトル"
                value={formData.title}
                onChange={handleChange('title')}
                fullWidth
                required
                disabled={submitting}
                inputProps={{ maxLength: 200 }}
                helperText={`${formData.title.length}/200`}
              />

              <TextField
                label="内容"
                value={formData.content}
                onChange={handleChange('content')}
                fullWidth
                required
                multiline
                rows={10}
                disabled={submitting}
                inputProps={{ maxLength: 10000 }}
                helperText={`${formData.content.length}/10000`}
              />

              <TextField
                label="場所"
                value={formData.location}
                onChange={handleChange('location')}
                fullWidth
                disabled={submitting}
                InputProps={{
                  startAdornment: (
                    <LocationOnIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
                placeholder="例: 東京, パリ, ニューヨーク"
              />

              <TextField
                label="タグ"
                value={formData.tags}
                onChange={handleChange('tags')}
                fullWidth
                disabled={submitting}
                helperText="カンマ区切りで複数のタグを入力できます (例: 旅行, グルメ, 観光)"
                placeholder="例: 旅行, グルメ, 観光"
              />

              <ImageUploadField
                previewUrl={previewUrl}
                selectedFile={selectedFile}
                uploadingImage={uploadingImage}
                disabled={submitting}
                onFileSelect={setSelectedFile}
                onPreviewChange={setPreviewUrl}
                onUploadingChange={setUploadingImage}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isPublic}
                    onChange={handleCheckboxChange}
                    disabled={submitting}
                  />
                }
                label="公開する"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  startIcon={
                    submitting ? <CircularProgress size={20} /> : <SaveIcon />
                  }
                  disabled={submitting}
                  fullWidth
                >
                  {submitting ? '更新中...' : '更新'}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => router.back()}
                  disabled={submitting}
                  fullWidth
                >
                  キャンセル
                </Button>
              </Box>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
