import React, { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, TextField, Typography, createFilterOptions } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import attributeService from '../../services/attributeService';
import { useNotification } from '../../context/NotificationContext';
import { useUnitCatalog } from '../../context/UnitCatalogContext';
import { getAttributeUnitCategory } from '../../constants/units';
import { formatAttributeValue, getSwatchColor, inferValueType } from '../../utils/attributePresentation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import UnitCategorySelector from './UnitCategorySelector';
import UnitSelector from './UnitSelector';

const filter = createFilterOptions({ stringify: (option) => option.name });
const normalize = (text) => String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
const emptyValue = { value: '', unitLabel: '', swatchColor: '' };

const ProductAttributeDialog = ({ productId, templates, rows, initialTemplate, onSaved, onClose }) => {
  const { notify, confirm } = useNotification();
  const { units, loading: unitsLoading, error: unitsError, retry: retryUnits } = useUnitCatalog();
  const [selected, setSelected] = useState(initialTemplate || null);
  const [query, setQuery] = useState(initialTemplate?.name || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadingValues, setLoadingValues] = useState(false);
  const [valueLoadError, setValueLoadError] = useState(false);
  const [chosenIds, setChosenIds] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [entry, setEntry] = useState(emptyValue);
  const [entryError, setEntryError] = useState('');
  const [valueSearch, setValueSearch] = useState('');
  const [showEntry, setShowEntry] = useState(false);
  const [isVariant, setIsVariant] = useState(false);
  const [saving, setSaving] = useState(false);
  const category = selected ? getAttributeUnitCategory(selected, units) : '';
  const isColor = inferValueType(selected || {}) === 'color';
  const values = selected?.values || [];
  const assigned = new Set(rows.filter((row) => row.attributeId === selected?.id).map((row) => row.valueId));
  const options = [...new Map([...templates, ...results, ...(selected?.id ? [selected] : [])].map((item) => [item.id, item])).values()];
  const hasEntry = Object.values(entry).some(Boolean);
  const dirty = selected?._new || chosenIds.length > 0 || drafts.length > 0 || hasEntry;
  const blocked = saving || loadingValues || valueLoadError || (selected?._new && (unitsLoading || Boolean(unitsError)));

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await attributeService.getAttributes({ search: query.trim(), limit: 100, sortBy: 'name', sortOrder: 'ASC' });
        if (active) { setResults(response?.data?.data?.rows || []); setSearchFailed(false); }
      } catch (err) { if (active) { setSearchFailed(true); notify(getApiErrorMessage(err, 'Could not search attributes.'), 'error'); } }
      finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, revision, notify]);

  useEffect(() => {
    if (!selected?.id) return;
    let active = true;
    setLoadingValues(true); setValueLoadError(false);
    attributeService.getAttributeById(selected.id).then((response) => {
      const attribute = response?.data?.data;
      if (attribute?.id !== selected.id || !Array.isArray(attribute.values)) throw new Error('Could not load attribute values.');
      if (active) { setSelected(attribute); setShowEntry(attribute.values.length === 0); setQuery((current) => current === selected.name ? attribute.name : current); }
    }).catch((err) => { if (active) { setValueLoadError(true); notify(getApiErrorMessage(err), 'error'); } })
      .finally(() => { if (active) setLoadingValues(false); });
    return () => { active = false; };
  }, [selected?.id, revision, notify]);

  const close = async () => {
    if (saving) return;
    if (dirty && !(await confirm({ title: 'Discard attribute changes?', message: 'Nothing has been added to the product yet.', confirmText: 'Discard changes', cancelText: 'Keep editing', severity: 'warning' }))) return;
    onClose();
  };
  const select = async (option) => {
    if (saving) return;
    if (typeof option === 'string') option = options.find((item) => normalize(item.name) === normalize(option)) || { _new: true, name: option.trim(), unitCategory: '', values: [] };
    if (dirty && !(await confirm({ title: 'Change attribute?', message: 'Discard the selected values and continue with another attribute?', confirmText: 'Change attribute', cancelText: 'Keep editing', severity: 'warning' }))) { setQuery(selected?.name || ''); return; }
    setSelected(option); setQuery(option?.name || ''); setChosenIds([]); setDrafts([]); setEntry(emptyValue);
    setEntryError(''); setValueSearch(''); setIsVariant(false); setValueLoadError(false);
    setShowEntry(Boolean(option?._new));
  };
  const prepareEntry = () => {
    if (!entry.value.trim()) throw new Error('Enter a value.');
    if (category && (!entry.unitLabel || unitsLoading || unitsError)) throw new Error(`Choose a ${category} unit.`);
    if (entry.swatchColor && !/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(entry.swatchColor)) throw new Error('Enter a valid hex color, for example #1E88E5.');
    if (drafts.some((value) => normalize(value.value) === normalize(entry.value) && normalize(value.unitLabel) !== normalize(entry.unitLabel))) throw new Error('This value is already included with another unit. Use a distinct value label.');
    const existing = values.find((value) => normalize(value.value) === normalize(entry.value));
    if (existing) {
      if (normalize(existing.unitLabel || selected.unit) !== normalize(entry.unitLabel)) throw new Error('This value already exists with another unit. Use a distinct value label.');
      if (assigned.has(existing.id)) throw new Error('This value is already on the product.');
      return { valueId: existing.id };
    }
    return { value: entry.value.trim(), unitLabel: entry.unitLabel || null, swatchColor: entry.swatchColor || null };
  };
  const includeEntry = () => {
    try {
      const value = prepareEntry();
      if (value.valueId) setChosenIds((current) => [...new Set([...current, value.valueId])]);
      else if (!drafts.some((draft) => normalize(draft.value) === normalize(value.value) && normalize(draft.unitLabel) === normalize(value.unitLabel))) setDrafts((current) => [...current, value]);
      setEntry(emptyValue); setEntryError('');
    } catch (err) { setEntryError(err.message); }
  };
  const save = async () => {
    if (blocked || !productId || !selected || query.trim() !== selected.name) return;
    let pending = [...drafts];
    let ids = [...chosenIds];
    if (hasEntry) {
      try { const value = prepareEntry(); if (value.valueId) ids.push(value.valueId); else pending.push(value); }
      catch (err) { setEntryError(err.message); return; }
    }
    const entries = [...new Set(ids)].map((valueId) => ({ valueId }));
    for (const value of pending) if (!entries.some((item) => item.value && normalize(item.value) === normalize(value.value) && normalize(item.unitLabel) === normalize(value.unitLabel))) entries.push(value);
    if (!entries.length) { setEntryError('Select or enter at least one value.'); return; }
    if (entries.length > 100) { setEntryError('Add up to 100 values at a time.'); return; }
    setSaving(true);
    try {
      const response = await attributeService.assignProductAttribute(productId, {
        ...(selected._new ? { attribute: { name: selected.name, unitCategory: category || null, valueType: selected.valueType || 'auto' } } : { attributeId: selected.id }),
        values: entries, isVariantAttr: isVariant,
      });
      const nextRows = response?.data?.data;
      if (!Array.isArray(nextRows)) throw new Error('Could not refresh the assigned values. Retry to check the saved assignment.');
      onSaved(nextRows);
      notify('Attribute values added to the product.', 'success');
    } catch (err) { notify(getApiErrorMessage(err, 'Could not add the attribute. Your selections are preserved.'), 'error'); }
    finally { setSaving(false); }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={close} aria-labelledby="product-attribute-title" PaperProps={{ sx: { borderRadius: 3 } }}>
    <DialogTitle id="product-attribute-header" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ flex: 1 }}><Typography component="h2" id="product-attribute-title" variant="h6" fontWeight={700}>Add attribute</Typography><Typography variant="body2" color="text.secondary">Choose an attribute or create one, then select its values.</Typography></Box>
      <IconButton onClick={close} disabled={saving} aria-label="Close add attribute" sx={{ minWidth: 44, minHeight: 44 }}><CloseIcon /></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ p: 3, borderTop: 0, borderBottom: 0 }}>
      <Autocomplete freeSolo selectOnFocus clearOnBlur={false} options={options} value={selected} inputValue={query} loading={searching} disabled={saving}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
        isOptionEqualToValue={(option, value) => option.id ? option.id === value.id : option.name === value.name}
        filterOptions={(items, params) => {
          const filtered = filter(items, params);
          const name = params.inputValue.trim().replace(/\s+/g, ' ');
          if (name && name.length <= 100 && !items.some((item) => normalize(item.name) === normalize(name))) filtered.push({ _new: true, name, unitCategory: '', values: [] });
          return filtered;
        }}
        renderOption={(props, option) => <li {...props} key={option.id || `new-${option.name}`}>{option._new ? `Create “${option.name}”` : option.name}</li>}
        onInputChange={(_, value, reason) => { if (reason === 'input') setQuery(value); }} onChange={(_, value) => select(value)}
        renderInput={(params) => <TextField {...params} autoFocus label="Attribute" inputProps={{ ...params.inputProps, maxLength: 100 }} helperText="Search by name, or type a new attribute name." />} />
      {(searchFailed || valueLoadError) && <Button onClick={() => setRevision((value) => value + 1)} disabled={saving}>Retry loading attributes</Button>}
      {selected?._new && <Box sx={{ mt: 2 }}>
        <UnitCategorySelector value={selected.unitCategory || ''} disabled={saving || drafts.length > 0} helperText={drafts.length ? 'Remove included new values to change the category.' : 'Optional. Choose a category to limit the units for these values.'} onChange={(unitCategory) => { setSelected((current) => ({ ...current, unitCategory })); setEntry((current) => ({ ...current, unitLabel: '' })); }} />
        {unitsError && <Button size="small" onClick={retryUnits} disabled={saving || unitsLoading}>Retry unit categories</Button>}
        <FormControlLabel control={<Checkbox checked={selected.valueType === 'color'} disabled={saving || drafts.length > 0} onChange={(_, checked) => setSelected((current) => ({ ...current, valueType: checked ? 'color' : 'auto' }))} />} label="Use color swatches" />
        <Typography variant="caption" color="text.secondary" display="block">This attribute and its new values will be available for other products after saving.</Typography>
      </Box>}
      {loadingValues ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} aria-label="Loading attribute values" /></Box> : selected && <>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1 }}>Values {category && <Chip size="small" label={category} sx={{ ml: 1 }} />}</Typography>
        {values.length > 6 && <TextField label="Find a value" size="small" fullWidth value={valueSearch} onChange={(event) => setValueSearch(event.target.value)} sx={{ mb: 1 }} />}
        <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
          {values.filter((value) => formatAttributeValue(value, selected).toLowerCase().includes(valueSearch.toLowerCase())).map((value) => <FormControlLabel key={value.id} sx={{ display: 'flex', m: 0, minHeight: 44 }}
            control={<Checkbox disabled={blocked || assigned.has(value.id)} checked={assigned.has(value.id) || chosenIds.includes(value.id)} onChange={(_, checked) => setChosenIds((current) => checked ? [...current, value.id] : current.filter((id) => id !== value.id))} />}
            label={<Stack direction="row" spacing={1} alignItems="center">
              {value.imageUrl ? <Box component="img" src={value.imageUrl} alt="" sx={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 0.75 }} />
                : getSwatchColor(value) && <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: getSwatchColor(value), border: 1, borderColor: 'divider' }} />}
              <Typography variant="body2">{formatAttributeValue(value, selected)}{assigned.has(value.id) && <Typography component="span" variant="caption" color="text.secondary"> · Already on product</Typography>}</Typography>
            </Stack>} />)}
          {!values.length && <Typography variant="body2" color="text.secondary">No values yet. Add a value to get started.</Typography>}
        </Box>
        {drafts.length > 0 && <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ my: 1.5 }}>{drafts.map((value, index) => <Chip key={index} label={formatAttributeValue(value, selected)} onDelete={saving ? undefined : () => setDrafts((current) => current.filter((_, i) => i !== index))} />)}</Stack>}
        {!showEntry ? <Box sx={{ mt: 1 }}><Button startIcon={<AddIcon />} onClick={() => setShowEntry(true)} disabled={blocked}>Add a value</Button></Box> : <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>New value</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField fullWidth label="New value" size="small" value={entry.value} disabled={blocked} error={Boolean(entryError)} helperText={entryError || 'For example: 600–900 or Large'} inputProps={{ maxLength: 100 }} onChange={(event) => { setEntry((current) => ({ ...current, value: event.target.value })); setEntryError(''); }} />
            {category && <Box sx={{ width: { xs: '100%', sm: 180 }, flexShrink: 0 }}><UnitSelector label="Unit" category={category} size="small" margin="none" value={entry.unitLabel} disabled={blocked} onChange={(unitLabel) => { setEntry((current) => ({ ...current, unitLabel })); setEntryError(''); }} /></Box>}
          </Stack>
          {isColor && <TextField label="Swatch color" placeholder="#1E88E5" size="small" value={entry.swatchColor} disabled={blocked} onChange={(event) => { setEntry((current) => ({ ...current, swatchColor: event.target.value })); setEntryError(''); }} sx={{ mt: 1.5 }} />}
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            <Button size="small" startIcon={<AddIcon />} onClick={includeEntry} disabled={blocked || !entry.value.trim()}>Include value</Button>
            <Button size="small" disabled={saving} onClick={() => { setEntry(emptyValue); setEntryError(''); setShowEntry(false); }}>Cancel new value</Button>
          </Stack>
        </Box>}
        <Box sx={{ mt: 2 }}>
          <FormControlLabel sx={{ m: 0, display: 'flex' }} control={<Checkbox checked={isVariant} disabled={blocked} onChange={(_, checked) => setIsVariant(checked)} />} label="Use these values to create variants" />
          <Typography variant="caption" color="text.secondary" display="block">Generate the variant matrix after assigning all variant attributes.</Typography>
        </Box>
      </>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}><Button onClick={close} disabled={saving}>Cancel</Button><Button variant="contained" onClick={save} disabled={blocked || !productId || !selected || (selected._new && (unitsLoading || Boolean(unitsError))) || query.trim() !== selected.name || (!chosenIds.length && !drafts.length && !entry.value.trim())}>{saving ? 'Adding…' : 'Add to product'}</Button></DialogActions>
  </Dialog>;
};

export default ProductAttributeDialog;
