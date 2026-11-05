import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress, MenuItem, Select, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import CropIcon from '@mui/icons-material/Crop';
import DuplicateMediaDialog from './DuplicateMediaDialog';
import CropPresetManager from './CropPresetManager';
import useCropPresets from '../../hooks/useCropPresets';
import { mediaService } from '../../services/mediaService';
import { getMediaUrl } from '../../utils/media';
import { editPreview, exportEditedImage, loadImage, presetEdit } from '../../utils/imageEditing';

const MediaImageEditor = lazy(() => import('./MediaImageEditor'));
export const MAX_BULK_CROP = 50;
const finished = (row) => ['Saved', 'Reused'].includes(row.status);
const editable = (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType) || (!file.mimeType && !/\.gif$/i.test(file.filename || file.originalName || ''));
const fileName = (file) => file.originalName || file.filename || 'Image';

export default function BulkMediaCropDialog({ files, onClose, onResults }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const presetStore = useCropPresets();
  const [managingPresets, setManagingPresets] = useState(false);
  const [rows, setRows] = useState(() => files.slice(0, MAX_BULK_CROP).map((file) => ({ file, included: editable(file), status: editable(file) ? 'Loading' : 'Unsupported', error: editable(file) ? '' : 'Only JPEG, PNG and WebP images can be cropped. GIFs are kept unchanged to preserve animation.' })));
  const [preset, setPreset] = useState('product');
  const [preparing, setPreparing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [editing, setEditing] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const alive = useRef(true);
  const stop = useRef(false);
  const decision = useRef(null);
  const locked = useRef(false);
  const patch = (id, values) => { if (alive.current) setRows((current) => current.map((row) => row.file.id === id ? { ...row, ...values } : row)); };
  const prepare = async (row, presetId, settings, current = () => alive.current) => {
    if (!current()) return;
    patch(row.file.id, { status: 'Loading', preview: null, output: null, settings: null, error: '' });
    try {
      const image = await loadImage(getMediaUrl(row.file.url));
      if (!current()) return;
      const edit = settings || presetEdit({ width: image.naturalWidth, height: image.naturalHeight }, presetId, presetStore.presets);
      const result = editPreview(image, edit);
      patch(row.file.id, { ...result, settings: edit, status: 'Ready', error: '', included: row.included });
    } catch (error) { if (current()) patch(row.file.id, { status: 'Failed', error: error.message || 'Could not load this image. Retry its preview.' }); }
  };
  useEffect(() => {
    alive.current = true;
    let active = true;
    (async () => {
      for (const row of rows) {
        if (!active) break;
        if (row.status !== 'Unsupported') await prepare(row, 'product', undefined, () => active && alive.current);
      }
      if (active) setPreparing(false);
    })();
    return () => { active = false; alive.current = false; stop.current = true; decision.current?.('stop'); };
  }, []);

  const applyAll = async () => {
    if (locked.current) return;
    locked.current = true;
    setPreparing(true);
    for (const row of rows) {
      if (!alive.current) break;
      if (!finished(row) && row.status !== 'Unsupported') await prepare(row, presetStore.presets.some(item => item.id === preset) ? preset : 'product');
    }
    if (alive.current) setPreparing(false);
    locked.current = false;
  };
  const chooseDuplicate = (choice) => { decision.current?.(choice); decision.current = null; setDuplicate(null); };
  const save = async () => {
    if (locked.current) return;
    const queue = rows.filter((row) => row.included && row.preview && !finished(row));
    if (!queue.length) return;
    locked.current = true;
    stop.current = false;
    setStopping(false);
    setSaving(true);
    setProgress({ done: 0, total: queue.length });
    let saved = 0;
    let reused = 0;
    let done = 0;
    for (const row of queue) {
      if (stop.current || !alive.current) break;
      patch(row.file.id, { status: 'Saving', error: '' });
      try {
        const image = await loadImage(getMediaUrl(row.file.url));
        if (!alive.current) break;
        const file = await exportEditedImage(image, row.settings.rotation, row.settings.crop, row.settings.width, fileName(row.file));
        if (!alive.current) break;
        let reusedExisting = false;
        try { await mediaService.uploadMedia(file, row.file.type || 'image'); }
        catch (error) {
          const detail = error.response?.data?.error;
          if (detail?.code !== 'DUPLICATE_MEDIA' || !detail.details?.media) throw error;
          if (!alive.current) break;
          const choice = await new Promise((resolve) => { decision.current = resolve; setDuplicate(detail.details.media); });
          if (choice === 'stop' || !alive.current) { stop.current = true; patch(row.file.id, { status: 'Ready' }); break; }
          if (choice === 'skip') {
            patch(row.file.id, { status: 'Skipped', included: false });
            done += 1;
            setProgress({ done, total: queue.length });
            continue;
          }
          if (choice === 'copy') await mediaService.uploadMedia(file, row.file.type || 'image', undefined, { allowDuplicate: true });
          else reusedExisting = true;
        }
        if (reusedExisting) reused += 1; else saved += 1;
        patch(row.file.id, { status: reusedExisting ? 'Reused' : 'Saved' });
      } catch (error) {
        patch(row.file.id, { status: 'Failed', error: error.response?.data?.error?.message || error.message || 'Could not save this image. Retry when ready.' });
      }
      done += 1;
      if (alive.current) setProgress({ done, total: queue.length });
    }
    locked.current = false;
    if (alive.current) {
      setSaving(false);
      if (saved || reused) onResults?.({ saved, reused });
    }
  };
  const pending = rows.filter((row) => row.included && row.preview && !finished(row));
  const complete = rows.filter(finished).length;
  const busy = preparing || saving;
  return <><Dialog open fullScreen={fullScreen} maxWidth="lg" fullWidth onClose={() => !saving && onClose()} aria-labelledby="bulk-crop-title">
    <DialogTitle id="bulk-crop-title">Bulk crop images<Typography variant="body2" color="text.secondary">Apply a preset, review every preview, then save new images.</Typography></DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
      <Alert severity="info" sx={{ mb: 2 }}>Original images and their product or page placements are kept. Crops start at the center; adjust any image whose subject is cut off.</Alert>
      {files.length > MAX_BULK_CROP && <Alert severity="warning" sx={{ mb: 2 }}>Only the first {MAX_BULK_CROP} images are included. Process the remaining images in another batch.</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
        <FormControl disabled={busy} sx={{ minWidth: 220 }}><InputLabel id="bulk-preset-label">Batch preset</InputLabel><Select labelId="bulk-preset-label" label="Batch preset" value={presetStore.presets.some(item => item.id === preset) ? preset : 'product'} onChange={(event) => setPreset(event.target.value)}>
          {presetStore.presets.filter((item) => item.id !== 'free').map((item) => <MenuItem key={item.id} value={item.id}>{item.custom ? `${item.label} (${item.width} × ${item.height})` : item.label}</MenuItem>)}
        </Select></FormControl>
        <Button variant="outlined" disabled={busy || rows.every((row) => finished(row) || row.status === 'Unsupported')} onClick={applyAll}>Apply to all unfinished images</Button>
        <Button disabled={busy} onClick={() => setManagingPresets(true)}>Manage custom presets</Button>
        <Typography variant="body2" role="status" sx={{ ml: { sm: 'auto' } }}>{complete} of {rows.length} saved or reused</Typography>
      </Stack>
      {presetStore.error && <Alert severity="warning" sx={{ my: 2 }} action={<Button onClick={presetStore.reload}>Retry</Button>}>Custom presets unavailable. Built-in presets still work.</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Applying a batch preset replaces individual crop adjustments on unfinished images. Smaller sources are never enlarged.</Typography>
      {(preparing || saving) && <Box role="status" sx={{ mb: 2 }}><LinearProgress variant={saving ? 'determinate' : 'indeterminate'} value={saving ? progress.done / progress.total * 100 : undefined} /><Typography variant="body2" sx={{ mt: 1 }}>{preparing ? 'Preparing image previews…' : `Saving ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`}</Typography></Box>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        {rows.map((row) => <Box key={row.file.id} sx={{ border: '1px solid', borderColor: row.error && row.status !== 'Unsupported' ? 'error.main' : 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ bgcolor: 'action.hover', height: 190, p: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {row.preview ? <Box component="img" src={row.preview} alt={`Crop preview for ${fileName(row.file)}`} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : row.status === 'Loading' ? <CircularProgress aria-label={`Loading ${fileName(row.file)}`} /> : <Typography variant="body2" color="text.secondary">Preview unavailable</Typography>}
          </Box>
          <Box sx={{ p: 1.5 }}><Stack direction="row" spacing={1} alignItems="center"><Checkbox checked={row.included} disabled={busy || finished(row) || row.status === 'Unsupported'} onChange={(e) => patch(row.file.id, { included: e.target.checked, status: row.status === 'Skipped' ? 'Ready' : row.status })} inputProps={{ 'aria-label': `Include ${fileName(row.file)}` }} sx={{ p: 0.5 }} /><Typography variant="body2" noWrap title={fileName(row.file)} sx={{ minWidth: 0, flex: 1, fontWeight: 600 }}>{fileName(row.file)}</Typography><Chip size="small" label={row.status} color={finished(row) ? 'success' : row.status === 'Failed' ? 'error' : 'default'} /></Stack>
            {row.output && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{row.output.width} × {row.output.height} px · {row.settings.presetDefinition?.label || presetStore.presets.find((item) => item.id === row.settings.preset)?.label}</Typography>}
            {row.error && <Typography variant="body2" color={row.status === 'Unsupported' ? 'text.secondary' : 'error.main'} role={row.status === 'Failed' ? 'alert' : undefined} sx={{ mt: 1 }}>{row.error}</Typography>}
            <Button startIcon={<CropIcon />} disabled={busy || !row.preview || finished(row)} onClick={() => setEditing(row)} sx={{ mt: 1 }} aria-label={`Adjust crop for ${fileName(row.file)}`}>Adjust crop</Button>
            {row.status === 'Failed' && !row.preview && <Button disabled={busy} onClick={async () => { setPreparing(true); await prepare(row, preset); if (alive.current) setPreparing(false); }}>Retry preview</Button>}
          </Box>
        </Box>)}
      </Box>
    </DialogContent>
    <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
      {saving && <Button disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }}>{stopping ? 'Stopping after current image…' : 'Stop after current image'}</Button>}
      <Button disabled={saving} onClick={onClose}>{complete ? 'Done' : 'Cancel'}</Button>
      <Button variant="contained" disabled={busy || !pending.length} onClick={save}>{saving ? 'Saving…' : `Save ${pending.length} ${pending.length === 1 ? 'image' : 'images'}`}</Button>
    </DialogActions>
  </Dialog>
    {editing && <Suspense fallback={<CircularProgress aria-label="Loading crop adjustment" />}><MediaImageEditor key={editing.file.id} source={getMediaUrl(editing.file.url)} name={fileName(editing.file)} initialSettings={editing.settings} saveLabel="Apply crop" onClose={() => setEditing(null)} onApplySettings={async (settings) => { await prepare(editing, preset, settings); if (alive.current) setEditing(null); }} /></Suspense>}
    {managingPresets && <CropPresetManager store={presetStore} onClose={() => setManagingPresets(false)} />}
    <DuplicateMediaDialog media={duplicate} onCancel={() => chooseDuplicate('stop')} onSkip={() => chooseDuplicate('skip')} onCopy={() => chooseDuplicate('copy')} onReuse={() => chooseDuplicate('reuse')} />
  </>;
}
