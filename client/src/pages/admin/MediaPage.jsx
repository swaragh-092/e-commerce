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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import MediaUploader from '../../components/common/MediaUploader';

const MediaPage = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  
  const canDeleteMedia = hasPermission(PERMISSIONS.MEDIA_DELETE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);

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
    if (!canDeleteMedia) {
      notify('You do not have permission to delete media.', 'error');
      return;
    }

    if (!(await confirm('Delete File', 'Delete this file?', 'danger'))) return;
    try {
      await api.delete(`/media/${id}`);
      fetchMedia();
    } catch {
      notify('Failed to delete file.', 'error');
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    notify('Media URL copied to clipboard successfully.', 'success');
  };

  const handleUploadSuccess = () => {
    fetchMedia();
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Media Library
        </Typography>
        {canUploadMedia && (
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Upload Media
          </Button>
        )}
      </Box>

      {loading && files.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !loading && files.length === 0 ? (
        <Alert severity="info">
          No media files uploaded yet. click the Upload button to add images.
        </Alert>
      ) : (
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
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    }
                  }}
                >
                  <Box sx={{ position: 'relative', pt: '100%' }}>
                    <CardMedia
                      component="img"
                      image={url}
                      alt={file.originalName || 'media'}
                      sx={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover' 
                      }}
                    />
                  </Box>
                  <CardActions sx={{ justifyContent: 'flex-end', p: 0.5, mt: 'auto' }}>
                    <Tooltip title="Copy URL">
                      <IconButton size="small" onClick={() => copyUrl(url)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canDeleteMedia && (
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(file.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Upload Media</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ py: 1 }}>
            <MediaUploader 
              onUploadSuccess={handleUploadSuccess} 
              multiple={true} 
              autoUpload={false}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Note: All uploaded images will be visible in the media library and can be used across the store.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button 
            onClick={() => setUploadDialogOpen(false)} 
            variant="outlined" 
            sx={{ borderRadius: 2, px: 3 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MediaPage;
