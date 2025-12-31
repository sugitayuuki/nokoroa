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
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { API_CONFIG } from '@/lib/apiConfig';

import { CreatePostData } from '../../types/post';
import { getToken } from '../../utils/auth';

interface PostFormProps {
  onSubmit: (data: CreatePostData) => void;
  initialData?: Partial<CreatePostData>;
  isLoading?: boolean;
}

export const PostForm = ({
  onSubmit,
  initialData,
  isLoading,
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
  const API_URL = API_CONFIG.BASE_URL;

  const geocodeLocation = useCallback(async (locationName: string) => {
    if (!locationName.trim()) {
      setFormData((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }));
      setGeocodingSuccess(false);
      setGeocodedDisplayName(null);
      return;
    }

    setIsGeocodingLocation(true);
    setGeocodingSuccess(false);
    setGeocodedDisplayName(null);
    setGeocodingAttempted(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1&accept-language=ja`,
        {
          headers: {
            'User-Agent': 'Nokoroa/1.0',
          },
        },
      );

      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();

      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setFormData((prev) => ({
          ...prev,
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
        }));
        setGeocodingSuccess(true);
        setGeocodedDisplayName(display_name);
      } else {
        setFormData((prev) => ({
          ...prev,
          latitude: undefined,
          longitude: undefined,
        }));
        setGeocodingSuccess(false);
        setGeocodedDisplayName(null);
      }
    } catch {
      setFormData((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }));
      setGeocodingSuccess(false);
      setGeocodedDisplayName(null);
    } finally {
      setIsGeocodingLocation(false);
    }
  }, []);

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);

      const token = getToken();
      if (!token) {
        throw new Error('認証トークンが見つかりません');
      }

      const response = await fetch(`${API_URL}/posts/upload-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataUpload,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('認証が必要です。再度ログインしてください。');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || '画像のアップロードに失敗しました',
        );
      }

      const result = await response.json();
      // S3 URLが直接返ってくる
      setFormData((prev) => ({
        ...prev,
        imageUrl: result.url,
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
          />

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              画像{' '}
              <Typography component="span" color="error.main">
                *
              </Typography>
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
                disabled={uploadingImage}
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
                          disabled={uploadingImage}
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
                          disabled={uploadingImage}
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
                setFormData((prev) => ({ ...prev, location: e.target.value }));
                setGeocodingSuccess(false);
                setGeocodingAttempted(false);
                setGeocodedDisplayName(null);
              }}
              onBlur={handleLocationBlur}
              placeholder="場所を入力してください（例：渋谷、京都駅、富士山）"
              InputProps={{
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
              onKeyPress={handleKeyPress}
              placeholder="タグを入力してEnterで追加"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleAddTag} edge="end">
                      <AddIcon />
                    </IconButton>
                  </InputAdornment>
                ),
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
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={
                isLoading ||
                !formData.title.trim() ||
                !formData.content.trim() ||
                !formData.imageUrl
              }
            >
              {isLoading ? '投稿中...' : '投稿する'}
            </Button>
          </Box>
        </Box>
      </form>
    </Paper>
  );
};
