import { useEffect, useState, useRef } from 'react';
import {
  Alert, Box, Button, Card, CardMedia, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch, TextField,
  Typography,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MediaPicker from '../../components/common/MediaPicker';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { getMediaUrl } from '../../utils/media';
import { galleryService } from '../../services/galleryService';

const emptyForm = { title: '', slug: '', description: '', isActive: true };
const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const messageFor = (error) => getApiErrorMessage(error, 'Something went wrong. Please try again.');

const GalleryPage = () => {
  const { hasPermission } = useAuth();
  const { notify, confirm } = useNotification();
  const canManage = hasPermission(PERMISSIONS.GALLERY_MANAGE);
  const canDelete = hasPermission(PERMISSIONS.GALLERY_DELETE);
  const canSelectMedia = canManage && hasPermission(PERMISSIONS.MEDIA_READ);
  const access = useRef({ canManage, canDelete });
  access.current = { canManage, canDelete };
  const [galleries, setGalleries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);

  useEffect(() => {
    if (!canManage) { setDialogOpen(false); setEditingId(null); setForm(emptyForm); }
    if (!canSelectMedia) setPickerOpen(false);
  }, [canManage, canSelectMedia]);

  const selected = galleries.find((gallery) => gallery.id === selectedId) || null;
  const items = [...(selected?.items || [])].sort((a, b) => a.priority - b.priority || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)));

  const cover = selected?.coverImage || items[0]?.media;

  const load = async (pageNumber = page, preferredId = selectedId) => {
    setLoading(true);
    setError('');
    try {
      const result = await galleryService.list({ page: pageNumber, limit: 20 });
      const rows = result.data || [];
      setGalleries(rows);
      setTotalPages(Math.max(1, result.meta?.totalPages || 1));
      setSelectedId(rows.find((gallery) => gallery.id === preferredId)?.id || rows[0]?.id || null);
      return rows;
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [page]);

  const updateSelected = (gallery) => {
    setGalleries((current) => current.map((item) => item.id === gallery.id ? gallery : item));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditingId(selected.id);
    setForm({ title: selected.title, slug: selected.slug, description: selected.description || '', isActive: selected.isActive });
    setDialogOpen(true);
  };

  const saveGallery = async () => {
    if (!access.current.canManage) return;
    const payload = { ...form, title: form.title.trim(), slug: slugify(form.slug), description: form.description.trim() };
    if (!payload.title || !payload.slug) return;
    setBusy(true);
    try {
      if (editingId) {
        const result = await galleryService.update(editingId, payload);
        updateSelected({ ...selected, ...result.data });
        notify('Gallery updated.', 'success');
      } else {
        const result = await galleryService.create(payload);
        if (page === 1) await load(1, result.data.id);
        else { setPage(1); setSelectedId(result.data.id); }
        notify('Gallery created. Add images to it now.', 'success');
      }
      setDialogOpen(false);
    } catch (err) {
      notify(messageFor(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!access.current.canManage) return;
    if (!selected) return;
    setBusy(true);
    try {
      const result = await galleryService.update(selected.id, { isActive: !selected.isActive });
      updateSelected({ ...selected, ...result.data });
      notify(result.data.isActive ? 'Gallery is visible on the public page.' : 'Gallery is hidden from the public page.', 'success');
    } catch (err) { notify(messageFor(err), 'error'); }
    finally { setBusy(false); }
  };

  const deleteGallery = async () => {
    if (!selected || !await confirm({ title: 'Delete gallery?', message: `Delete “${selected.title}” and remove its images from this gallery? The media files will remain in the library.`, severity: 'error' })) return;
    if (!access.current.canDelete) return;
    setBusy(true);
    try {
      await galleryService.remove(selected.id);
      const rows = await load(page, null);
      if (rows && !rows.length && page > 1) setPage(page - 1);
      notify('Gallery deleted.', 'success');
    } catch (err) { notify(messageFor(err), 'error'); }
    finally { setBusy(false); }
  };

  const addImages = async (media) => {
    if (!access.current.canManage || !hasPermission(PERMISSIONS.MEDIA_READ) || !selected) return;
    const existingIds = new Set(items.map((item) => item.mediaId));
    const ids = [...new Set((media || []).filter((item) => item.mimeType?.startsWith('image/') && !existingIds.has(item.id)).map((item) => item.id))];
    if (!ids.length) { notify('Select images that are not already in this gallery.', 'info'); return; }
    setBusy(true);
    try {
      const result = await galleryService.addImages(selected.id, ids);
      updateSelected(result.data);
      notify(`${ids.length} image${ids.length === 1 ? '' : 's'} added.`, 'success');
    } catch (err) { notify(messageFor(err), 'error'); }
    finally { setBusy(false); }
  };

  const saveCover = async (media = null) => {
    if (media && !media.mimeType?.startsWith('image/')) {
      notify('Select an image for the cover photo.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const result = await galleryService.update(selected.id, { coverMediaId: media?.id || null });
      updateSelected({ ...selected, ...result.data });
      notify(media ? 'Gallery cover photo updated.' : 'The first gallery image will be used as the cover.', 'success');
    } catch (err) { notify(messageFor(err), 'error'); }
    finally { setBusy(false); }
  };

  const removeImage = async (item) => {
    if (!await confirm({ title: 'Remove image?', message: 'Remove this image from the gallery? The media file will remain in the library.', severity: 'error' })) return;
    if (!access.current.canDelete) return;
    setBusy(true);
    try {
      await galleryService.removeImage(selected.id, item.id);
      updateSelected({ ...selected, items: items.filter((row) => row.id !== item.id) });
      notify('Image removed from gallery.', 'success');
    } catch (err) { notify(messageFor(err), 'error'); }
    finally { setBusy(false); }
  };

  const moveImage = async (index, direction) => {
    if (!access.current.canManage) return;
    const next = [...items];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setBusy(true);
    try {
      const result = await galleryService.reorder(selected.id, next.map((item) => item.id));
      updateSelected(result.data);
    } catch (err) { notify(messageFor(err), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box><Typography variant="h5" component="h1" fontWeight={700}>Gallery</Typography><Typography color="text.secondary">Organize gallery images into albums. Images are selected from the Media Library.</Typography></Box>
        {canManage && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New gallery</Button>}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => load(page)}>Retry</Button>}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px minmax(0,1fr)' }, gap: 3 }}>
          <Card variant="outlined" sx={{ p: 2, alignSelf: 'start' }}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>Galleries</Typography>
            {!galleries.length && <Typography color="text.secondary">No galleries yet. Create one to organize your images.</Typography>}
            <Stack spacing={1}>
              {galleries.map((gallery) => <Button key={gallery.id} fullWidth variant={selectedId === gallery.id ? 'contained' : 'outlined'} onClick={() => setSelectedId(gallery.id)} sx={{ justifyContent: 'space-between', textTransform: 'none' }}>
                <span>{gallery.title}</span><Chip size="small" label={gallery.items?.length || 0} />
              </Button>)}
            </Stack>
            {totalPages > 1 && <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
              <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Typography variant="body2">{page} / {totalPages}</Typography><Button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </Stack>}
          </Card>
          {selected && <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
              <Box><Typography variant="h6" fontWeight={700}>{selected.title}</Typography><Typography color="text.secondary">{selected.description || `Public album: ${selected.slug}`}</Typography></Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={selected.isActive ? 'Public' : 'Hidden'} color={selected.isActive ? 'success' : 'default'} size="small" />
                {canManage && <IconButton aria-label="Edit gallery" disabled={busy} onClick={openEdit}><EditOutlinedIcon /></IconButton>}
                {canDelete && <IconButton aria-label="Delete gallery" color="error" disabled={busy} onClick={deleteGallery}><DeleteOutlineIcon /></IconButton>}
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Public URL: /demo-orbis-seeds-v1-html/gallery-detail.html?album={selected.slug}</Typography>
            <Box sx={{ mb: 3 }}>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Gallery cover photo</Typography>
              {cover?.url && <Box component="img" src={getMediaUrl(cover.url)} alt="Gallery cover preview" sx={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 1, mb: 1 }} />}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {selected.coverMediaId ? 'Using a selected cover photo.' : 'The first image in this gallery is used automatically when no cover photo is selected.'}
              </Typography>
              {canManage && <Stack direction="row" spacing={1}>
                <Button variant="outlined" disabled={busy} onClick={() => setCoverPickerOpen(true)}>Choose cover photo</Button>
                {selected.coverMediaId && <Button disabled={busy} onClick={() => saveCover()}>Use first image</Button>}
              </Stack>}
            </Box>
            {canManage && <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
              <Button variant="contained" startIcon={<AddPhotoAlternateIcon />} disabled={busy || !canSelectMedia} onClick={() => setPickerOpen(true)}>Add images</Button>
              <FormControlLabel control={<Switch checked={Boolean(selected.isActive)} disabled={busy} onChange={toggleActive} />} label="Visible on public gallery" />
            </Stack>}
            {canManage && !canSelectMedia && <Alert severity="info" sx={{ mb: 2 }}>Media Read permission is required to select images from the library.</Alert>}
            {!items.length ? <Alert severity="info">This gallery has no images yet. Add some from the Media Library.</Alert> : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 2 }}>
                {items.map((item, index) => <Card variant="outlined" key={item.id}>
                  <CardMedia component="img" image={getMediaUrl(item.media?.url)} alt={item.media?.alt || item.media?.originalName || 'Gallery image'} sx={{ height: 155, objectFit: 'cover' }} />
                  <Box sx={{ p: 1 }}><Typography variant="body2" noWrap title={item.media?.originalName || item.media?.caption}>{item.media?.caption || item.media?.originalName || `Image ${index + 1}`}</Typography>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">#{index + 1}</Typography>
                      <Box>
                        {canManage && <><IconButton size="small" aria-label={`Move image ${index + 1} up`} disabled={busy || index === 0} onClick={() => moveImage(index, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton><IconButton size="small" aria-label={`Move image ${index + 1} down`} disabled={busy || index === items.length - 1} onClick={() => moveImage(index, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></>}
                        {canDelete && <IconButton size="small" aria-label={`Remove image ${index + 1}`} disabled={busy} onClick={() => removeImage(item)}><DeleteOutlineIcon fontSize="small" /></IconButton>}
                      </Box>
                    </Stack>
                  </Box>
                </Card>)}
              </Box>
            )}
          </Card>}
        </Box>
      )}
      <Dialog open={canManage && dialogOpen} onClose={busy ? undefined : () => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Edit gallery' : 'New gallery'}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <TextField autoFocus label="Gallery name" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: editingId ? current.slug : slugify(event.target.value) }))} required fullWidth />
          <TextField label="URL slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))} helperText="Used in the public gallery URL" required fullWidth />
          <TextField label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} multiline minRows={2} fullWidth />
          <FormControlLabel control={<Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />} label="Visible on public gallery" />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setDialogOpen(false)} disabled={busy}>Cancel</Button><Button variant="contained" onClick={saveGallery} disabled={busy || !form.title.trim() || !slugify(form.slug)}>{editingId ? 'Save changes' : 'Create gallery'}</Button></DialogActions>
      </Dialog>
      <MediaPicker open={canSelectMedia && pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addImages} multiple title="Add gallery images" />
    </Box>
  );
};

export default GalleryPage;
