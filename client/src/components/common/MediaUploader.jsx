import React, { useCallback, useState, useRef } from 'react';
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
import { mediaService } from '../../services/mediaService';
import { useNotification } from '../../context/NotificationContext';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const MediaUploader = ({ onUploadSuccess, onAllUploadsComplete, multiple = true, autoUpload = true }) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const abortControllerRef = useRef(null);
  const { notify } = useNotification();

  const handleUpload = async (file, signal) => {
    if (!ALLOWED_MIMES.includes(file.type)) {
      notify(`Invalid file type for ${file.name}. JPEG, PNG, WebP, or GIF only.`, 'error');
      return null;
    }
    if (file.size > MAX_FILE_SIZE) {
      notify(`File ${file.name} is too large. Max 5MB.`, 'error');
      return null;
    }

    try {
      const res = await mediaService.uploadMedia(file, signal);
      if (res?.success && res?.data?.media) {
        onUploadSuccess(res.data.media);
        return res.data.media;
      } else {
        notify(`Upload failed for ${file.name}: unexpected response.`, 'error');
        return null;
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return null; // Silent return on cancel
      }
      notify(`Upload failed for ${file.name}: ` + (err.response?.data?.error?.message || err.message), 'error');
      return null;
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      notify('Upload cancelled.', 'info');
    }
  };

  const onDrop = useCallback(
    async (e) => {
      e.preventDefault();
      const newFiles = Array.from(e.dataTransfer?.files || e.target?.files || []);
      if (newFiles.length === 0) return;

      if (autoUpload) {
        setUploading(true);
        abortControllerRef.current = new AbortController();
        try {
          await Promise.all(newFiles.map(file => handleUpload(file, abortControllerRef.current.signal)));
        } finally {
          setUploading(false);
          abortControllerRef.current = null;
        }
        if (onAllUploadsComplete) onAllUploadsComplete();
      } else {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
      }

      if (e.target) e.target.value = '';
    },
    [autoUpload, onUploadSuccess]
  );

  const startManualUpload = async () => {
    setUploading(true);
    abortControllerRef.current = new AbortController();
    try {
      await Promise.all(selectedFiles.map(file => handleUpload(file, abortControllerRef.current.signal)));
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
    setSelectedFiles([]);
    if (onAllUploadsComplete) onAllUploadsComplete();
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
        accept={ALLOWED_MIMES.join(',')}
        onChange={onDrop}
        style={{ display: 'none' }}
        multiple={multiple}
        disabled={uploading}
      />

      {uploading ? (
        <Stack spacing={1.5} alignItems="center">
          <CircularProgress size={32} thickness={5} />
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Uploading images…
          </Typography>
          <Button 
            size="small" 
            color="error" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              cancelUpload();
            }}
            sx={{ fontWeight: 600 }}
          >
            Cancel Upload
          </Button>
        </Stack>
      ) : (
        <>
          <UploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1.5 }} />
          <Typography variant="body2" color="text.primary" fontWeight={600} textAlign="center">
            {multiple ? 'Drop images here or click to select' : 'Drop image here or click to select'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ALLOWED_MIMES.map(m => m.split('/')[1].toUpperCase()).join(', ')} (Max 5MB each)
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
