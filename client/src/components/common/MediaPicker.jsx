import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  CloudUpload as CloudUploadIcon,
  PhotoLibrary as PhotoLibraryIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  CalendarToday as CalendarTodayIcon,
  Storage as StorageIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { mediaService } from '../../services/mediaService';
import MediaUploader from './MediaUploader';
import { getMediaUrl } from '../../utils/media';

// Global cache for media library to avoid redundant initial fetches across multiple picker instances
let mediaCache = null;
let mediaCacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const initialFetchRef = useRef(false);
  const observerRef = useRef(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSelected([]);
      
      // Load from cache if fresh
      if (mediaCache && (Date.now() - mediaCacheTimestamp < CACHE_TTL)) {
        setMedia(mediaCache);
        setTab(mediaCache.length > 0 ? 1 : 0);
        // Refresh in background silently
        fetchMedia(1, false, true);
      } else {
        fetchMedia(1);
      }
    }
  }, [open]);

  // Refresh when sort changes
  useEffect(() => {
    if (open) {
      fetchMedia(1);
    }
  }, [sortBy, sortDir]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = observerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [hasMore, loading, loadingMore]);

  const fetchMedia = async (pageNum = 1, isLoadMore = false, isBackground = false) => {
    if (isLoadMore) setLoadingMore(true);
    else if (!isBackground) setLoading(true);

    try {
      const res = await mediaService.list({ 
        page: pageNum, 
        limit: 30,
        sortBy,
        sortDir
      });
      const newMedia = res.data || [];
      const meta = res.meta || {};
      
      if (pageNum === 1) {
        setMedia(newMedia);
        // Update global cache
        mediaCache = newMedia;
        mediaCacheTimestamp = Date.now();
        // Automatically switch to library tab if there's media
        if (newMedia.length > 0 && tab === 0) setTab(1);
      } else {
        setMedia((prev) => [...prev, ...newMedia]);
      }

      setHasMore(newMedia.length > 0 && (meta.page < meta.totalPages));
      setPage(pageNum);
      return newMedia;
    } catch (err) {
      console.error('Failed to fetch media', err);
      return [];
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchMedia(page + 1, true);
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
    onSelect(multiple ? selected : (selected[0] ? [selected[0]] : []));
    onClose();
  };

  const handleUploadSuccess = (newMedia) => {
    // If it's a single upload and we are in single mode, auto-select and close
    if (!multiple) {
      onSelect([newMedia]);
      onClose();
    } else {
      // If multiple, add to selection but don't refresh here (onAllUploadsComplete handles it)
      setSelected((prev) => [...prev, newMedia]);
      setTab(1);
    }
  };

  const handleAllUploadsComplete = () => {
    fetchMedia(1, false, true); // Refresh library in background
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
          height: { xs: '90vh', sm: '80vh' },
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle component="div" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                onAllUploadsComplete={handleAllUploadsComplete}
                multiple={multiple}
                autoUpload={true}
              />
            </Box>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                sx={{ flex: 1, minWidth: 200 }}
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

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="media-sort-by-label">Sort by</InputLabel>
                <Select
                  labelId="media-sort-by-label"
                  id="media-sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort by"
                >
                  <MenuItem value="date"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CalendarTodayIcon fontSize="small" /> Date</Box></MenuItem>
                  <MenuItem value="size"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><StorageIcon fontSize="small" /> Size</Box></MenuItem>
                  <MenuItem value="name"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CategoryIcon fontSize="small" /> Name</Box></MenuItem>
                </Select>
              </FormControl>

              <ToggleButtonGroup
                value={sortDir}
                exclusive
                onChange={(_, v) => v && setSortDir(v)}
                size="small"
              >
                <ToggleButton value="asc" aria-label="ascending">
                  <ArrowUpwardIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="desc" aria-label="descending">
                  <ArrowDownwardIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
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
                <>
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
                              alt={item.alt || item.originalName || item.filename || 'media preview'}
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
                  {hasMore && (
                    <Box 
                      sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2, py: 2 }}
                      ref={observerRef}
                    >
                      {loadingMore ? (
                        <CircularProgress size={32} />
                      ) : (
                        <Button variant="text" onClick={handleLoadMore} sx={{ opacity: 0.5 }}>
                          Scroll for more
                        </Button>
                      )}
                    </Box>
                  )}
                </>
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
