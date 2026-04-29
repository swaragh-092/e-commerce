import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Grid,
  Card,
  CardMedia,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  Divider,
  Fade,
} from '@mui/material';
import {
  Search as SearchIcon,
  CloudUpload as CloudUploadIcon,
  PhotoLibrary as PhotoLibraryIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { mediaService } from '../../services/mediaService';
import MediaUploader from './MediaUploader';
import { getMediaUrl } from '../../utils/media';

/**
 * A WordPress-style media picker dialog.
 * Allows selecting existing media from the library or uploading new ones.
 *
 * @param {boolean}  open        - Dialog open state
 * @param {function} onClose     - Callback when dialog closes
 * @param {function} onSelect    - Callback when media is selected. Returns an array of media objects.
 * @param {boolean}  multiple    - Allow multiple selection (default: false)
 * @param {string}   title       - Custom dialog title
 */
const MediaPicker = ({ open, onClose, onSelect, multiple = false, title = 'Select Media' }) => {
  const [tab, setTab] = useState(0); // 0: Upload, 1: Library
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]); // Array of media objects

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSelected([]);
      fetchMedia().then((data) => {
        setTab(data.length > 0 ? 1 : 0);
      });
    }
  }, [open]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await mediaService.list({ limit: 100 });
      const newMedia = res.data?.rows || res.data || [];
      setMedia(newMedia);
      return newMedia;
    } catch (err) {
      console.error('Failed to fetch media', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const filteredMedia = useMemo(() => {
    if (!search.trim()) return media;
    const s = search.toLowerCase();
    return media.filter(
      (m) =>
        m.originalName?.toLowerCase().includes(s) ||
        m.filename?.toLowerCase().includes(s)
    );
  }, [media, search]);

  const handleToggleSelect = (item) => {
    if (multiple) {
      const isSelected = selected.find((s) => s.id === item.id);
      if (isSelected) {
        setSelected(selected.filter((s) => s.id !== item.id));
      } else {
        setSelected([...selected, item]);
      }
    } else {
      setSelected([item]);
    }
  };

  const handleConfirm = () => {
    onSelect(multiple ? selected : selected[0]);
    onClose();
  };

  const handleUploadSuccess = (newMedia) => {
    // If it's a single upload and we are in single mode, auto-select and close
    if (!multiple) {
      onSelect(newMedia);
      onClose();
    } else {
      // If multiple, just refresh library and switch tab
      fetchMedia();
      setTab(1);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab
            icon={<CloudUploadIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Upload Files"
            sx={{ fontWeight: 600 }}
          />
          <Tab
            icon={<PhotoLibraryIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Media Library"
            sx={{ fontWeight: 600 }}
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
        {tab === 0 && (
          <Box sx={{ p: 4, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ width: '100%', maxWidth: 500 }}>
              <MediaUploader
                onUploadSuccess={handleUploadSuccess}
                multiple={multiple}
                autoUpload={true}
              />
            </Box>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Search Bar */}
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search media..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Media Grid */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {loading && media.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress />
                </Box>
              ) : filteredMedia.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <PhotoLibraryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography color="text.secondary">
                    {search ? 'No matches found for your search.' : 'Your media library is empty.'}
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={1.5}>
                  {filteredMedia.map((item) => {
                    const isSelected = selected.some((s) => s.id === item.id);
                    return (
                      <Grid item xs={4} sm={3} md={2.4} key={item.id}>
                        <Card
                          elevation={0}
                          onClick={() => handleToggleSelect(item)}
                          sx={{
                            position: 'relative',
                            pt: '100%',
                            cursor: 'pointer',
                            borderRadius: 2,
                            border: '3px solid',
                            borderColor: isSelected ? 'primary.main' : 'transparent',
                            transition: 'all 0.2s',
                            '&:hover': {
                              transform: 'scale(1.02)',
                              boxShadow: 2,
                            },
                          }}
                        >
                          <CardMedia
                            component="img"
                            image={getMediaUrl(item.url)}
                            alt={item.label || item.name || item.originalName || 'media preview'}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                          {isSelected && (
                            <Fade in={true}>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  bgcolor: 'rgba(25, 118, 210, 0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <CheckCircleIcon color="primary" sx={{ fontSize: 32, bgcolor: 'white', borderRadius: '50%' }} />
                              </Box>
                            </Fade>
                          )}
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Box>
          {selected.length > 0 && (
            <Typography variant="body2" fontWeight={600} color="primary">
              {selected.length} item{selected.length !== 1 ? 's' : ''} selected
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={selected.length === 0}
            sx={{ px: 4 }}
          >
            {multiple ? `Select ${selected.length} items` : 'Select'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default MediaPicker;
