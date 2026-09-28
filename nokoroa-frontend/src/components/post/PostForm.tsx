'use client';

import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  LocationOn as LocationOnIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { uploadPostImage } from '@/lib/uploadImage';
import { geocodeLocation as requestGeocode } from '@/utils/geocoding';
import { isComposingEvent } from '@/utils/ime';

import { CreatePostData } from '../../types/post';

interface PostFormProps {
  onSubmit: (data: CreatePostData) => void;
  initialData?: Partial<CreatePostData>;
  isLoading?: boolean;
  /** 送信ボタンの文言。編集画面は「更新」などに差し替える */
  submitLabel?: string;
  /** 送信中の文言 */
  submittingLabel?: string;
  /** 指定するとキャンセルボタンを表示する(編集画面用) */
  onCancel?: () => void;
  cancelLabel?: string;
  /**
   * 画像を必須にするか。
   * 新規投稿は CreatePostDto.imageUrl が必須なので true、
   * 編集は UpdatePostDto で任意なので false(画像なしの既存投稿を保存できなくなるため)。
   */
  requireImage?: boolean;
}

export const PostForm = ({
  onSubmit,
  initialData,
  isLoading,
  submitLabel = '投稿する',
  submittingLabel = '投稿中...',
  onCancel,
  cancelLabel = 'キャンセル',
  requireImage = true,
}: PostFormProps) => {
  const [formData, setFormData] = useState<CreatePostData>({
    title: initialData?.title || '',
    content: initialData?.content || '',
    imageUrl: initialData?.imageUrl || '',
    location: initialData?.location || '',
    latitude: initialData?.latitude,
    longitude: initialData?.longitude,
    tags: initialData?.tags || [],
    isPublic: initialData?.isPublic ?? true,
  });
  const [newTag, setNewTag] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(
    initialData?.imageUrl || '',
  );
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [geocodingSuccess, setGeocodingSuccess] = useState(
    !!(initialData?.latitude && initialData?.longitude),
  );
  const [geocodedDisplayName, setGeocodedDisplayName] = useState<string | null>(
    null,
  );
  const [geocodingAttempted, setGeocodingAttempted] = useState(false);

  const geocodeAbortRef = useRef<AbortController | null>(null);
  const GEOCODE_CACHE_MAX = 50;
  const geocodeCacheRef = useRef<
    Map<string, { lat: number; lon: number; display_name: string } | null>
  >(new Map());

  const normalizeCacheKey = (raw: string): string =>
    raw.trim().toLowerCase().replace(/\s+/g, ' ');

  const cacheSet = useCallback(
    (
      key: string,
      value: { lat: number; lon: number; display_name: string } | null,
    ) => {
      const cache = geocodeCacheRef.current;
      if (cache.has(key)) cache.delete(key);
      cache.set(key, value);
      while (cache.size > GEOCODE_CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      geocodeAbortRef.current?.abort();
    };
  }, []);

  const geocodeLocation = useCallback(
    async (locationName: string) => {
      const trimmed = locationName.trim();
      if (!trimmed) {
        geocodeAbortRef.current?.abort();
        setFormData((prev) => ({
          ...prev,
          latitude: undefined,
          longitude: undefined,
        }));
        setGeocodingSuccess(false);
        setGeocodedDisplayName(null);
        return;
      }

      geocodeAbortRef.current?.abort();
      const controller = new AbortController();
      geocodeAbortRef.current = controller;

      setIsGeocodingLocation(true);
      setGeocodingSuccess(false);
      setGeocodedDisplayName(null);
      setGeocodingAttempted(true);

      const cacheKey = normalizeCacheKey(trimmed);
      const cached = geocodeCacheRef.current.get(cacheKey);
      if (cached !== undefined) {
        if (cached) {
          setFormData((prev) => ({
            ...prev,
            latitude: cached.lat,
            longitude: cached.lon,
          }));
          setGeocodingSuccess(true);
          setGeocodedDisplayName(cached.display_name);
        } else {
          setFormData((prev) => ({
            ...prev,
            latitude: undefined,
            longitude: undefined,
          }));
          setGeocodingSuccess(false);
          setGeocodedDisplayName(null);
        }
        setIsGeocodingLocation(false);
        return;
      }

      try {
        // 問い合わせと座標検証は utils/geocoding に集約(編集フォームと同一結果にするため)
        const result = await requestGeocode(trimmed, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (result) {
          cacheSet(cacheKey, {
            lat: result.latitude,
            lon: result.longitude,
            display_name: result.displayName,
          });
          if (controller.signal.aborted) return;
          setFormData((prev) => ({
            ...prev,
            latitude: result.latitude,
            longitude: result.longitude,
          }));
          setGeocodingSuccess(true);
          setGeocodedDisplayName(result.displayName);
        } else {
          cacheSet(cacheKey, null);
          if (controller.signal.aborted) return;
          setFormData((prev) => ({
            ...prev,
            latitude: undefined,
            longitude: undefined,
          }));
          setGeocodingSuccess(false);
          setGeocodedDisplayName(null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (controller.signal.aborted) return;
        setFormData((prev) => ({
          ...prev,
          latitude: undefined,
          longitude: undefined,
        }));
        setGeocodingSuccess(false);
        setGeocodedDisplayName(null);
        toast.error(
          '位置情報の取得に失敗しました。時間をおいて再度お試しください',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsGeocodingLocation(false);
        }
      }
    },
    [cacheSet],
  );

  const handleLocationBlur = useCallback(() => {
    if (formData.location) {
      geocodeLocation(formData.location);
    }
  }, [formData.location, geocodeLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((tag) => tag !== tagToRemove) || [],
    }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    // IME 変換確定の Enter でタグが追加されないようガードする
    if (isComposingEvent(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('画像サイズは5MB以下にしてください');
      return;
    }

    // ファイルタイプチェック
    if (!file.type.startsWith('image/')) {
      toast.error('画像ファイルを選択してください');
      return;
    }

    setUploadError(null);

    // プレビュー用URL生成
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // 自動アップロード
    await handleUploadImage(file);
  };

  const handleUploadImage = async (file: File) => {
    if (!file) return;

    setUploadingImage(true);
    setUploadError(null);

    try {
      // アップロード経路は lib/uploadImage に集約(新規投稿・編集で同一)
      const url = await uploadPostImage(file);
      // S3 URLが直接返ってくる
      setFormData((prev) => ({
        ...prev,
        imageUrl: url,
      }));
      // previewUrlはbase64のまま維持（サーバーURLは表示に使わない）
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '画像のアップロードに失敗しました';
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
    setUploadError(null);
    setPreviewUrl('');
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            fullWidth
            label="タイトル"
            required
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="投稿のタイトルを入力してください"
            disabled={isLoading}
            helperText={`${formData.title.length}/200`}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />

          <TextField
            fullWidth
            label="内容"
            required
            multiline
            rows={8}
            value={formData.content}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, content: e.target.value }))
            }
            placeholder="投稿の内容を入力してください"
            disabled={isLoading}
            helperText={`${formData.content.length}/10000`}
            slotProps={{ htmlInput: { maxLength: 10000 } }}
          />

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              画像
              {requireImage && (
                <>
                  {' '}
                  <Typography component="span" color="error.main">
                    *
                  </Typography>
                </>
              )}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: 'background.paper',
                border: '2px dashed',
                borderColor: 'divider',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="image-upload"
                disabled={isLoading || uploadingImage}
              />
              <label htmlFor="image-upload" style={{ cursor: 'pointer' }}>
                <Box sx={{ textAlign: 'center' }}>
                  {formData.imageUrl ? (
                    <Box>
                      <Box
                        component="img"
                        src={previewUrl || formData.imageUrl}
                        alt="プレビュー"
                        sx={{
                          width: '100%',
                          maxHeight: 300,
                          objectFit: 'cover',
                          borderRadius: 1,
                          mb: 2,
                        }}
                      />
                      <Stack
                        direction="row"
                        spacing={2}
                        justifyContent="center"
                      >
                        <Button
                          component="span"
                          variant="outlined"
                          startIcon={<CloudUploadIcon />}
                          disabled={isLoading || uploadingImage}
                        >
                          画像を変更
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveImage();
                          }}
                          disabled={isLoading || uploadingImage}
                        >
                          削除
                        </Button>
                      </Stack>
                    </Box>
                  ) : uploadingImage ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      {previewUrl && (
                        <Box
                          component="img"
                          src={previewUrl}
                          alt="プレビュー"
                          sx={{
                            width: '100%',
                            maxHeight: 300,
                            objectFit: 'cover',
                            borderRadius: 1,
                            mb: 2,
                            opacity: 0.7,
                          }}
                        />
                      )}
                      <CircularProgress size={32} sx={{ mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        アップロード中...
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <CloudUploadIcon
                        sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                      />
                      <Typography variant="body1" color="text.secondary">
                        クリックして画像をアップロード
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        または、ファイルをドラッグ&ドロップ
                      </Typography>
                      <Typography
                        variant="caption"
                        display="block"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                      >
                        最大5MB（JPG, PNG, GIF）
                      </Typography>
                    </Box>
                  )}
                </Box>
              </label>
            </Paper>
            {uploadError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {uploadError}
              </Alert>
            )}
          </Box>

          <Box>
            <TextField
              fullWidth
              label="場所"
              value={formData.location}
              onChange={(e) => {
                // 場所テキストを変えたら座標は無効化する。
                // 進行中のジオコーディングも打ち切らないと、古いテキストの
                // 結果が後から届いて「表示中の場所と違う座標」を送ってしまう
                geocodeAbortRef.current?.abort();
                setFormData((prev) => ({
                  ...prev,
                  location: e.target.value,
                  latitude: undefined,
                  longitude: undefined,
                }));
                setIsGeocodingLocation(false);
                setGeocodingSuccess(false);
                setGeocodingAttempted(false);
                setGeocodedDisplayName(null);
              }}
              onBlur={handleLocationBlur}
              placeholder="場所を入力してください（例：渋谷、京都駅、富士山）"
              disabled={isLoading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {isGeocodingLocation ? (
                        <CircularProgress size={20} />
                      ) : geocodingSuccess ? (
                        <CheckCircleIcon color="success" />
                      ) : formData.location ? (
                        <LocationOnIcon color="action" />
                      ) : null}
                    </InputAdornment>
                  ),
                },
              }}
            />
            {geocodingSuccess && formData.latitude && formData.longitude && (
              <Typography
                variant="caption"
                color="success.main"
                sx={{ mt: 0.5, display: 'block' }}
              >
                位置情報を取得しました:{' '}
                {geocodedDisplayName || formData.location}
              </Typography>
            )}
            {formData.location &&
              !geocodingSuccess &&
              !isGeocodingLocation &&
              !geocodingAttempted && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  入力欄の外をクリックすると位置情報を取得します
                </Typography>
              )}
            {formData.location &&
              !geocodingSuccess &&
              !isGeocodingLocation &&
              geocodingAttempted && (
                <Typography
                  variant="caption"
                  color="error.main"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  該当する場所が見つかりませんでした
                </Typography>
              )}
          </Box>

          <Box>
            <TextField
              fullWidth
              label="タグを追加"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="タグを入力してEnterで追加"
              disabled={isLoading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleAddTag} edge="end">
                        <AddIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {formData.tags && formData.tags.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  タグ:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleRemoveTag(tag)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={formData.isPublic}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isPublic: e.target.checked,
                  }))
                }
              />
            }
            label="公開する"
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {onCancel && (
              <Button
                variant="outlined"
                size="large"
                onClick={onCancel}
                disabled={isLoading}
              >
                {cancelLabel}
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
              disabled={
                isLoading ||
                uploadingImage ||
                !formData.title.trim() ||
                !formData.content.trim() ||
                (requireImage && !formData.imageUrl)
              }
            >
              {isLoading ? submittingLabel : submitLabel}
            </Button>
          </Box>
        </Box>
      </form>
    </Paper>
  );
};
