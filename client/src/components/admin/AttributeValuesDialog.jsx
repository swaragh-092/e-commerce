import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import attributeService from '../../services/attributeService';
import { useUnitCatalog } from '../../context/UnitCatalogContext';
import { useNotification } from '../../context/NotificationContext';
import { getAttributeUnitCategory } from '../../constants/units';
import { formatAttributeValue } from '../../utils/attributePresentation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import UnitSelector from './UnitSelector';

const emptyDraft = { value: '', displayLabel: '', swatchColor: '', imageUrl: '', unitLabel: '' };
const valueDraft = (value, attribute) => ({
  value: value.value || '', displayLabel: value.displayLabel || '',
  swatchColor: value.swatchColor || '', imageUrl: value.imageUrl || '',
  unitLabel: value.unitLabel || attribute.unit || '',
});

const AttributeValuesDialog = ({ initialAttribute, canManage, onChange, onClose }) => {
  const { units, loading: unitsLoading, error: unitsError } = useUnitCatalog();
  const { notify, confirm } = useNotification();
  const [attribute, setAttribute] = useState(initialAttribute);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const inputRef = useRef(null);
  const values = attribute.values || [];
  const unitCategory = getAttributeUnitCategory(attribute, units);
  const busy = Boolean(saving);
  const blocked = busy || Boolean(refreshError);
  const original = editingId ? values.find((value) => value.id === editingId) : null;
  const initialDraft = original ? valueDraft(original, attribute) : emptyDraft;
  const dirty = Object.keys(emptyDraft).some((key) => draft[key] !== initialDraft[key]);
  const canSave = canManage && !blocked && draft.value.trim() &&
    (!unitCategory || (draft.unitLabel && !unitsLoading && !unitsError)) && (!editingId || dirty);

  useEffect(() => {
    if (!busy && !refreshError) inputRef.current?.focus();
  }, [busy, refreshError, editingId]);

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const resetEditor = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowDetails(false);
    inputRef.current?.focus();
  };
  const requestClose = async () => {
    if (busy) return;
    if (dirty && !(await confirm({ title: 'Discard unsaved value?', message: 'Your saved values will stay. The value you are currently entering will be discarded.', confirmText: 'Discard value', cancelText: 'Keep editing', severity: 'warning' }))) return;
    onClose();
  };
  const refreshValues = async () => {
    try {
      const response = await attributeService.getAttributeById(attribute.id);
      const next = response?.data?.data;
      if (!next?.id || !Array.isArray(next.values)) throw new Error('Could not refresh the saved values.');
      setAttribute(next);
      setRefreshError('');
      return true;
    } catch (err) {
      const message = getApiErrorMessage(err, 'Could not refresh the saved values.');
      setRefreshError(message);
      notify(message, 'error');
      return false;
    }
  };
  const retryRefresh = async () => {
    if (busy) return;
    setSaving('refresh');
    try { await refreshValues(); } finally { setSaving(''); }
  };
  const saveValue = async (event) => {
    event.preventDefault();
    if (!canSave) return;
    const updating = Boolean(editingId);
    setSaving('value');
    try {
      const payload = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() || null]));
      if (updating) await attributeService.updateAttributeValue(attribute.id, editingId, payload);
      else await attributeService.addAttributeValue(attribute.id, payload);
      resetEditor();
      onChange();
      if (await refreshValues()) notify(updating ? 'Value updated.' : 'Value added.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Could not save the value. Your changes are still here.'), 'error');
    } finally { setSaving(''); }
  };
  const editValue = async (value) => {
    if (!canManage || blocked) return;
    if (dirty && !(await confirm({ title: 'Discard unsaved value?', message: 'Discard the current draft and edit this saved value?', confirmText: 'Discard value', cancelText: 'Keep editing', severity: 'warning' }))) return;
    setEditingId(value.id);
    setDraft(valueDraft(value, attribute));
    setShowDetails(Boolean(value.displayLabel || value.swatchColor || value.imageUrl));
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };
  const removeValue = async (value) => {
    if (!canManage || blocked) return;
    if (!(await confirm({ title: 'Delete value?', message: `Delete “${formatAttributeValue(value, attribute)}”? Values used by products or variants cannot be deleted.`, confirmText: 'Delete value', severity: 'error' }))) return;
    setSaving('remove');
    try {
      await attributeService.removeAttributeValue(attribute.id, value.id);
      if (editingId === value.id) resetEditor();
      onChange();
      if (await refreshValues()) notify('Value deleted.', 'success');
    } catch (err) { notify(getApiErrorMessage(err), 'error'); }
    finally { setSaving(''); }
  };
  const reorderValues = async ({ source, destination }) => {
    if (!canManage || blocked || !destination || source.index === destination.index) return;
    const next = [...values];
    next.splice(destination.index, 0, next.splice(source.index, 1)[0]);
    setSaving('reorder');
    try {
      await attributeService.reorderAttributeValues(attribute.id, next.map((value) => value.id));
      setAttribute((current) => ({ ...current, values: next }));
      onChange();
    } catch (err) { notify(getApiErrorMessage(err), 'error'); }
    finally { setSaving(''); }
  };

  return <Dialog open fullWidth maxWidth="md" onClose={requestClose} aria-labelledby="attribute-values-title" aria-describedby="attribute-values-description"
    PaperProps={{ sx: { borderRadius: 3, maxHeight: 'calc(100dvh - 32px)' } }}>
    <DialogTitle id="attribute-values-header" component="div" sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="attribute-values-title" component="h2" variant="h6" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>Values for {attribute.name}</Typography>
          <Typography id="attribute-values-description" variant="body2" color="text.secondary">{unitCategory ? `Choose a ${unitCategory} unit for each value.` : 'Add the choices customers can select for this attribute.'}</Typography>
        </Box>
        <IconButton aria-label="Close attribute values" disabled={busy} onClick={requestClose} sx={{ minWidth: 44, minHeight: 44 }}><CloseIcon /></IconButton>
      </Stack>
    </DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 }, borderTop: 0, borderBottom: 0 }}>
      {refreshError && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Your change was saved. Refresh the values before making another change.</Typography>
        <Button onClick={retryRefresh} disabled={busy}>Refresh values</Button>
      </Stack>}
      {canManage && <Box component="form" aria-label={editingId ? 'Edit attribute value' : 'Add attribute value'} noValidate onSubmit={saveValue}
        sx={{ p: { xs: 2, sm: 2.5 }, mb: 3, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{editingId ? 'Edit value' : 'Add a value'}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={unitCategory ? 7 : 12}>
            <TextField label="Value" placeholder="New value…" required autoFocus inputRef={inputRef} fullWidth size="small" value={draft.value} disabled={blocked}
              inputProps={{ maxLength: 100 }} onChange={(event) => update('value', event.target.value)} helperText={unitCategory ? 'For example: 600–900 or 1–1.5' : 'For example: Firm or Soft'} />
          </Grid>
          {(unitCategory || draft.unitLabel) && <Grid item xs={12} sm={5}>
            <UnitSelector label="Unit" size="small" margin="none" category={unitCategory} value={draft.unitLabel} disabled={blocked}
              onChange={(value) => update('unitLabel', value)} helperText={unitCategory ? `${unitCategory} units only` : 'Existing unit is preserved.'} />
          </Grid>}
        </Grid>
        <Button size="small" aria-expanded={showDetails} aria-controls="attribute-value-details" onClick={() => setShowDetails((current) => !current)}
          disabled={blocked}
          endIcon={<ExpandMoreIcon sx={{ transform: showDetails ? 'rotate(180deg)' : undefined }} />} sx={{ mt: 1 }}>
          Optional details
        </Button>
        <Collapse in={showDetails} unmountOnExit>
          <Grid container spacing={2} id="attribute-value-details" sx={{ pt: 2 }}>
            <Grid item xs={12} sm={7}><TextField label="Display label" fullWidth size="small" value={draft.displayLabel} disabled={blocked} inputProps={{ maxLength: 100 }} onChange={(event) => update('displayLabel', event.target.value)} helperText="Optional customer-facing label" /></Grid>
            <Grid item xs={12} sm={5}><TextField label="Swatch color" placeholder="#000 or red" fullWidth size="small" value={draft.swatchColor} disabled={blocked} inputProps={{ maxLength: 32 }} onChange={(event) => update('swatchColor', event.target.value)} helperText="For color swatches" /></Grid>
            <Grid item xs={12}><TextField label="Image swatch URL" fullWidth size="small" value={draft.imageUrl} disabled={blocked} inputProps={{ maxLength: 500 }} onChange={(event) => update('imageUrl', event.target.value)} /></Grid>
          </Grid>
        </Collapse>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
          {editingId && <Button onClick={resetEditor} disabled={busy}>Cancel edit</Button>}
          <Button type="submit" variant="contained" startIcon={!editingId && <AddIcon />} disabled={!canSave}>{saving === 'value' ? 'Saving…' : editingId ? 'Save value' : 'Add value'}</Button>
        </Stack>
      </Box>}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>Saved values</Typography><Chip label={values.length} size="small" />
        {canManage && values.length > 1 && <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' }, flexBasis: { xs: '100%', sm: 'auto' } }}>Drag the handles to reorder</Typography>}
      </Stack>
      {!values.length ? <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'action.hover', borderRadius: 2 }}><Typography variant="subtitle2">No values yet</Typography><Typography variant="body2" color="text.secondary">{canManage ? 'Add the first value using the form above.' : 'This attribute has no saved values.'}</Typography></Box>
        : <DragDropContext onDragEnd={reorderValues}>
          <Droppable droppableId={`attribute-values-${attribute.id}`}>
            {(provided) => <Box role="list" aria-label="Saved attribute values" ref={provided.innerRef} {...provided.droppableProps}>
              {values.map((value, index) => <Draggable key={value.id} draggableId={String(value.id)} index={index} isDragDisabled={!canManage || blocked}>
                {(drag, snapshot) => <Box role="listitem" ref={drag.innerRef} {...drag.draggableProps}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 1, border: 1, borderColor: editingId === value.id ? 'primary.main' : 'divider', borderRadius: 1.5, bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper' }}>
                  {canManage && <Box {...drag.dragHandleProps} aria-label={`Reorder ${formatAttributeValue(value, attribute)}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, color: 'text.secondary' }}><DragIndicatorIcon fontSize="small" /></Box>}
                  {value.swatchColor && <Box sx={{ width: 20, height: 20, flexShrink: 0, borderRadius: '50%', bgcolor: value.swatchColor, border: 1, borderColor: 'divider' }} />}
                  {value.imageUrl && <Box component="img" src={value.imageUrl} alt="" sx={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 1 }} />}
                  <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{formatAttributeValue(value, attribute)}</Typography>{value.displayLabel && value.displayLabel !== value.value && <Typography variant="caption" color="text.secondary">{value.value}</Typography>}</Box>
                  {canManage && <Stack direction="row" spacing={1}>
                    <Tooltip title="Edit value"><span><IconButton aria-label={`Edit ${formatAttributeValue(value, attribute)}`} disabled={blocked} onClick={() => editValue(value)} sx={{ minHeight: 44, minWidth: 44 }}><EditOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                    <Tooltip title="Delete value"><span><IconButton aria-label={`Delete ${formatAttributeValue(value, attribute)}`} disabled={blocked} onClick={() => removeValue(value)} sx={{ minHeight: 44, minWidth: 44 }}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
                  </Stack>}
                </Box>}
              </Draggable>)}
              {provided.placeholder}
            </Box>}
          </Droppable>
        </DragDropContext>}
    </DialogContent>
    <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>{canManage ? 'Changes are saved as you go.' : 'Saved choices for this attribute.'}</Typography>
      <Button variant="outlined" onClick={requestClose} disabled={busy}>Done</Button>
    </DialogActions>
  </Dialog>;
};

export default AttributeValuesDialog;
