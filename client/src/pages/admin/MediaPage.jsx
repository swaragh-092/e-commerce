import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Tabs,
  Tab,
  InputAdornment,
  Checkbox,
  FormControlLabel,
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
import SearchIcon from '@mui/icons-material/Search';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { mediaService } from '../../services/mediaService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import MediaUploader from '../../components/common/MediaUploader';
import { getMediaUrl } from '../../utils/media';
import CategoryIconRenderer, { CATEGORY_ICONS } from '../../components/common/CategoryIcon';

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

const MediaCard = ({ file, canDeleteMedia, canUpdateMedia, onCopy, onDelete, onEdit, selected, onSelect, busy }) => {
  const url = getMediaUrl(file.url);
  const usageCount = Number(file.usageCount) || 0;
  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
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
        {canDeleteMedia && <Checkbox checked={selected} disabled={busy} onChange={() => onSelect(file)}
          inputProps={{ 'aria-label': `Select ${file.originalName || file.filename || 'image'}` }}
          sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'background.paper', borderRadius: 1, '&:hover': { bgcolor: 'background.paper' } }} />}
      </Box>
      <Box sx={{ px: 1, pt: 0.5, flex: 1 }}>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.originalName || file.filename}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
          {formatSize(file.size)}
        </Typography>
        <Tooltip title="Counts saved references in products, tags, galleries, blogs, product attributes, and account avatars.">
          <Typography variant="caption" color={usageCount > 0 ? 'text.secondary' : 'warning.dark'} sx={{ display: 'block', fontSize: '0.65rem', cursor: 'help' }}>
            {usageCount > 0 ? `Used ${usageCount} ${usageCount === 1 ? 'time' : 'times'}` : 'Unused'}
          </Typography>
        </Tooltip>
      </Box>
      <CardActions sx={{ justifyContent: 'flex-end', p: 0.5, mt: 'auto' }}>
        <Tooltip title="Copy URL">
          <IconButton size="small" disabled={busy} onClick={() => onCopy(url)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {canUpdateMedia && (
          <Tooltip title="Edit Metadata">
            <IconButton size="small" color="primary" disabled={busy} onClick={() => onEdit(file)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {canDeleteMedia && (
          <Tooltip title="Delete">
            <IconButton size="small" color="error" disabled={busy} onClick={() => onDelete(file.id)}>
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
  const [usageFilter, setUsageFilter] = useState('all');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const selectedIds = useMemo(() => new Set(selectedFiles.map((file) => file.id)), [selectedFiles]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [deleteFailures, setDeleteFailures] = useState([]);
  const deleteBusyRef = useRef(false);
  const mediaGenerationRef = useRef(0);

  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canDeleteMedia = hasPermission(PERMISSIONS.MEDIA_DELETE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);
  const canUpdateMedia = hasPermission(PERMISSIONS.MEDIA_UPDATE);

  const [editingFile, setEditingFile] = useState(null);
  const [editFormData, setEditFormData] = useState({ alt: '', description: '', caption: '', originalName: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [manualCopyUrl, setManualCopyUrl] = useState('');
  const [activeLibrary, setActiveLibrary] = useState('files');
  const [iconSearch, setIconSearch] = useState('');
  const [customIcons, setCustomIcons] = useState([]);
  const [customIconsLoading, setCustomIconsLoading] = useState(false);
  const [uploadIconDialogOpen, setUploadIconDialogOpen] = useState(false);
  const [iconSectionTab, setIconSectionTab] = useState('all');
  const observerRef = useRef(null);

  const fetchCustomIcons = useCallback(async () => {
    if (!mediaService.listIcons && !mediaService.list) return;
    try {
      setCustomIconsLoading(true);
      const res = mediaService.listIcons
        ? await mediaService.listIcons({ limit: 100 })
        : await mediaService.list({ type: 'icon', limit: 100 });
      setCustomIcons(res?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCustomIconsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeLibrary === 'icons') {
      fetchCustomIcons();
    }
  }, [activeLibrary, fetchCustomIcons]);

  const fetchMedia = async (pageNum = 1, isLoadMore = false) => {
    const generation = pageNum === 1 ? ++mediaGenerationRef.current : mediaGenerationRef.current;
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await mediaService.list({ 
        page: pageNum, 
        limit: 30,
        sortBy,
        sortDir,
        usage: usageFilter,
      });
      
      if (generation !== mediaGenerationRef.current) return;
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
      if (generation === mediaGenerationRef.current) setError('Failed to load media library. Please try again.');
    } finally {
      if (generation === mediaGenerationRef.current) { setLoading(false); setLoadingMore(false); }
    }
  };

  useEffect(() => { setSelectedFiles([]); setDeleteFailures([]); }, [sortBy, sortDir, usageFilter, activeLibrary]);

  useEffect(() => {
    fetchMedia(1);
    return () => { mediaGenerationRef.current += 1; };
  }, [sortBy, sortDir, usageFilter]);

  // Infinite scroll observer
  useEffect(() => {
    if (activeLibrary !== 'files' || !hasMore || loading || loadingMore || batchDeleting) return;

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
  }, [activeLibrary, hasMore, loading, loadingMore, batchDeleting]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && !deleteBusyRef.current && hasMore) {
      fetchMedia(page + 1, true);
    }
  };

  const toggleSelection = (file) => setSelectedFiles((current) => current.some((item) => item.id === file.id)
    ? current.filter((item) => item.id !== file.id) : [...current, file]);
  const selectLoaded = (checked) => setSelectedFiles((current) => checked
    ? Array.from(new Map([...current, ...files].map((file) => [file.id, file])).values())
    : current.filter((file) => !files.some((loaded) => loaded.id === file.id)));
  const handleBulkDelete = async () => {
    if (!canDeleteMedia || !selectedFiles.length || deleteBusyRef.current) return;
    deleteBusyRef.current = true;
    const selection = [...selectedFiles];
    try {
      const used = selection.filter((file) => Number(file.usageCount) > 0).length;
      const warning = used ? ` ${used} selected ${used === 1 ? 'image is' : 'images are'} in use. Deleting them can remove images from your products or other pages.` : '';
      if (!(await confirm('Delete selected images', `Permanently delete ${selection.length} selected ${selection.length === 1 ? 'image' : 'images'}? This cannot be undone.${warning}`, 'danger'))) return;
      setBatchDeleting(true); setDeleteProgress(0); setDeleteTotal(selection.length); setDeleteFailures([]);
      mediaGenerationRef.current += 1;
      setLoading(false); setLoadingMore(false);
      const deleted = new Set();
      const failed = [];
      // Reuse the permission-checked delete endpoint with bounded concurrency.
      for (let offset = 0; offset < selection.length; offset += 4) {
        const chunk = selection.slice(offset, offset + 4);
        const results = await Promise.allSettled(chunk.map((file) => mediaService.delete(file.id)));
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') deleted.add(chunk[index].id);
          else failed.push({ ...chunk[index], message: getApiErrorMessage(result.reason, 'Could not delete this image.') });
        });
        setDeleteProgress(Math.min(offset + chunk.length, selection.length));
      }
      setFiles((current) => current.filter((file) => !deleted.has(file.id)));
      setTotalItems((current) => Math.max(0, current - deleted.size));
      setSelectedFiles(failed);
      setDeleteFailures(failed);
      if (deleted.size) notify(`Deleted ${deleted.size} ${deleted.size === 1 ? 'image' : 'images'}.`, 'success');
      if (failed.length) notify(`${failed.length} ${failed.length === 1 ? 'image could' : 'images could'} not be deleted. Review the results and retry.`, 'warning');
      await fetchMedia(1);
    } finally {
      setBatchDeleting(false);
      deleteBusyRef.current = false;
    }
  };

  const handleDelete = async (id) => {
    if (deleteBusyRef.current) return;
    if (!canDeleteMedia) { notify('You do not have permission to delete media.', 'error'); return; }
    if (!(await confirm('Delete File', 'Delete this file?', 'danger'))) return;
    try {
      await mediaService.delete(id);
      setSelectedFiles((current) => current.filter((file) => file.id !== id));
      setDeleteFailures((current) => current.filter((file) => file.id !== id));
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
    const absoluteUrl = new URL(url, window.location.origin).href;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(absoluteUrl);
        notify('Media URL copied to clipboard successfully.', 'success');
        return;
      }
    } catch (err) {
      console.error('Copy failed', err);
    }

    setManualCopyUrl(absoluteUrl);
    notify('Automatic copy is unavailable here. Copy the URL manually from the dialog.', 'warning');
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
  const filteredCustomIcons = useMemo(() => {
    const query = iconSearch.trim().toLowerCase();
    if (!query) return customIcons;
    return customIcons.filter((icon) =>
      `${icon.originalName || ''} ${icon.filename || ''} ${icon.url || ''}`.toLowerCase().includes(query)
    );
  }, [customIcons, iconSearch]);

  const filteredIcons = useMemo(() => {
    const query = iconSearch.trim().toLowerCase();
    if (!query) return CATEGORY_ICONS;
    return CATEGORY_ICONS.filter(({ id, label, keywords }) =>
      `${id} mui:${id} ${label} ${keywords}`.toLowerCase().includes(query));
  }, [iconSearch]);

  const totalMatchingIcons = filteredIcons.length + filteredCustomIcons.length;

  const copyIconId = async (id) => {
    try {
      await navigator.clipboard.writeText(`mui:${id}`);
      notify('Icon ID copied.', 'success');
    } catch {
      notify('Could not copy the icon ID in this browser.', 'warning');
    }
  };

  const copyCustomIconUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      notify('Icon URL copied.', 'success');
    } catch {
      notify('Could not copy icon URL.', 'warning');
    }
  };

  const handleDeleteCustomIcon = async (icon) => {
    if (!canDeleteMedia) {
      notify('You do not have permission to delete media.', 'error');
      return;
    }
    const name = icon.originalName || icon.filename || 'this icon';
    if (!(await confirm('Delete Icon', `Delete "${name}"?`, 'danger'))) return;
    try {
      await mediaService.delete(icon.id);
      notify('Custom icon deleted.', 'success');
      fetchCustomIcons();
    } catch {
      notify('Failed to delete icon.', 'error');
    }
  };

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
            selected={selectedIds.has(file.id)}
            onSelect={toggleSelection}
            busy={batchDeleting}
          />
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1" fontWeight={700}>Media Library</Typography>
        {activeLibrary === 'files' && canUploadMedia && (
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            disabled={batchDeleting}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Upload Media
          </Button>
        )}
        {activeLibrary === 'icons' && canUploadMedia && (
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => setUploadIconDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Upload Custom Icon
          </Button>
        )}
      </Box>

      <Tabs
        value={activeLibrary}
        onChange={(_, value) => setActiveLibrary(value)}
        aria-label="Media library sections"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab disabled={batchDeleting} id="media-files-tab" aria-controls="media-files-panel" value="files" label="Media files" />
        <Tab disabled={batchDeleting} id="media-icons-tab" aria-controls="media-icons-panel" value="icons" label="Icon library" />
      </Tabs>

      {/* Controls toolbar */}
      <Box
        role="tabpanel"
        id="media-files-panel"
        aria-labelledby="media-files-tab"
        hidden={activeLibrary !== 'files'}
      >
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
        <FormControl disabled={batchDeleting} size="small" sx={{ minWidth: 130 }}>
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
            disabled={batchDeleting}
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

        <FormControl disabled={batchDeleting} size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="media-page-usage-label">Usage</InputLabel>
          <Select
            labelId="media-page-usage-label"
            id="media-page-usage"
            value={usageFilter}
            label="Usage"
            onChange={(event) => setUsageFilter(event.target.value)}
          >
            <MenuItem value="all">All files</MenuItem>
            <MenuItem value="used">Used images</MenuItem>
            <MenuItem value="unused">Unused images</MenuItem>
          </Select>
        </FormControl>

        <Divider orientation="vertical" flexItem />

        {/* Group by */}
        <FormControl disabled={batchDeleting} size="small" sx={{ minWidth: 150 }}>
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

      {canDeleteMedia && <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
        <FormControlLabel label="Select all loaded images" control={<Checkbox
          checked={files.length > 0 && files.every((file) => selectedIds.has(file.id))}
          indeterminate={files.some((file) => selectedIds.has(file.id)) && !files.every((file) => selectedIds.has(file.id))}
          disabled={loading || batchDeleting || files.length === 0}
          onChange={(event) => selectLoaded(event.target.checked)} />} />
        <Typography variant="body2" role="status">{selectedFiles.length} selected · {files.length} loaded of {totalItems}</Typography>
        {selectedFiles.length > 0 && <Button disabled={batchDeleting} onClick={() => { setSelectedFiles([]); setDeleteFailures([]); }}>Clear selection</Button>}
        <Button color="error" variant="outlined" startIcon={<DeleteIcon />} disabled={!selectedFiles.length || batchDeleting || loading}
          onClick={handleBulkDelete}>{batchDeleting ? `Deleting ${deleteProgress} / ${deleteTotal}…` : `Delete selected (${selectedFiles.length})`}</Button>
      </Box>}
      {deleteFailures.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>
        {deleteFailures.length} {deleteFailures.length === 1 ? 'image was' : 'images were'} not deleted. They remain selected; use Delete selected to retry, or clear the selection.
        {deleteFailures.slice(0, 5).map((file) => <Typography variant="body2" key={file.id} sx={{ overflowWrap: 'anywhere' }}>{file.originalName || file.filename}: {file.message}</Typography>)}
        {deleteFailures.length > 5 && <Typography variant="body2">And {deleteFailures.length - 5} more.</Typography>}
      </Alert>}
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
          {usageFilter === 'unused'
            ? 'No unused media files found.'
            : usageFilter === 'used'
              ? 'No media files are currently in use.'
              : 'No media files uploaded yet. Click the Upload button to add images.'}
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

      </Box>

      {activeLibrary === 'icons' && (
        <Box role="tabpanel" id="media-icons-panel" aria-labelledby="media-icons-tab">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
              mb: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', flex: 1 }}>
              <TextField
                size="small"
                value={iconSearch}
                onChange={(event) => setIconSearch(event.target.value)}
                placeholder="Search icons"
                inputProps={{ 'aria-label': 'Search icon library' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ width: { xs: '100%', sm: 300 } }}
              />
              <ToggleButtonGroup
                size="small"
                value={iconSectionTab}
                exclusive
                onChange={(_, val) => val && setIconSectionTab(val)}
              >
                <ToggleButton value="all">All ({totalMatchingIcons})</ToggleButton>
                <ToggleButton value="custom">Custom ({filteredCustomIcons.length})</ToggleButton>
                <ToggleButton value="builtin">Built-in ({filteredIcons.length})</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {totalMatchingIcons} icon{totalMatchingIcons !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            These icons are available when editing a category. You can also upload your own custom icons here (PNG or WebP with transparent background).
          </Alert>

          {customIconsLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          )}

          {totalMatchingIcons > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Custom Icons Section */}
              {(iconSectionTab === 'all' || iconSectionTab === 'custom') && filteredCustomIcons.length > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Custom Icons
                    </Typography>
                    <Chip label={filteredCustomIcons.length} size="small" color="primary" sx={{ height: 20, fontSize: '0.75rem' }} />
                    <Divider sx={{ flex: 1, ml: 1 }} />
                  </Box>
                  <Grid container spacing={2}>
                    {filteredCustomIcons.map((icon) => (
                      <Grid item key={icon.id} xs={6} sm={4} md={3} lg={2}>
                        <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, textAlign: 'center', p: 1.5 }}>
                          <Box sx={{ height: 88, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', borderRadius: 1.5, mb: 1, p: 1 }}>
                            <CategoryIconRenderer value={icon.url} size={40} />
                          </Box>
                          <Typography variant="body2" fontWeight={600} noWrap title={icon.originalName || icon.filename}>
                            {icon.originalName || icon.filename}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }} noWrap>
                            custom
                          </Typography>
                          <CardActions sx={{ justifyContent: 'center', p: 0, mt: 0.5, gap: 0.5 }}>
                            <Tooltip title="Copy icon URL">
                              <IconButton size="small" aria-label={`Copy ${icon.originalName || 'custom'} icon URL`} onClick={() => copyCustomIconUrl(icon.url)}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {canDeleteMedia && (
                              <Tooltip title="Delete custom icon">
                                <IconButton size="small" color="error" aria-label={`Delete ${icon.originalName || 'custom'} icon`} onClick={() => handleDeleteCustomIcon(icon)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Built-in Icons Section */}
              {(iconSectionTab === 'all' || iconSectionTab === 'builtin') && filteredIcons.length > 0 && (
                <Box>
                  {iconSectionTab === 'all' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Built-in Icons
                      </Typography>
                      <Chip label={filteredIcons.length} size="small" sx={{ height: 20, fontSize: '0.75rem' }} />
                      <Divider sx={{ flex: 1, ml: 1 }} />
                    </Box>
                  )}
                  <Grid container spacing={2}>
                    {filteredIcons.map(({ id, label }) => (
                      <Grid item key={id} xs={6} sm={4} md={3} lg={2}>
                        <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, textAlign: 'center', p: 1.5 }}>
                          <Box sx={{ height: 88, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', borderRadius: 1.5, mb: 1 }}>
                            <CategoryIconRenderer value={`mui:${id}`} size={40} color="primary.main" />
                          </Box>
                          <Typography variant="body2" fontWeight={600}>{label}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>mui:{id}</Typography>
                          <CardActions sx={{ justifyContent: 'center', p: 0, mt: 0.5 }}>
                            <Tooltip title="Copy icon ID">
                              <IconButton size="small" aria-label={`Copy ${label} icon ID`} onClick={() => copyIconId(id)}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          ) : (
            <Alert severity="info">No icons match “{iconSearch}”.</Alert>
          )}
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

      {/* Upload Custom Icon Dialog */}
      <Dialog
        open={uploadIconDialogOpen}
        onClose={() => setUploadIconDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Upload Custom Icon</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upload square icons (PNG or WebP recommended, 64×64 or 128×128 px with transparent background). These will appear under Custom Icons and in the Category Icon Picker.
          </Alert>
          <Box sx={{ py: 1 }}>
            <MediaUploader
              onUploadSuccess={() => { fetchCustomIcons(); setUploadIconDialogOpen(false); notify('Custom icon uploaded successfully!', 'success'); }}
              multiple={true}
              autoUpload={true}
              uploadType="icon"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUploadIconDialogOpen(false)}>Close</Button>
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

      <Dialog
        open={Boolean(manualCopyUrl)}
        onClose={() => setManualCopyUrl('')}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Copy Media URL</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Media URL"
            value={manualCopyUrl}
            InputProps={{ readOnly: true }}
            onFocus={(event) => event.target.select()}
            helperText="Automatic clipboard access is unavailable in this browser context. Copy the URL manually."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualCopyUrl('')}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MediaPage;
