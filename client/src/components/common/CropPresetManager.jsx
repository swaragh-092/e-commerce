import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';

export default function CropPresetManager({ store, onClose, initialWidth = 1200, initialHeight = 1200 }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [name, setName] = useState('');
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [removed, setRemoved] = useState(null);
  const validDimension = value => value !== '' && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 4096;
  const valid = name.trim().length > 0 && name.trim().length <= 60 && validDimension(width) && validDimension(height);
  const duplicateName = store.custom.some(preset => preset.recordId !== editing && preset.label.trim().toLowerCase() === name.trim().toLowerCase());
  const perform = async action => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (failure) { setError(failure.response?.data?.error?.message || failure.message || 'Could not save your change. Please retry.'); }
    finally { setBusy(false); }
  };
  const reset = () => { setEditing(null); setName(''); setWidth(initialWidth); setHeight(initialHeight); };
  const submit = event => {
    event.preventDefault();
    if (!valid || duplicateName || busy) return;
    perform(async () => {
      const data = { name: name.trim(), width: Number(width), height: Number(height) };
      if (editing) await store.update(editing, data); else await store.create(data);
      setMessage(`Preset “${data.name}” ${editing ? 'updated' : 'saved'}.`);
      reset();
    });
  };
  return <Dialog open fullScreen={fullScreen} maxWidth="sm" fullWidth onClose={() => !busy && onClose()} aria-labelledby="preset-manager-title">
    <DialogTitle id="preset-manager-title">Custom crop presets</DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Shared across your store’s admins and devices. Width and height define the crop ratio and maximum output size. Smaller images are never enlarged.</Typography>
      {(error || store.error) && <Alert severity="error" sx={{ mb: 2 }} action={store.error ? <Button color="inherit" onClick={store.reload}>Retry</Button> : undefined}>{error || store.error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} role="status">{message}</Alert>}
      {removed && <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" disabled={busy} onClick={() => perform(async () => { await store.restore(removed.recordId); setMessage(`Preset “${removed.label}” restored.`); setRemoved(null); })}>Undo</Button>}>Preset “{removed.label}” removed. Existing images and reviewed crops are kept.</Alert>}
      {store.custom.length >= 50 && !editing && <Alert severity="info" sx={{ mb: 2 }}>You have 50 custom presets. Edit or remove an unused preset before adding another.</Alert>}
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          <Typography variant="subtitle2">{editing ? 'Edit preset' : 'New preset'}</Typography>
          <TextField label="Preset name" value={name} disabled={busy} onChange={event => setName(event.target.value)} inputProps={{ maxLength: 60 }} error={duplicateName} helperText={duplicateName ? 'This name already exists. Choose another name or edit the saved preset.' : 'For example, Instagram portrait or Homepage hero.'} />
          <Stack direction="row" spacing={2}>
            <TextField fullWidth label="Preset width (px)" type="number" value={width} disabled={busy} onChange={event => setWidth(event.target.value)} error={!validDimension(width)} helperText={!validDimension(width) ? 'Whole number, 1–4096.' : undefined} inputProps={{ min: 1, max: 4096, step: 1 }} />
            <TextField fullWidth label="Preset height (px)" type="number" value={height} disabled={busy} onChange={event => setHeight(event.target.value)} error={!validDimension(height)} helperText={!validDimension(height) ? 'Whole number, 1–4096.' : undefined} inputProps={{ min: 1, max: 4096, step: 1 }} />
          </Stack>
          <Stack direction="row" spacing={1}><Button type="submit" variant="contained" disabled={busy || store.loading || Boolean(store.error) || (!editing && store.custom.length >= 50) || !valid || duplicateName}>{busy ? 'Saving…' : editing ? 'Update preset' : 'Save preset'}</Button>{editing && <Button disabled={busy} onClick={reset}>Cancel edit</Button>}</Stack>
        </Stack>
      </Box>
      <Divider sx={{ my: 3 }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}><Typography variant="subtitle2">Saved presets ({store.custom.length}/50)</Typography><Button disabled={busy || store.loading} onClick={store.reload}>Refresh presets</Button></Stack>
      {store.loading && <CircularProgress size={20} aria-label="Loading saved presets" />}
      {!store.loading && !store.custom.length && !store.error && <Typography variant="body2" color="text.secondary">No custom presets yet. Save your first preset above.</Typography>}
      <Stack divider={<Divider />}>
        {store.custom.map(preset => <Stack key={preset.id} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1} sx={{ py: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{preset.label}</Typography><Typography variant="body2" color="text.secondary">{preset.width} × {preset.height} px</Typography></Box>
          <Stack direction="row"><Button disabled={busy} aria-label={`Edit preset ${preset.label}`} onClick={() => { setEditing(preset.recordId); setName(preset.label); setWidth(preset.width); setHeight(preset.height); setError(''); setMessage(''); }}>Edit</Button><Button disabled={busy} color="error" aria-label={`Remove preset ${preset.label}`} onClick={() => perform(async () => { await store.remove(preset.recordId); setRemoved(preset); if (editing === preset.recordId) reset(); })}>Remove</Button></Stack>
        </Stack>)}
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}><Button disabled={busy} onClick={onClose}>Done</Button></DialogActions>
  </Dialog>;
}
