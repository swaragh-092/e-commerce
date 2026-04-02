import React, { useCallback, useState } from 'react';
import { Box, Typography, CircularProgress, IconButton } from '@mui/material';
import { CloudUpload as UploadIcon, Close as CloseIcon } from '@mui/icons-material';
import api from '../../services/api';

const MediaUploader = ({ onUploadSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState(null);

    const onDrop = useCallback(async (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0] || e.target?.files[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
            alert('Invalid file type');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File too large (max 5MB)');
            return;
        }

        setPreview(URL.createObjectURL(file));

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            const res = await api.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data?.success && res.data?.data?.media) {
                onUploadSuccess(res.data.data.media);
            }
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.error?.message || err.message));
        } finally {
            setUploading(false);
        }
    }, [onUploadSuccess]);

    return (
        <Box 
            component="label"
            onDragOver={e => e.preventDefault()}
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
                position: 'relative'
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
                    <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }} />
                    <IconButton 
                        size="small" 
                        sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'background.paper' }}
                        onClick={(e) => { e.preventDefault(); setPreview(null); }}
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
