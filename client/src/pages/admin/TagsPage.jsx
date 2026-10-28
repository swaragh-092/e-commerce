import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { Link } from 'react-router-dom';
import { getTags, createTag, renameTag, deleteTag } from '../../services/tagService';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function TagsPage() {
  const { hasPermission } = useAuth();
  const { notify } = useNotification();
  const canCreate = hasPermission(PERMISSIONS.PRODUCTS_CREATE) || hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canRename = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PRODUCTS_DELETE);
  const canReadProducts = hasPermission(PERMISSIONS.PRODUCTS_READ);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
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
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(input.trim()); setPage(0); }, 250);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getTags({ search, page: page + 1, limit: 20 }).then((res) => {
      if (!active) return;
      setRows(res.data || []); setTotal(res.meta?.total || 0);
      if (page > 0 && !res.data?.length) setPage((current) => current - 1);
    }).catch((err) => {
      if (active) setError(getApiErrorMessage(err, 'Could not load tags.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, page, revision]);

  const save = async (event) => {
    event.preventDefault();
    const name = edit.name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (!name || name.length > 100 || /[\p{Cc}\p{Cf},]/u.test(name)) {
      setDialogError('Use 1–100 characters without commas or control characters.'); return;
    }
    setSaving(true); setDialogError('');
    try {
      if (edit.id) await renameTag(edit.id, name, edit.description.trim()); else await createTag(name, edit.description.trim());
      notify(edit.id ? 'Tag updated across all products.' : 'Tag created.', 'success');
      setEdit(null); refresh();
    } catch (err) { setDialogError(getApiErrorMessage(err, 'Could not save tag.')); }
    finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    setSaving(true); setDialogError('');
    try {
      await deleteTag(remove.id); setRemove(null); refresh();
      notify('Tag deleted. Products are unchanged.', 'success');
    } catch (err) { setDialogError(getApiErrorMessage(err, 'Could not delete tag.')); }
    finally { setSaving(false); }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} mb={2}>
        <Typography variant="h4" component="h1" fontWeight={700}>Tags</Typography>
        {canCreate && <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setDialogError(''); setEdit({ name: '', description: '' }); }}>Add tag</Button>}
      </Stack>
      <Typography color="text.secondary" mb={3}>Group products across categories with reusable labels. Renaming a tag updates its label everywhere and keeps existing links working.</Typography>
      <TextField label="Search tags" value={input} onChange={(e) => setInput(e.target.value)} size="small" inputProps={{ maxLength: 100 }} sx={{ mb: 2, width: { xs: '100%', sm: 320 } }} />
      {error ? <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Retry</Button>}>{error}</Alert> : (
        <Paper variant="outlined">
          <TableContainer>
            <Table aria-label="Product tags">
              <TableHead><TableRow><TableCell>Name</TableCell><TableCell>URL slug</TableCell><TableCell align="right">Products</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} aria-label="Loading tags" /></TableCell></TableRow> : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4}><Typography color="text.secondary" py={3}>{search ? 'No tags match your search.' : 'No tags yet. Add a tag here or while editing a product.'}</Typography></TableCell></TableRow>
                ) : rows.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>{tag.name}</TableCell>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>{tag.slug}</TableCell>
                    <TableCell align="right">{canReadProducts ? <Button component={Link} to={`/admin/products?tags=${encodeURIComponent(tag.slug)}`} size="small" aria-label={`View products tagged ${tag.name}`}>{tag.productCount}</Button> : tag.productCount}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {canRename && <Tooltip title="Edit tag"><IconButton aria-label={`Edit ${tag.name}`} onClick={() => { setDialogError(''); setEdit({ id: tag.id, name: tag.name, description: tag.description || '' }); }}><EditIcon fontSize="small" /></IconButton></Tooltip>}
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
      <Dialog open={Boolean(edit)} onClose={() => { if (!saving) setEdit(null); }} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={save}>
          <DialogTitle>{edit?.id ? 'Edit tag' : 'Add tag'}</DialogTitle>
          <DialogContent>
            {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
            <TextField autoFocus fullWidth required label="Tag name" value={edit?.name || ''} onChange={(e) => setEdit((current) => ({ ...current, name: e.target.value }))} margin="dense" inputProps={{ maxLength: 100 }} disabled={saving} helperText="Examples: Beginner Friendly, Home Gardening, Summer Planting" />
            <TextField fullWidth multiline minRows={3} label="Description" value={edit?.description || ''} onChange={(e) => setEdit((current) => ({ ...current, description: e.target.value }))} margin="normal" inputProps={{ maxLength: 2000 }} disabled={saving} helperText="Optional introduction shown on this tag’s storefront page. Up to 2,000 characters." />
          </DialogContent>
          <DialogActions><Button disabled={saving} onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>Save tag</Button></DialogActions>
        </Box>
      </Dialog>
      <Dialog open={Boolean(remove)} onClose={() => { if (!saving) setRemove(null); }} fullWidth maxWidth="xs">
        <DialogTitle>Delete “{remove?.name}”?</DialogTitle>
        <DialogContent>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          <DialogContentText>This removes the tag from {remove?.productCount || 0} products. The products will remain in your catalog. Existing links using this tag will no longer show those products.</DialogContentText>
        </DialogContent>
        <DialogActions><Button disabled={saving} onClick={() => setRemove(null)}>Cancel</Button><Button color="error" variant="contained" disabled={saving} onClick={confirmDelete}>Delete tag</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
