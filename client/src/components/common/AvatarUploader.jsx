import React, { useState, useContext } from 'react';
import { Box, Avatar, Button, Typography, CircularProgress } from '@mui/material';
import { AuthContext } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { getMediaUrl } from '../../utils/media';
import api from '../../services/api';

const AvatarUploader = () => {
  const { user, refreshUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const avatarUrl = getMediaUrl(user?.profile?.avatar || '');

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const mediaRes = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const mediaId = mediaRes.data.data.media.id;
      await userService.updateAvatar(mediaId);
      // Refresh context user object without page reload
      await refreshUser();
    } catch (err) {
      setError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
      <Avatar
        src={avatarUrl || null}
        sx={{ width: 80, height: 80 }}
      >
        {!avatarUrl && user?.firstName?.charAt(0)}
      </Avatar>
      <Box>
        <Button variant="outlined" component="label" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Change Avatar'}
          <input type="file" hidden accept="image/*" onChange={handleFileChange} />
        </Button>
        {error && <Typography color="error" variant="body2" sx={{ mt: 1 }}>{error}</Typography>}
      </Box>
    </Box>
  );
};

export default AvatarUploader;
