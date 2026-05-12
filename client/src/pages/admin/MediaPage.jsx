import { useState, useEffect, useMemo, useRef } from 'react';
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
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Chip,
  TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import StorageIcon from '@mui/icons-material/Storage';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import CategoryIcon from '@mui/icons-material/Category';
import { mediaService } from '../../services/mediaService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import MediaUploader from '../../components/common/MediaUploader';
import { getMediaUrl } from '../../utils/media';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${((bytes / 1024)).toFixed(1)} KB`;
  return `${((bytes / (1024 * 1024))).toFixed(1)} MB`;
};

const getDateGroup = (dateStr) => {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'This Month';
  const month = d.toLocaleString('default', { month: 'long', year: 'numeric' });
  return month;
};

const getSizeGroup = (bytes) => {
  if (!bytes) return 'Unknown';
  if (bytes < 100 * 1024) return 'Small (< 100 KB)';
  if (bytes < 1024 * 1024) return 'Medium (100 KB – 1 MB)';
  if (bytes < 5 * 1024 * 1024) return 'Large (1 – 5 MB)';
  return 'Very Large (> 5 MB)';
};

const getTypeGroup = (mimeType) => {
  if (!mimeType) return 'Other';
  if (mimeType.startsWith('image/')) return 'Images';
  if (mimeType.startsWith('video/')) return 'Videos';
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType.includes('pdf')) return 'PDFs';
  return 'Other';
};

// ─── MediaCard ───────────────────────────────────────────────────────────────

const MediaCard = ({ file, canDeleteMedia, canUpdateMedia, onCopy, onDelete, onEdit }) => {
  const url = getMediaUrl(file.url);
  return (
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
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
      }}
    >
      <Box sx={{ position: 'relative', pt: '100%' }}>
        <CardMedia
          component="img"
          image={url}
          alt={file.alt || file.originalName || file.filename || 'media'}
          sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Box>
      <Box sx={{ px: 1, pt: 0.5, flex: 1 }}>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.originalName || file.filename}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
          {formatSize(file.size)}
        </Typography>
      </Box>
      <CardActions sx={{ justifyContent: 'flex-end', p: 0.5, mt: 'auto' }}>
        <Tooltip title="Copy URL">
          <IconButton size="small" onClick={() => onCopy(url)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {canUpdateMedia && (
          <Tooltip title="Edit Metadata">
            <IconButton size="small" color="primary" onClick={() => onEdit(file)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {canDeleteMedia && (
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(file.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const MediaPage = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState(null);

  // Sorting & grouping state
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'size' | 'name'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [groupBy, setGroupBy] = useState('none'); // 'none' | 'date' | 'size' | 'type'

  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canDeleteMedia = hasPermission(PERMISSIONS.MEDIA_DELETE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);
  const canUpdateMedia = hasPermission(PERMISSIONS.MEDIA_UPDATE);

  const [editingFile, setEditingFile] = useState(null);
  const [editFormData, setEditFormData] = useState({ alt: '', description: '', caption: '', originalName: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const observerRef = useRef(null);

  const fetchMedia = async (pageNum = 1, isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await mediaService.list({ 
        page: pageNum, 
        limit: 30,
        sortBy,
        sortDir
      });
      
      const newFiles = res.data || [];
      const meta = res.meta || {};
      
      if (pageNum === 1) {
        setFiles(newFiles);
      } else {
        setFiles((prev) => [...prev, ...newFiles]);
      }

      setTotalItems(meta.totalItems || meta.total || 0);
      setHasMore(newFiles.length > 0 && (meta.page < meta.totalPages));
      setPage(pageNum);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load media library. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchMedia(1);
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

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchMedia(page + 1, true);
    }
  };

  const handleDelete = async (id) => {
    if (!canDeleteMedia) { notify('You do not have permission to delete media.', 'error'); return; }
    if (!(await confirm('Delete File', 'Delete this file?', 'danger'))) return;
    try {
      await mediaService.delete(id);
      fetchMedia(1);
    } catch {
      notify('Failed to delete file.', 'error');
    }
  };

  const handleEditClick = (file) => {
    setEditingFile(file);
    setEditFormData({
      alt: file.alt || '',
      description: file.description || '',
      caption: file.caption || '',
      originalName: file.originalName || file.filename || '',
    });
  };

  const handleUpdate = async () => {
    if (!editingFile) return;
    setSavingEdit(true);
    try {
      await mediaService.update(editingFile.id, editFormData);
      notify('Media metadata updated successfully.', 'success');
      setEditingFile(null);
      fetchMedia(1); // Refresh library to show updates
    } catch (err) {
      console.error('Update failed', err);
      const message = err.response?.data?.message || err.message || 'Failed to update media metadata.';
      notify(message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const copyUrl = async (url) => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) throw new Error('Copy command was not available.');
      }
      notify('Media URL copied to clipboard successfully.', 'success');
    } catch (err) {
      console.error('Copy failed', err);
      notify('Unable to copy automatically. Please copy the URL manually.', 'warning');
    }
  };

  const toggleSortDir = () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  // ─── Sort & Group ──────────────────────────────────────────────────────────

  const sortedFiles = files; // Server already sorted these

  const groupedFiles = useMemo(() => {
    if (groupBy === 'none') return { _all: sortedFiles };

    return sortedFiles.reduce((acc, file) => {
      let key = 'Unknown';
      if (groupBy === 'date') key = getDateGroup(file.createdAt);
      else if (groupBy === 'size') key = getSizeGroup(file.size);
      else if (groupBy === 'type') key = getTypeGroup(file.mimeType || file.mime_type);
      if (!acc[key]) acc[key] = [];
      acc[key].push(file);
      return acc;
    }, {});
  }, [sortedFiles, groupBy]);

  const groupKeys = Object.keys(groupedFiles);

  // ─── Render ────────────────────────────────────────────────────────────────

  const renderGrid = (fileList) => (
    <Grid container spacing={2}>
      {fileList.map((file) => (
        <Grid item key={file.id} xs={6} sm={4} md={3} lg={2}>
          <MediaCard
            file={file}
            canDeleteMedia={canDeleteMedia}
            canUpdateMedia={canUpdateMedia}
            onCopy={copyUrl}
            onDelete={handleDelete}
            onEdit={handleEditClick}
          />
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Media Library</Typography>
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

      {/* Controls toolbar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          mb: 3,
          p: 2,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Sort by */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel id="media-page-sort-label">Sort by</InputLabel>
          <Select 
            labelId="media-page-sort-label"
            id="media-page-sort"
            value={sortBy} 
            label="Sort by" 
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="date"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CalendarTodayIcon fontSize="small" /> Date</Box></MenuItem>
            <MenuItem value="size"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><StorageIcon fontSize="small" /> Size</Box></MenuItem>
            <MenuItem value="name"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CategoryIcon fontSize="small" /> Name</Box></MenuItem>
          </Select>
        </FormControl>

        {/* Sort direction */}
        <Tooltip title={sortDir === 'asc' ? 'Ascending' : 'Descending'}>
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
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Group by */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="media-page-group-label">Group by</InputLabel>
          <Select 
            labelId="media-page-group-label"
            value={groupBy} 
            label="Group by" 
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <MenuItem value="none"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><LayersClearIcon fontSize="small" /> No Grouping</Box></MenuItem>
            <MenuItem value="date"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CalendarTodayIcon fontSize="small" /> Date</Box></MenuItem>
            <MenuItem value="size"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><StorageIcon fontSize="small" /> Size</Box></MenuItem>
            <MenuItem value="type"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CategoryIcon fontSize="small" /> File Type</Box></MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ ml: 'auto' }}>
          <Typography variant="body2" color="text.secondary">
            {totalItems} file{totalItems !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={() => fetchMedia(1)}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {loading && files.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !loading && files.length === 0 && !error ? (
        <Alert severity="info">
          No media files uploaded yet. Click the Upload button to add images.
        </Alert>
      ) : (
        <>
          {groupBy === 'none' ? (
            renderGrid(sortedFiles)
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groupKeys.map((group) => (
                <Box key={group}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {group}
                    </Typography>
                    <Chip
                      label={groupedFiles[group].length}
                      size="small"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                    <Divider sx={{ flex: 1, ml: 1 }} />
                  </Box>
                  {renderGrid(groupedFiles[group])}
                </Box>
              ))}
            </Box>
          )}

          {/* Pagination / Infinite Scroll */}
          {hasMore && (
            <Box 
              sx={{ display: 'flex', justifyContent: 'center', py: 4 }}
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
              onUploadSuccess={() => { fetchMedia(1); setUploadDialogOpen(false); }}
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

      {/* Edit Metadata Dialog */}
      <Dialog
        open={Boolean(editingFile)}
        onClose={() => !savingEdit && setEditingFile(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Media Metadata</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 1 }}>
            {editingFile && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                <Card variant="outlined" sx={{ width: 120, height: 120, borderRadius: 2 }}>
                  <CardMedia
                    component="img"
                    image={getMediaUrl(editingFile.url)}
                    alt={editingFile.alt || editingFile.originalName || 'Preview'}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Card>
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Filename"
                fullWidth
                value={editFormData.originalName}
                onChange={(e) => setEditFormData({ ...editFormData, originalName: e.target.value })}
                helperText="The display name of the file"
              />
              <TextField
                label="Alt Text"
                fullWidth
                value={editFormData.alt}
                onChange={(e) => setEditFormData({ ...editFormData, alt: e.target.value })}
                helperText="Describe the purpose of the image. Important for SEO and accessibility."
              />
              <TextField
                label="Caption"
                fullWidth
                value={editFormData.caption}
                onChange={(e) => setEditFormData({ ...editFormData, caption: e.target.value })}
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setEditingFile(null)}
            disabled={savingEdit}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={savingEdit}
            variant="contained"
            sx={{ borderRadius: 2, px: 3 }}
            startIcon={savingEdit ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {savingEdit ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MediaPage;
