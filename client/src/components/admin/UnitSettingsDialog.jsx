import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, FormControlLabel, IconButton, InputAdornment,
  InputLabel, List, ListItemButton, MenuItem, Select, Stack, Switch, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import StraightenIcon from '@mui/icons-material/Straighten';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useUnitCatalog } from '../../context/UnitCatalogContext';
import { useNotification } from '../../context/NotificationContext';
import UnitCategoriesManager from './UnitCategoriesManager';
import { STANDARD_UNITS } from '../../constants/units';
import { formatAttributeValue } from '../../utils/attributePresentation';
import settingsService from '../../services/settingsService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const PAGE_SIZE = 8;
const EMPTY_UNIT = { value: '', label: '', category: '', enabled: true };
const shortName = (unit) => unit.label.toLowerCase().endsWith(` (${unit.value.toLowerCase()})`)
  ? unit.label.slice(0, -(unit.value.length + 3)) : unit.label;
const usageDescription = (usage) => [
  usage?.products && `${usage.products} product${usage.products === 1 ? '' : 's'}`,
  usage?.attributes && `${usage.attributes} attribute${usage.attributes === 1 ? '' : 's'}`,
  usage?.values && `${usage.values} value override${usage.values === 1 ? '' : 's'}`,
].filter(Boolean).join(', ');

const UnitSettingsDialog = ({ onClose }) => {
  const { units, categories, loading, error: loadError, retry, saveUnits } = useUnitCatalog();
  const { notify } = useNotification();
  const [managingCategories, setManagingCategories] = useState(false);
  const [categoryDirty, setCategoryDirty] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [page, setPage] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState('');
  const [usageRevision, setUsageRevision] = useState(0);
  const [discardTarget, setDiscardTarget] = useState(null);
  const activeCategory = categories.includes(category) ? category : '';
  const filtered = units.filter((unit) => (!activeCategory || unit.category === activeCategory) &&
    (visibility === 'all' || unit.enabled === (visibility === 'available')) &&
    `${unit.label} ${unit.value} ${unit.category}`.toLowerCase().includes(search.trim().toLowerCase()));
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleUnits = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const isEditing = Boolean(editor || deleting);
  const original = editor?.originalValue ? units.find((unit) => unit.value === editor.originalValue) : EMPTY_UNIT;
  const dirty = editor && ['value', 'label', 'category', 'enabled'].some((key) => editor[key] !== original?.[key]);
  const retryUsage = useCallback(() => setUsageRevision((current) => current + 1), []);

  useEffect(() => {
    if (loadError) notify(loadError, 'error');
  }, [loadError, notify]);

  useEffect(() => {
    let active = true;
    setUsageLoading(true);
    setUsageError('');
    settingsService.getUnitUsage().then((data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Could not check unit usage.');
      if (active) setUsage(data);
    }).catch((err) => {
      if (active) {
        const message = getApiErrorMessage(err, 'Could not check unit usage.');
        setUsageError(message);
        notify(message, 'error');
      }
    }).finally(() => {
      if (active) setUsageLoading(false);
    });
    return () => { active = false; };
  }, [usageRevision, notify]);

  const browse = () => {
    setEditor(null);
    setDeleting(null);
    setFieldErrors({});
    setDiscardTarget(null);
  };
  const requestLeave = (target) => {
    if (saving || categorySaving) return;
    if ((managingCategories ? categoryDirty || (target === 'close' && dirty) : dirty)) setDiscardTarget(target);
    else if (target === 'close') onClose();
    else if (managingCategories) { setManagingCategories(false); setCategoryDirty(false); }
    else browse();
  };
  const discard = () => {
    if (discardTarget === 'close') onClose();
    else if (managingCategories) { setManagingCategories(false); setCategoryDirty(false); setDiscardTarget(null); }
    else browse();
  };
  const categoryChanged = (previous, next) => {
    setCategory((current) => current === previous ? next : current);
    setEditor((current) => current?.category === previous ? { ...current, category: next } : current);
  };
  const openEditor = (unit) => {
    setEditor(unit ? { ...unit, originalValue: unit.value } : { ...EMPTY_UNIT, category: activeCategory });
    setFieldErrors({});
  };
  const updateEditor = (key, value) => {
    setEditor((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  };
  const saveEditor = async (event) => {
    event.preventDefault();
    if (saving || loading || loadError) return;
    const enteredCategory = editor.category.trim();
    const unit = {
      value: editor.value.trim(), label: editor.label.trim(),
      category: categories.find((name) => name.toLowerCase() === enteredCategory.toLowerCase()) || enteredCategory,
      enabled: editor.enabled,
    };
    const errors = {};
    for (const [key, max, label] of [['label', 80, 'display name'], ['value', 20, 'symbol'], ['category', 50, 'category']]) {
      if (!unit[key]) errors[key] = `Enter a ${label}.`;
      else if (unit[key].length > max || /[\u0000-\u001f\u007f]/.test(unit[key])) errors[key] = `Use up to ${max} characters, without control characters.`;
    }
    if (!categories.includes(unit.category)) errors.category = 'Select a category from the list, or create one in Manage categories.';
    if (units.some((existing) => existing.value.toLowerCase() === unit.value.toLowerCase() && existing.value !== editor.originalValue)) {
      errors.value = 'This symbol already exists. Edit that unit instead.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (!editor.originalValue && units.length >= 300) { notify('You can have up to 300 units. Delete an unused unit first.', 'error'); return; }
    setSaving(true);
    try {
      const next = editor.originalValue
        ? units.map((existing) => existing.value === editor.originalValue ? unit : existing)
        : [...units, unit];
      await saveUnits(next);
      setCategory(unit.category);
      setSearch('');
      setVisibility('all');
      setPage(0);
      notify(editor.originalValue ? 'Unit updated.' : 'Unit created.', 'success');
      browse();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Could not save the unit. Your changes are still here.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  const deleteUnit = async () => {
    if (saving || usageLoading || usageError || loading || loadError || (usage?.[deleting.value.toLowerCase()]?.total || 0) > 0) return;
    setSaving(true);
    try {
      const next = units.filter((unit) => unit.value !== deleting.value);
      // Built-ins need a removal marker; custom definitions can be removed.
      if (STANDARD_UNITS.some((unit) => unit.value.toLowerCase() === deleting.value.toLowerCase())) next.push({ ...deleting, enabled: false, deleted: true });
      await saveUnits(next);
      notify('Unit deleted.', 'success');
      browse();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Could not delete the unit. It may now be in use.'), 'error');
      retryUsage();
    } finally {
      setSaving(false);
    }
  };
  const chooseCategory = (value) => { setCategory(value); setPage(0); };
  const categorySelect = (
    <FormControl size="small" fullWidth>
      <InputLabel id="unit-category-filter">Category</InputLabel>
      <Select labelId="unit-category-filter" label="Category" value={activeCategory} onChange={(event) => chooseCategory(event.target.value)}>
        <MenuItem value="">All categories</MenuItem>
        {categories.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
      </Select>
    </FormControl>
  );

  return (
    <Dialog open onClose={() => requestLeave('close')} maxWidth={managingCategories ? 'md' : isEditing ? 'sm' : 'lg'} fullWidth aria-labelledby="unit-settings-title"
      PaperProps={{ sx: { width: managingCategories ? 720 : isEditing ? 600 : 1040, height: managingCategories || isEditing ? 'auto' : { xs: 'calc(100dvh - 32px)', sm: 680 }, maxHeight: 'calc(100dvh - 32px)', borderRadius: 3 } }}>
      <DialogTitle id="unit-settings-header" component="div" sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {isEditing || managingCategories ? <IconButton aria-label={managingCategories && editor ? 'Back to unit editor' : 'Back to units'} onClick={() => requestLeave('browse')} disabled={saving || categorySaving}><ArrowBackIcon /></IconButton>
            : <Box sx={{ p: 1, display: { xs: 'none', sm: 'flex' }, bgcolor: 'action.hover', borderRadius: 2, color: 'primary.main' }}><StraightenIcon /></Box>}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="unit-settings-title" component="h2" variant="h6" fontWeight={700}>{managingCategories ? 'Manage categories' : deleting ? 'Delete unit' : editor ? editor.originalValue ? 'Edit unit' : 'Add unit' : 'Unit settings'}</Typography>
            <Typography variant="body2" color="text.secondary">{managingCategories ? 'Create categories and organize their units.' : editor ? 'Set the name, symbol, and category for this unit.' : deleting ? 'Remove an unused unit from the list.' : 'Organize the units used in attributes and product pricing.'}</Typography>
          </Box>
          {!isEditing && !managingCategories && <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEditor()} disabled={loading || Boolean(loadError)}>Add unit</Button>}
          <IconButton aria-label="Close unit settings" disabled={saving || categorySaving} onClick={() => requestLeave('close')} sx={{ minWidth: 44, minHeight: 44 }}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>

      {loadError && <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 3, py: 1.5 }}>
        <Typography variant="body2" color="text.secondary">Unit settings could not be loaded. Editing is disabled.</Typography>
        <Button onClick={retry} disabled={loading}>Retry</Button>
      </Stack>}
      {discardTarget && <Alert severity="warning" sx={{ m: 2 }} action={<Stack direction="row"><Button onClick={() => setDiscardTarget(null)}>Keep editing</Button><Button onClick={discard}>Discard</Button></Stack>}>Discard your unsaved changes?</Alert>}
      {managingCategories ? <UnitCategoriesManager
        onBack={() => requestLeave('browse')} backLabel={editor ? 'Back to unit' : 'Back to units'}
        onCategoryChanged={categoryChanged} onDirtyChange={setCategoryDirty} onBusyChange={setCategorySaving}
      /> : <>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: isEditing ? 'auto' : 'hidden' }}>
        {loading ? <Box sx={{ display: 'grid', placeItems: 'center', flex: 1 }}><CircularProgress aria-label="Loading units" /></Box> : editor ? (
          <Box component="form" id="unit-editor" aria-label="Unit details" noValidate onSubmit={saveEditor} sx={{ width: '100%', p: { xs: 2, sm: 3 }, boxSizing: 'border-box' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2, mb: 2.5 }}>
              <TextField label="Display name" required autoFocus value={editor.label} disabled={saving} error={Boolean(fieldErrors.label)} helperText={fieldErrors.label || 'For example: Centimetre'} inputProps={{ maxLength: 80 }} onChange={(event) => updateEditor('label', event.target.value)} />
              <TextField label="Symbol" required value={editor.value} disabled={saving} error={Boolean(fieldErrors.value)} helperText={fieldErrors.value || (editor.originalValue ? 'Fixed after creation' : 'For example: cm')}
                InputProps={{ readOnly: Boolean(editor.originalValue), endAdornment: editor.originalValue ? <InputAdornment position="end"><Tooltip title="Add a new unit to use another symbol."><LockOutlinedIcon fontSize="small" /></Tooltip></InputAdornment> : undefined }}
                inputProps={{ maxLength: 20 }} onChange={(event) => { if (!editor.originalValue) updateEditor('value', event.target.value); }} />
            </Box>
            <Autocomplete options={categories} value={categories.includes(editor.category) ? editor.category : null} disabled={saving}
              onChange={(_, value) => updateEditor('category', value || '')}
              noOptionsText="No matching category. Create one in Manage categories."
              renderInput={(params) => <TextField {...params} label="Unit category" required error={Boolean(fieldErrors.category)} helperText={fieldErrors.category || undefined} />}
            />
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 0.5, mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Choose a category from your list.</Typography>
              <Button size="small" disabled={saving || Boolean(loadError)} onClick={() => setManagingCategories(true)}>Manage categories</Button>
            </Stack>
            <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <FormControlLabel sx={{ m: 0, width: '100%', justifyContent: 'space-between', gap: 2 }} labelPlacement="start"
                control={<Switch checked={editor.enabled} disabled={saving} onChange={(_, enabled) => updateEditor('enabled', enabled)} />}
                label={<Box><Typography variant="body2" fontWeight={600}>Available for selection</Typography><Typography variant="body2" color="text.secondary">Hidden units stay on existing products.</Typography></Box>}
              />
            </Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
              <Typography variant="body2" color="text.secondary">Value preview</Typography>
              <Typography variant="body1" fontWeight={600}>{formatAttributeValue({ value: '10' }, { unit: editor.value.trim() })}</Typography>
            </Stack>
          </Box>
        ) : deleting ? (
          <Box sx={{ maxWidth: 480, m: 'auto', p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
            <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'action.hover', color: 'error.main', mb: 2 }}><DeleteOutlineIcon fontSize="large" /></Box>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Delete {shortName(deleting)}?</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>This removes <strong>{deleting.value}</strong> from your unit list. No product or attribute values will be changed.</Typography>
            {usageLoading ? <CircularProgress size={24} aria-label="Checking unit usage" /> : usageError ? <Box><Typography variant="body2" color="text.secondary">Usage is unavailable. Deletion is disabled.</Typography><Button onClick={retryUsage}>Retry usage check</Button></Box>
              : usage?.[deleting.value.toLowerCase()]?.total > 0 ? <Alert severity="warning">This unit is now in use. You can hide it instead.</Alert>
                : <Chip label="Unused — safe to delete" color="success" variant="outlined" />}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Box component="nav" aria-label="Unit categories" sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', width: 210, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
              <Typography variant="overline" color="text.secondary" sx={{ px: 2.5, pt: 2 }}>Categories</Typography>
              <List sx={{ px: 1, overflowY: 'auto', flex: 1 }}>
                {[['', 'All units', units.length], ...categories.map((name) => [name, name, units.filter((unit) => unit.category === name).length])].map(([key, name, count]) => (
                  <ListItemButton key={key} selected={activeCategory === key} onClick={() => chooseCategory(key)} sx={{ borderRadius: 1.5, px: 1.5, py: 1.25, mb: 0.5, gap: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1, overflowWrap: 'anywhere', fontWeight: activeCategory === key ? 600 : 400 }}>{name}</Typography>
                    <Typography variant="caption" color="text.secondary">{count}</Typography>
                  </ListItemButton>
                ))}
              </List>
              <Button startIcon={<FolderOutlinedIcon />} onClick={() => setManagingCategories(true)} disabled={loading || Boolean(loadError)} sx={{ mx: 1.5, mb: 1 }}>Manage categories</Button>
              <Typography variant="caption" color="text.secondary" sx={{ px: 2.5, pb: 2 }}>Units in use can be hidden. Only unused units can be deleted.</Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.5 }}><Typography variant="subtitle1" fontWeight={700}>{activeCategory || 'All units'}</Typography><Typography variant="body2" color="text.secondary">{filtered.length} units</Typography></Stack>
                <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1.5 }}>{categorySelect}<Button size="small" onClick={() => setManagingCategories(true)} disabled={loading || Boolean(loadError)}>Manage categories</Button></Box>
                <Stack direction="row" spacing={1.5}>
                  <TextField label="Search units" size="small" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} sx={{ flex: 1, minWidth: 0 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
                  <FormControl size="small" sx={{ width: { xs: 125, sm: 150 }, flexShrink: 0 }}>
                    <InputLabel id="unit-visibility-filter">Visibility</InputLabel>
                    <Select labelId="unit-visibility-filter" label="Visibility" value={visibility} onChange={(event) => { setVisibility(event.target.value); setPage(0); }}>
                      <MenuItem value="all">All statuses</MenuItem><MenuItem value="available">Available</MenuItem><MenuItem value="hidden">Hidden</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
              {usageError && <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pb: 1 }}><Typography variant="body2" color="text.secondary">Usage is unavailable. Deletion is disabled.</Typography><Button onClick={retryUsage}>Retry usage check</Button></Stack>}
              <TableContainer sx={{ flex: 1, minHeight: 0 }}>
                <Table size="small" stickyHeader aria-label="Unit catalog">
                  <TableHead><TableRow><TableCell sx={{ pl: 2.5 }}>Unit</TableCell><TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Visibility</TableCell><TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Usage</TableCell><TableCell align="right" sx={{ pr: 2 }}>Actions</TableCell></TableRow></TableHead>
                  <TableBody>
                    {visibleUnits.map((unit) => {
                      const references = usage?.[unit.value.toLowerCase()];
                      const inUse = (references?.total || 0) > 0;
                      const deleteReason = usageLoading ? 'Checking usage…' : usageError ? 'Usage must be checked before deletion.' : inUse ? `Used by ${usageDescription(references)}. Hide this unit instead.` : `Delete ${unit.value}`;
                      return <TableRow key={unit.value} hover>
                        <TableCell sx={{ pl: 2.5, py: 1.5, overflowWrap: 'anywhere' }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><Typography variant="body2" fontWeight={600}>{shortName(unit)}</Typography><Box component="span" sx={{ px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: 12 }}>{unit.value}</Box></Stack>
                          <Typography variant="caption" color="text.secondary">{unit.category}<Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}> · {unit.enabled ? 'Available' : 'Hidden'} · {usageLoading ? 'Checking usage' : usageError ? 'Usage unavailable' : inUse ? `In use (${references.total})` : 'Unused'}</Box></Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}><Chip size="small" label={unit.enabled ? 'Available' : 'Hidden'} color={unit.enabled ? 'success' : 'default'} variant="outlined" /></TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{usageLoading ? <Typography variant="caption" color="text.secondary">Checking…</Typography> : usageError ? '—' : <Tooltip title={inUse ? usageDescription(references) : 'No product or attribute references'}><Typography variant="body2" color={inUse ? 'text.primary' : 'text.secondary'}>{inUse ? `In use (${references.total})` : 'Unused'}</Typography></Tooltip>}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 1.5 }}>
                          <Tooltip title={`Edit ${unit.value}`}><span><IconButton aria-label={`Edit ${unit.value}`} disabled={Boolean(loadError)} onClick={() => openEditor(unit)} sx={{ minWidth: 44, minHeight: 44 }}><EditOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title={deleteReason}><span><IconButton aria-label={`Delete ${unit.value}`} disabled={Boolean(loadError) || usageLoading || Boolean(usageError) || inUse} onClick={() => { setDeleting(unit); }} sx={{ minWidth: 44, minHeight: 44, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'action.hover' } }}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
                        </TableCell>
                      </TableRow>;
                    })}
                    {!visibleUnits.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}><Typography variant="subtitle2">No units found</Typography><Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>Try another search or add a unit to this category.</Typography><Button onClick={() => { setSearch(''); setVisibility('all'); chooseCategory(''); }}>Clear filters</Button></TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination component="div" count={filtered.length} page={currentPage} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[]} onPageChange={(_, next) => setPage(next)} sx={{ borderTop: 1, borderColor: 'divider', flexShrink: 0 }} />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: 1, borderColor: 'divider', gap: 1 }}>
        {!isEditing && <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>Changes are saved as you go.</Typography>}
        {isEditing ? <>
          <Button color="error" disabled={saving} onClick={browse}>Cancel</Button>
          {deleting ? <Button color="error" variant="contained" disabled={saving || usageLoading || Boolean(usageError) || Boolean(loadError) || (usage?.[deleting.value.toLowerCase()]?.total || 0) > 0} onClick={deleteUnit}>{saving ? 'Deleting…' : 'Delete unit'}</Button>
            : <Button variant="contained" type="submit" form="unit-editor" disabled={saving || loading || Boolean(loadError) || !dirty}>{saving ? 'Saving…' : editor.originalValue ? 'Save unit' : 'Create unit'}</Button>}
        </> : <Button variant="outlined" onClick={onClose}>Done</Button>}
      </DialogActions>
      </>}
    </Dialog>
  );
};

export default UnitSettingsDialog;
