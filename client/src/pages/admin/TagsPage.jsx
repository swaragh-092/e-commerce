import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography, MenuItem, FormControl, InputLabel, Select, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MediaPicker from '../../components/common/MediaPicker';
import { getMediaUrl, onImageError } from '../../utils/media';
import { Link } from 'react-router-dom';
import { getTags, createTag, renameTag, deleteTag } from '../../services/tagService';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

const tagUrl = (slug) => new URL(`/tags/${encodeURIComponent(slug)}`, import.meta.env.VITE_APP_URL || window.location.origin).href;

export default function TagsPage() {
  const { hasPermission } = useAuth();
  const { notify } = useNotification();
  const canCreate = hasPermission(PERMISSIONS.PRODUCTS_CREATE) || hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canRename = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PRODUCTS_DELETE);
  const canReadProducts = hasPermission(PERMISSIONS.PRODUCTS_READ);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [usage, setUsage] = useState('all');
  const [sort, setSort] = useState('name-asc');
  const [discard, setDiscard] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const canPickMedia = hasPermission(PERMISSIONS.MEDIA_READ) || hasPermission(PERMISSIONS.MEDIA_UPLOAD);
  const [manualCopy, setManualCopy] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [edit, setEdit] = useState(null);
  const [remove, setRemove] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const dirty = Boolean(edit && (edit.name !== edit.initialName || edit.description !== edit.initialDescription || (edit.imageId || null) !== edit.initialImageId));
  const closeEditor = () => { if (!saving) { if (dirty) setDiscard(true); else setEdit(null); } };
  const openEditor = (tag = {}) => {
    setDialogError('');
    setEdit({ ...tag, name: tag.name || '', description: tag.description || '', imageId: tag.imageId || tag.image?.id || null, initialImageId: tag.imageId || tag.image?.id || null, initialName: tag.name || '', initialDescription: tag.description || '' });
  };
  const copyLink = async (slug) => {
    const url = tagUrl(slug);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      notify('Storefront link copied.', 'success');
    } catch { setManualCopy(url); }
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(input.trim()); setPage(0); }, 250);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getTags({ search, page: page + 1, limit: 20, usage, sortBy: sort.split('-')[0], sortDir: sort.split('-')[1] }).then((res) => {
      if (!active) return;
      setRows(res.data || []); setTotal(res.meta?.total || 0);
      if (page > 0 && !res.data?.length) setPage((current) => current - 1);
    }).catch((err) => {
      if (active) setError(getApiErrorMessage(err, 'Could not load tags.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, page, revision, usage, sort]);

  const save = async (event) => {
    event.preventDefault();
    const name = edit.name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (!name || name.length > 100 || /[\p{Cc}\p{Cf},]/u.test(name)) {
      setDialogError('Use 1–100 characters without commas or control characters.'); return;
    }
    setSaving(true); setDialogError('');
    try {
      if (edit.id) await renameTag(edit.id, name, edit.description.trim(), edit.imageId); else await createTag(name, edit.description.trim(), edit.imageId);
      notify(edit.id ? 'Tag updated across all products.' : 'Tag created.', 'success');
      setEdit(null); refresh();
    } catch (err) { setDialogError(getApiErrorMessage(err, 'Could not save tag.')); }
    finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    setSaving(true); setDialogError('');
    try {
      await deleteTag(remove.id); setRemove(null); refresh();
      notify('Tag deleted and removed from linked products. Products remain in your catalog.', 'success');
    } catch (err) { setDialogError(getApiErrorMessage(err, 'Could not delete tag.')); }
    finally { setSaving(false); }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} mb={2}>
        <Typography variant="h4" component="h1" fontWeight={700}>Tags</Typography>
        {canCreate && <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEditor()}>Add tag</Button>}
      </Stack>
      <Typography color="text.secondary" mb={3}>Group products across categories with reusable labels. Renaming a tag updates its label everywhere and keeps existing links working.</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={2} mb={2}>
        <TextField label="Search tags" value={input} onChange={(e) => setInput(e.target.value)} size="small" inputProps={{ maxLength: 100 }} sx={{ width: { xs: '100%', sm: 320 } }} />
        <FormControl size="small" sx={{ minWidth: 160 }}><InputLabel id="tag-usage-label">Usage</InputLabel>
          <Select labelId="tag-usage-label" label="Usage" value={usage} onChange={(e) => { setUsage(e.target.value); setPage(0); }}>
            <MenuItem value="all">All tags</MenuItem><MenuItem value="used">Used tags</MenuItem><MenuItem value="unused">Unused tags</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 210 }}><InputLabel id="tag-sort-label">Sort by</InputLabel>
          <Select labelId="tag-sort-label" label="Sort by" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }}>
            <MenuItem value="name-asc">Name: A–Z</MenuItem><MenuItem value="name-desc">Name: Z–A</MenuItem>
            <MenuItem value="products-desc">Most products</MenuItem><MenuItem value="products-asc">Fewest products</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {error ? <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Retry</Button>}>{error}</Alert> : (
        <Paper variant="outlined">
          <TableContainer>
            <Table aria-label="Product tags">
              <TableHead><TableRow><TableCell>Name</TableCell><TableCell>URL slug</TableCell><TableCell align="right">Products</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} aria-label="Loading tags" /></TableCell></TableRow> : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4}><Typography color="text.secondary" py={3}>{search || usage !== 'all' ? 'No tags match your search and filters.' : 'No tags yet. Add a tag here or while editing a product.'}</Typography></TableCell></TableRow>
                ) : rows.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}><Stack direction="row" gap={1.5} alignItems="center">{tag.image?.url && <Box component="img" src={getMediaUrl(tag.image.url)} alt="" onError={onImageError()} sx={{ width: 44, height: 44, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }} />}<Typography variant="body2" fontWeight={600}>{tag.name}</Typography></Stack>{Number(tag.productCount) === 0 && <Chip label="Unused" size="small" variant="outlined" sx={{ mt: 0.5 }} />}</TableCell>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>{tag.slug}</TableCell>
                    <TableCell align="right">{canReadProducts ? <Button component={Link} to={`/admin/products?tags=${encodeURIComponent(tag.slug)}`} size="small" aria-label={`View products tagged ${tag.name}`}>{tag.productCount}</Button> : tag.productCount}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="View storefront page"><IconButton component="a" href={tagUrl(tag.slug)} target="_blank" rel="noopener noreferrer" aria-label={`View storefront page for ${tag.name}`}><OpenInNewIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Copy storefront link"><IconButton aria-label={`Copy storefront link for ${tag.name}`} onClick={() => copyLink(tag.slug)}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                      {canRename && <Tooltip title="Edit tag"><IconButton aria-label={`Edit ${tag.name}`} onClick={() => openEditor(tag)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                      {canDelete && <Tooltip title="Delete tag"><IconButton aria-label={`Delete ${tag.name}`} onClick={() => { setDialogError(''); setRemove(tag); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} rowsPerPage={20} rowsPerPageOptions={[20]} onPageChange={(_, next) => setPage(next)} />
        </Paper>
      )}
      <Dialog open={Boolean(edit)} onClose={closeEditor} fullWidth maxWidth="sm" aria-labelledby="tag-editor-title">
        <Box component="form" onSubmit={save}>
          <DialogTitle id="tag-editor-title" sx={{ pr: 7 }}>{edit?.id ? 'Edit tag' : 'Add tag'}<IconButton aria-label="Close tag editor" disabled={saving} onClick={closeEditor} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseIcon /></IconButton></DialogTitle>
          <DialogContent>
            {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
            <TextField autoFocus fullWidth required label="Tag name" value={edit?.name || ''} onChange={(e) => setEdit((current) => ({ ...current, name: e.target.value }))} margin="dense" inputProps={{ maxLength: 100 }} disabled={saving} helperText="Examples: Beginner Friendly, Home Gardening, Summer Planting" />
            <TextField fullWidth multiline minRows={3} label="Description (optional)" InputLabelProps={{ shrink: true }} value={edit?.description || ''} onChange={(e) => setEdit((current) => ({ ...current, description: e.target.value }))} margin="normal" inputProps={{ maxLength: 2000 }} disabled={saving} helperText={<Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}><span>Shown on the storefront tag page.</span><span>{(edit?.description || '').length.toLocaleString()} / 2,000</span></Box>} />
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Tag image (optional)</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>Shown beside the tag name and on its storefront page.</Typography>
              {edit?.image?.url && <Box component="img" src={getMediaUrl(edit.image.url)} alt="Selected tag image" onError={onImageError()} sx={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 1, display: 'block', mb: 1 }} />}
              <Stack direction="row" gap={1}>
                {canPickMedia && <Button variant="outlined" disabled={saving} onClick={() => setPickerOpen(true)}>{edit?.imageId ? 'Change image' : 'Select image'}</Button>}
                {edit?.imageId && <Button disabled={saving} color="error" onClick={() => setEdit((current) => ({ ...current, imageId: null, image: null }))}>Remove image</Button>}
              </Stack>
              {!canPickMedia && <Typography variant="caption" color="text.secondary">Media Library access is required to select an image.</Typography>}
            </Box>
            {edit?.id ? <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2">Storefront link</Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere', mt: 0.5 }}>{tagUrl(edit.slug)}</Typography>
              <Typography variant="caption" color="text.secondary">Renaming this tag keeps its existing URL.</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" mt={1}>
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copyLink(edit.slug)}>Copy link</Button>
                <Button size="small" startIcon={<OpenInNewIcon />} component="a" href={tagUrl(edit.slug)} target="_blank" rel="noopener noreferrer">View page</Button>
              </Stack>
              <Typography variant="body2" mt={1}>Used by {Number(edit.productCount) || 0} {Number(edit.productCount) === 1 ? 'product' : 'products'}.</Typography>
              {canReadProducts && <Button size="small" component={Link} target="_blank" rel="noopener noreferrer" to={`/admin/products?tags=${encodeURIComponent(edit.slug)}`}>View products</Button>}
              <Typography variant="caption" color="text.secondary" display="block">The storefront page is available when a linked product is published and enabled.</Typography>
            </Box> : <Typography variant="body2" color="text.secondary" mt={1}>A storefront link will be generated when you create this tag.</Typography>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}><Button disabled={saving} onClick={closeEditor}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : edit?.id ? 'Save changes' : 'Save tag'}</Button></DialogActions>
        </Box>
      </Dialog>
      <Dialog open={Boolean(remove)} onClose={() => { if (!saving) setRemove(null); }} fullWidth maxWidth="xs">
        <DialogTitle>Delete “{remove?.name}”?</DialogTitle>
        <DialogContent>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          <DialogContentText>This permanently deletes the tag and removes it from {remove?.productCount || 0} {Number(remove?.productCount) === 1 ? 'product' : 'products'}. The products will remain in your catalog. Its storefront page will no longer be available.</DialogContentText>
        </DialogContent>
        <DialogActions><Button disabled={saving} onClick={() => setRemove(null)}>Cancel</Button><Button color="error" variant="contained" disabled={saving} onClick={confirmDelete}>{saving ? 'Deleting…' : 'Delete tag'}</Button></DialogActions>
      </Dialog>
      {pickerOpen && <MediaPicker open onClose={() => setPickerOpen(false)} title="Select tag image" multiple={false} onSelect={(images) => {
        if (images?.[0]) setEdit((current) => current ? ({ ...current, imageId: images[0].id, image: images[0] }) : current);
        setPickerOpen(false);
      }} />}
      <Dialog open={discard} onClose={() => setDiscard(false)} aria-labelledby="discard-tag-title" maxWidth="xs" fullWidth>
        <DialogTitle id="discard-tag-title">Discard unsaved changes?</DialogTitle>
        <DialogContent><DialogContentText>Your edits have not been saved.</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setDiscard(false)}>Keep editing</Button><Button color="error" onClick={() => { setDiscard(false); setEdit(null); }}>Discard changes</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(manualCopy)} onClose={() => setManualCopy('')} aria-labelledby="copy-tag-title" fullWidth maxWidth="sm">
        <DialogTitle id="copy-tag-title">Copy storefront link</DialogTitle>
        <DialogContent><Typography variant="body2" mb={2}>Automatic copy is unavailable. Select and copy this link.</Typography><TextField autoFocus fullWidth label="Storefront URL" value={manualCopy} InputProps={{ readOnly: true }} onFocus={(event) => event.target.select()} /></DialogContent>
        <DialogActions><Button onClick={() => setManualCopy('')}>Done</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
