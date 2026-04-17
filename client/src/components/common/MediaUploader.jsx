import React, { useCallback, useState } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  IconButton, 
  Stack, 
  Button 
} from '@mui/material';
import UploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

const MediaUploader = ({ onUploadSuccess, multiple = true, autoUpload = true }) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
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
      const newFiles = Array.from(e.dataTransfer?.files || e.target?.files || []);
      if (newFiles.length === 0) return;

      if (autoUpload) {
        setUploading(true);
        for (const file of newFiles) {
          await handleUpload(file);
        }
        setUploading(false);
      } else {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
      }

      if (e.target) e.target.value = '';
    },
    [autoUpload, onUploadSuccess]
  );

  const startManualUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    for (const file of selectedFiles) {
      await handleUpload(file);
    }
    setUploading(false);
    setSelectedFiles([]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
          <Typography variant="body2" color="text.primary" fontWeight={600} textAlign="center">
            {multiple ? 'Drop images here or click to select' : 'Drop image here or click to select'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            JPEG, PNG, WEBP, GIF (Max 5MB each)
          </Typography>
        </>
      )}

      {selectedFiles.length > 0 && !uploading && (
        <Box 
          onClick={(e) => e.stopPropagation()} 
          sx={{ 
            mt: 3, 
            width: '100%', 
            maxHeight: 200, 
            overflowY: 'auto',
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            p: 1
          }}
        >
          <Stack spacing={1}>
            {selectedFiles.map((file, i) => (
              <Box 
                key={i} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  bgcolor: 'action.hover', 
                  p: 0.5, 
                  px: 1, 
                  borderRadius: 1 
                }}
              >
                <Typography variant="caption" noWrap sx={{ maxWidth: '70%', fontWeight: 500 }}>
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                </Typography>
                <IconButton size="small" color="error" onClick={() => removeFile(i)}>
                  <DeleteIcon fontSize="inherit" />
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Button
            fullWidth
            variant="contained"
            startIcon={<SendIcon />}
            onClick={startManualUpload}
            sx={{ mt: 2, borderRadius: 2 }}
          >
            Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default MediaUploader;
