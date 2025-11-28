'use client';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { toast } from 'react-toastify';

import { API_CONFIG, createFormDataRequest } from '@/lib/apiConfig';

interface ImageUploadFieldProps {
  previewUrl: string;
  selectedFile: File | null;
  uploadingImage: boolean;
  disabled?: boolean;
  onFileSelect: (file: File | null) => void;
  onPreviewChange: (url: string) => void;
  onUploadingChange: (uploading: boolean) => void;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  previewUrl,
  selectedFile: _selectedFile,
  uploadingImage,
  disabled = false,
  onFileSelect,
  onPreviewChange,
  onUploadingChange: _onUploadingChange,
}) => {
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    onFileSelect(file);

    // プレビュー用URL生成
    const reader = new FileReader();
    reader.onloadend = () => {
      onPreviewChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    onFileSelect(null);
    onPreviewChange('');
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        画像
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
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="image-upload"
          disabled={disabled || uploadingImage}
        />
        <label htmlFor="image-upload" style={{ cursor: 'pointer' }}>
          <Box sx={{ textAlign: 'center' }}>
            {previewUrl ? (
              <Box>
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
                  }}
                />
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button
                    component="span"
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    disabled={disabled || uploadingImage}
                  >
                    画像を変更
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={(e) => {
                      e.preventDefault();
                      removeImage();
                    }}
                    disabled={disabled || uploadingImage}
                  >
                    削除
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Box>
                <CloudUploadIcon
                  sx={{
                    fontSize: 48,
                    color: 'text.secondary',
                    mb: 2,
                  }}
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
    </Box>
  );
};

// Export uploadImage as a standalone function
export const uploadImageFile = async (
  file: File | null,
  onUploadingChange: (uploading: boolean) => void,
): Promise<string | null> => {
  if (!file) return null;

  onUploadingChange(true);
  const uploadFormData = new FormData();
  uploadFormData.append('image', file);

  try {
    const response = await createFormDataRequest(
      API_CONFIG.endpoints.upload,
      uploadFormData,
    );

    if (!response.ok) {
      throw new Error('画像のアップロードに失敗しました');
    }

    const data = await response.json();
    return data.url;
  } catch {
    toast.error('画像のアップロードに失敗しました');
    return null;
  } finally {
    onUploadingChange(false);
  }
};
