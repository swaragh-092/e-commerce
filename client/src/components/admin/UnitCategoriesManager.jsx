import React, { useEffect, useState } from 'react';
import {
  Box, Button, DialogActions, DialogContent, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useUnitCatalog } from '../../context/UnitCatalogContext';
import { useNotification } from '../../context/NotificationContext';
import { normalizeUnitCategoryName } from '../../constants/units';
import { getApiErrorMessage } from '../../utils/apiErrors';

const UnitCategoriesManager = ({ onBack, backLabel, onCategoryChanged, onDirtyChange, onBusyChange }) => {
  const { units, categories, loading, error: loadError, saveCategories } = useUnitCatalog();
  const { notify } = useNotification();
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const blocked = saving || loading || Boolean(loadError);
  const unitCount = (name) => units.filter((unit) => unit.category === name).length;
  const deletingCount = deleting ? unitCount(deleting) : 0;

  useEffect(() => {
    onDirtyChange(Boolean(newName.trim()) || Boolean(renaming && renaming.name !== renaming.original));
  }, [newName, renaming, onDirtyChange]);

  const setBusy = (busy) => { setSaving(busy); onBusyChange(busy); };
  const validate = (raw, original = '') => {
    const name = normalizeUnitCategoryName(raw);
    if (!name) return 'Enter a category name.';
    if (name.length > 50 || /[\u0000-\u001f\u007f]/.test(raw)) return 'Use up to 50 characters, without control characters.';
    if (['all units', 'all categories', 'existing unit'].includes(name.toLowerCase())) return 'This name is reserved. Choose another category name.';
    if (categories.some((existing) => existing !== original && existing.toLowerCase() === name.toLowerCase())) return 'A category with this name already exists.';
    return '';
  };
  const saveName = async (event) => {
    event?.preventDefault();
    if (blocked) return;
    const raw = renaming ? renaming.name : newName;
    const validation = validate(raw, renaming?.original);
    if (validation) { setFieldError(validation); return; }
    if (!renaming && categories.length >= 100) { setFieldError('You can have up to 100 categories.'); return; }
    const name = normalizeUnitCategoryName(raw);
    const previous = renaming?.original;
    const nextNames = previous ? categories.map((current) => current === previous ? name : current) : [...categories, name];
    const nextUnits = previous ? units.map((unit) => unit.category === previous ? { ...unit, category: name } : unit) : units;
    setBusy(true);
    try {
      await saveCategories(nextNames, nextUnits);
      if (previous) onCategoryChanged(previous, name);
      setRenaming(null);
      if (!previous) setNewName('');
      setFieldError('');
      notify(previous ? 'Category renamed. Its units have been updated.' : 'Category created. You can now add units to it.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Could not save the category. Your changes are still here.'), 'error');
    } finally { setBusy(false); }
  };
  const deleteCategory = async () => {
    if (blocked || !deleting || deletingCount > 0) return;
    setBusy(true);
    try {
      await saveCategories(categories.filter((name) => name !== deleting));
      onCategoryChanged(deleting, '');
      setDeleting('');
      notify('Category deleted.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Could not delete the category. No changes have been applied.'), 'error');
    } finally { setBusy(false); }
  };

  return <>
    <DialogContent sx={{
      px: { xs: 2, sm: 3 }, pb: 2.5, minHeight: 0,
      // Override MUI's title-adjacent padding reset so floating labels have room.
      '&&': { pt: 3 },
    }}>
      {deleting ? <Box sx={{ py: 1 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Delete “{deleting}”?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{deletingCount
          ? 'This category now contains units and cannot be deleted.'
          : 'This category has no units and can be removed.'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Unit symbols, product values, and attribute values stay unchanged.</Typography>
      </Box> : <>
        <Box component="form" aria-label="Add category" noValidate onSubmit={saveName} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'flex-start' }, gap: 1.5, mb: 2.5 }}>
          <TextField label="New category name" size="small" fullWidth value={newName} disabled={blocked || Boolean(renaming)} inputProps={{ maxLength: 50 }}
            error={Boolean(fieldError) && !renaming} helperText={!renaming ? fieldError || 'For example: Temperature or Surface area' : ' '}
            onChange={(event) => { setNewName(event.target.value); setFieldError(''); }} />
          <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={blocked || Boolean(renaming) || !newName.trim()} sx={{ minHeight: 40, whiteSpace: 'nowrap' }}>{saving && !renaming ? 'Adding…' : 'Add category'}</Button>
        </Box>
        <TableContainer sx={{ maxHeight: 340, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
          <Table size="small" stickyHeader aria-label="Unit categories">
            <TableHead><TableRow><TableCell>Category</TableCell><TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Units</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {categories.map((name) => <TableRow key={name} hover>
                <TableCell sx={{ py: 1, overflowWrap: 'anywhere' }}>{renaming?.original === name
                  ? <TextField label="Category name" autoFocus fullWidth size="small" value={renaming.name} disabled={blocked} error={Boolean(fieldError)} helperText={fieldError || undefined} inputProps={{ maxLength: 50 }}
                    onChange={(event) => { setRenaming((current) => ({ ...current, name: event.target.value })); setFieldError(''); }}
                    onKeyDown={(event) => { if (event.key === 'Enter') saveName(event); if (event.key === 'Escape') { event.stopPropagation(); setRenaming(null); setFieldError(''); } }} />
                  : <Box><Typography variant="body2" fontWeight={500}>{name}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>{unitCount(name)} units</Typography></Box>}</TableCell>
                <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{unitCount(name)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{renaming?.original === name ? <>
                  <Tooltip title="Save category name"><span><IconButton aria-label="Save category name" color="primary" disabled={blocked || renaming.name === name} onClick={saveName} sx={{ minHeight: 44, minWidth: 44 }}><CheckIcon fontSize="small" /></IconButton></span></Tooltip>
                  <IconButton aria-label="Cancel category rename" disabled={blocked} onClick={() => { setRenaming(null); setFieldError(''); }} sx={{ minHeight: 44, minWidth: 44 }}><CloseIcon fontSize="small" /></IconButton>
                </> : <>
                  <Tooltip title={`Rename ${name}`}><span><IconButton aria-label={`Rename category ${name}`} disabled={blocked || Boolean(renaming)} onClick={() => { setRenaming({ original: name, name }); setFieldError(''); }} sx={{ minHeight: 44, minWidth: 44 }}><EditOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                  {unitCount(name) === 0 && <Tooltip title={`Delete ${name}`}><span><IconButton aria-label={`Delete category ${name}`} disabled={blocked || Boolean(renaming)} onClick={() => { setDeleting(name); }} sx={{ minHeight: 44, minWidth: 44 }}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>}
                </>}</TableCell>
              </TableRow>)}
              {!categories.length && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}>No categories yet. Add your first category above.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Only empty categories can be deleted. Hidden units count toward the total.</Typography>
      </>}
    </DialogContent>
    <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: 1, borderColor: 'divider' }}>
      {deleting ? <>
        <Button disabled={blocked} onClick={() => { setDeleting(''); }}>Cancel</Button>
        <Button variant="contained" color="error" disabled={blocked || deletingCount > 0} onClick={deleteCategory}>{saving ? 'Deleting…' : 'Delete category'}</Button>
      </> : <Button variant="outlined" disabled={blocked} onClick={onBack}>{backLabel}</Button>}
    </DialogActions>
  </>;
};

export default UnitCategoriesManager;
