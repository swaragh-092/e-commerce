import React, { useCallback, useState } from 'react';
import { Box, Typography, CircularProgress, IconButton, Stack } from '@mui/material';
import { CloudUpload as UploadIcon, Close as CloseIcon } from '@mui/icons-material';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

const MediaUploader = ({ onUploadSuccess, multiple = true }) => {
  const [uploading, setUploading] = useState(false);
  const notify = useNotification();

  const handleUpload = async (file) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      notify(`Invalid file type for ${file.name}. JPEG, PNG, WebP, or GIF only.`, 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify(`File ${file.name} is too large. Max 5MB.`, 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.data?.media) {
        onUploadSuccess(res.data.data.media);
      } else {
        notify(`Upload failed for ${file.name}: unexpected response.`, 'error');
      }
    } catch (err) {
      notify(`Upload failed for ${file.name}: ` + (err.response?.data?.error?.message || err.message), 'error');
    }
  };

  const onDrop = useCallback(
    async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || e.target?.files || []);
      if (files.length === 0) return;

      setUploading(true);
      // Upload one by one to avoid overwhelming the server or causing rate limit issues
      for (const file of files) {
        await handleUpload(file);
      }
      setUploading(false);
      // Reset input value so same file can be selected again if needed
      if (e.target) e.target.value = '';
    },
    [onUploadSuccess]
  );

  return (
    <Box
      component="label"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      sx={{
        border: '2px dashed',
        borderColor: uploading ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: uploading ? 'default' : 'pointer',
        bgcolor: uploading ? 'action.selected' : 'background.paper',
        '&:hover': { bgcolor: uploading ? 'action.selected' : 'action.hover' },
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        minHeight: 140,
      }}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onDrop}
        style={{ display: 'none' }}
        multiple={multiple}
        disabled={uploading}
      />

      {uploading ? (
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Uploading images…
          </Typography>
        </Stack>
      ) : (
        <>
          <UploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1.5 }} />
          <Typography variant="body2" color="text.primary" fontWeight={600}>
            {multiple ? 'Drop images here or click to upload' : 'Drop image here or click to upload'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            JPEG, PNG, WEBP, GIF (Max 5MB each)
          </Typography>
        </>
      )}
    </Box>
  );
};

export default MediaUploader;
