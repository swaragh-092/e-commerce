import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardActions,
  IconButton,
  Tooltip,
  Alert,
  Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

const MediaPage = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const notify = useNotification();

  const fetchMedia = () => {
    setLoading(true);
    api
      .get('/media')
      .then((res) => setFiles(res.data.data?.rows || res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await api.delete(`/media/${id}`);
      fetchMedia();
    } catch {
      notify('Failed to delete file.', 'error');
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    notify('URL copied to clipboard!', 'success');
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Media Library
      </Typography>

      {!loading && files.length === 0 && (
        <Alert severity="info">
          No media files uploaded yet. Upload images via the Products page.
        </Alert>
      )}

      <Grid container spacing={2}>
        {files.map((file) => {
          const url = file.url?.startsWith('http') ? file.url : `${baseUrl}${file.url}`;
          return (
            <Grid item key={file.id} xs={6} sm={4} md={3} lg={2}>
              <Card
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <CardMedia
                  component="img"
                  height="120"
                  image={url}
                  alt={file.originalName || 'media'}
                  sx={{ objectFit: 'cover' }}
                />
                <CardActions sx={{ justifyContent: 'flex-end', p: 0.5 }}>
                  <Tooltip title="Copy URL">
                    <IconButton size="small" onClick={() => copyUrl(url)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(file.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default MediaPage;
