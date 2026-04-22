import { useState, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import StorageIcon from '@mui/icons-material/Storage';
import CategoryIcon from '@mui/icons-material/Category';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import MediaUploader from '../../components/common/MediaUploader';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const MediaCard = ({ file, baseUrl, canDeleteMedia, onCopy, onDelete }) => {
  const url = file.url?.startsWith('http') ? file.url : `${baseUrl}${file.url}`;
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
          alt={file.originalName || 'media'}
          sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Box>
      <Box sx={{ px: 1, pt: 0.5 }}>
        {/* <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ display: 'block', fontSize: '0.68rem' }}
          title={file.filename || file.originalName}
        >
          {file.filename || file.originalName || '—'}
        </Typography> */}
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
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Sorting & grouping state
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'size' | 'name'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [groupBy, setGroupBy] = useState('none'); // 'none' | 'date' | 'size' | 'type'

  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canDeleteMedia = hasPermission(PERMISSIONS.MEDIA_DELETE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const fetchMedia = () => {
    setLoading(true);
    api
      .get('/media')
      .then((res) => setFiles(res.data.data?.rows || res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMedia(); }, []);

  const handleDelete = async (id) => {
    if (!canDeleteMedia) { notify('You do not have permission to delete media.', 'error'); return; }
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

  const toggleSortDir = () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  // ─── Sort & Group ──────────────────────────────────────────────────────────

  const sortedFiles = useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      let diff = 0;
      if (sortBy === 'date') diff = new Date(a.createdAt) - new Date(b.createdAt);
      else if (sortBy === 'size') diff = (a.size || 0) - (b.size || 0);
      else if (sortBy === 'name') diff = (a.filename || '').localeCompare(b.filename || '');
      return sortDir === 'asc' ? diff : -diff;
    });
    return sorted;
  }, [files, sortBy, sortDir]);

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
            baseUrl={baseUrl}
            canDeleteMedia={canDeleteMedia}
            onCopy={copyUrl}
            onDelete={handleDelete}
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
          <InputLabel>Sort by</InputLabel>
          <Select value={sortBy} label="Sort by" onChange={(e) => setSortBy(e.target.value)}>
            <MenuItem value="date"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CalendarTodayIcon fontSize="small" /> Date</Box></MenuItem>
            <MenuItem value="size"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><StorageIcon fontSize="small" /> Size</Box></MenuItem>
            {/* <MenuItem value="name"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CategoryIcon fontSize="small" /> Name</Box></MenuItem> */}
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
          <InputLabel>Group by</InputLabel>
          <Select value={groupBy} label="Group by" onChange={(e) => setGroupBy(e.target.value)}>
            <MenuItem value="none"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><LayersClearIcon fontSize="small" /> No Grouping</Box></MenuItem>
            <MenuItem value="date"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CalendarTodayIcon fontSize="small" /> Date</Box></MenuItem>
            <MenuItem value="size"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><StorageIcon fontSize="small" /> Size</Box></MenuItem>
            <MenuItem value="type"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CategoryIcon fontSize="small" /> File Type</Box></MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ ml: 'auto' }}>
          <Typography variant="body2" color="text.secondary">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      {loading && files.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !loading && files.length === 0 ? (
        <Alert severity="info">
          No media files uploaded yet. Click the Upload button to add images.
        </Alert>
      ) : groupBy === 'none' ? (
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
              onUploadSuccess={() => { fetchMedia(); setUploadDialogOpen(false); }}
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
