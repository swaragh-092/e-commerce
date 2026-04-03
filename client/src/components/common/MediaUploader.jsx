import React, { useCallback, useState } from 'react';
import { Box, Typography, CircularProgress, IconButton } from '@mui/material';
import { CloudUpload as UploadIcon, Close as CloseIcon } from '@mui/icons-material';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

const MediaUploader = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const notify = useNotification();

  const onDrop = useCallback(
    async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0] || e.target?.files[0];
      if (!file) return;

      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        notify('Invalid file type. Please upload JPEG, PNG, WebP, or GIF.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify('File too large. Maximum size is 5 MB.', 'error');
        return;
      }

      const objectUrl = URL.createObjectURL(file);

      const formData = new FormData();
      formData.append('file', file);

      setUploading(true);
      try {
        const res = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.success && res.data?.data?.media) {
          setPreview(objectUrl);
          onUploadSuccess(res.data.data.media);
        } else {
          URL.revokeObjectURL(objectUrl);
          notify('Upload failed: unexpected server response.', 'error');
        }
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        notify('Upload failed: ' + (err.response?.data?.error?.message || err.message), 'error');
      } finally {
        setUploading(false);
      }
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
        borderColor: 'divider',
        borderRadius: 2,
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        bgcolor: 'background.paper',
        '&:hover': { bgcolor: 'action.hover' },
        position: 'relative',
      }}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onDrop}
        style={{ display: 'none' }}
      />

      {uploading ? (
        <CircularProgress />
      ) : preview ? (
        <Box sx={{ position: 'relative' }}>
          <img
            src={preview}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
          />
          <IconButton
            size="small"
            sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'background.paper' }}
            onClick={(e) => {
              e.preventDefault();
              setPreview(null);
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      ) : (
        <>
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Drag and drop image here, or click to select
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supports JPEG, PNG, WEBP, GIF (Max 5MB)
          </Typography>
        </>
      )}
    </Box>
  );
};

export default MediaUploader;
