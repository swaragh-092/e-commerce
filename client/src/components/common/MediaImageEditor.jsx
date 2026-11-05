import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import DuplicateMediaDialog from './DuplicateMediaDialog';
import CropPresetManager from './CropPresetManager';
import useCropPresets from '../../hooks/useCropPresets';
import { IMAGE_PRESETS, centeredCrop, cropPixels, drawCrop, exportEditedImage, loadImage, outputSize, rotatedSize } from '../../utils/imageEditing';

export default function MediaImageEditor({ source, name, onClose, onSave, onReuseExisting, initialSettings, onApplySettings, saveLabel = 'Apply changes', saving = false }) {
  const theme = useTheme();
  const fullscreen = useMediaQuery(theme.breakpoints.down('sm'));
  const presetStore = useCropPresets();
  const [managingPresets, setManagingPresets] = useState(false);
  const [presetSnapshot, setPresetSnapshot] = useState(initialSettings?.presetDefinition || null);
  const [image, setImage] = useState(null);
  const [rotation, setRotation] = useState(initialSettings?.rotation || 0);
  const [preset, setPreset] = useState(initialSettings?.preset || 'original');
  const [crop, setCrop] = useState(null);
  const [width, setWidth] = useState('');
  const [preview, setPreview] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const previewCanvas = useRef(null);
  const mounted = useRef(true);
  const busy = saving || exporting;
  const size = image ? rotatedSize(image.naturalWidth, image.naturalHeight, rotation) : null;
  const selectedPreset = (presetSnapshot?.id === preset ? presetSnapshot : null) || presetStore.presets.find((item) => item.id === preset) || IMAGE_PRESETS[0];
  const ratio = preset === 'original' && size ? size.width / size.height : selectedPreset.ratio;
  const pixels = crop && size ? cropPixels(crop, size) : null;
  const output = pixels ? outputSize(pixels, width) : null;
  const validWidth = width !== '' && Number.isInteger(Number(width)) && Number(width) >= 1 && Number(width) <= 4096;

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let url;
    const src = source instanceof Blob ? (url = URL.createObjectURL(source)) : source;
    loadImage(src).then((loaded) => {
      if (!active) return;
      setImage(loaded);
      setCrop(initialSettings?.crop || centeredCrop(loaded.naturalWidth, loaded.naturalHeight));
      setWidth(initialSettings?.width || Math.min(loaded.naturalWidth, 4096));
    }).catch((err) => active && setError(err.message));
    return () => { active = false; mounted.current = false; if (url) URL.revokeObjectURL(url); };
  }, [source]);

  // The interactive canvas is capped; export always uses the original image.
  useEffect(() => {
    if (!image) return;
    let active = true;
    let url;
    const rotated = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
    const scale = Math.min(1, 1400 / Math.max(rotated.width, rotated.height));
    const canvas = document.createElement('canvas');
    try {
      drawCrop(canvas, image, rotation, { x: 0, y: 0, ...rotated }, {
        width: Math.max(1, Math.round(rotated.width * scale)), height: Math.max(1, Math.round(rotated.height * scale)),
      });
      canvas.toBlob((blob) => {
        if (!active || !blob) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      }, 'image/png');
    } catch (err) { setError(err.message); }
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [image, rotation]);

  useEffect(() => {
    if (!image || !pixels || !previewCanvas.current) return;
    const scale = Math.min(1, 480 / Math.max(pixels.width, pixels.height));
    drawCrop(previewCanvas.current, image, rotation, pixels, {
      width: Math.max(1, Math.round(pixels.width * scale)), height: Math.max(1, Math.round(pixels.height * scale)),
    });
  }, [image, rotation, crop]);

  const applyPreset = (id, angle = rotation) => {
    const rotated = rotatedSize(image.naturalWidth, image.naturalHeight, angle);
    const definition = presetStore.presets.find((item) => item.id === id) || (presetSnapshot?.id === id ? presetSnapshot : IMAGE_PRESETS[0]);
    setPresetSnapshot({ ...definition });
    const nextCrop = centeredCrop(rotated.width, rotated.height, definition.ratio);
    const nextPixels = cropPixels(nextCrop, rotated);
    setPreset(id);
    setCrop(nextCrop);
    setWidth(outputSize(nextPixels, definition.width || nextPixels.width).width);
  };
  const rotate = (amount) => {
    const angle = (rotation + amount + 360) % 360;
    setPreview('');
    setRotation(angle);
    applyPreset(preset, angle);
  };
  const persist = async (file, options = {}) => {
    try {
      await onSave(file, options);
    } catch (err) {
      if (!mounted.current) return;
      const responseError = err.response?.data?.error;
      if (responseError?.code === 'DUPLICATE_MEDIA' && responseError.details?.media && onReuseExisting) {
        setDuplicate({ file, media: responseError.details.media });
      } else setError(responseError?.message || err.message || 'Could not save the image. Try again.');
    }
  };
  const save = async () => {
    setExporting(true);
    setError('');
    try {
      if (onApplySettings) {
        await onApplySettings({ rotation, crop, width: output.width, preset, presetDefinition: { ...selectedPreset } });
        return;
      }
      const file = await exportEditedImage(image, rotation, crop, width, name);
      if (mounted.current) await persist(file);
    } catch (err) { if (mounted.current) setError(err.message || 'Could not export the image. Try again.'); }
    finally { if (mounted.current) setExporting(false); }
  };

  return <><Dialog open fullScreen={fullscreen} maxWidth="lg" fullWidth onClose={() => !busy && onClose()} aria-labelledby="image-editor-title">
    <DialogTitle id="image-editor-title">Edit image<Typography variant="body2" color="text.secondary" noWrap>{name}</Typography></DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!image && !error && <Stack role="status" alignItems="center" spacing={2} sx={{ p: 6 }}><CircularProgress /><Typography>Loading image…</Typography></Stack>}
      {image && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 260px' }, gap: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
            <Button disabled={busy} startIcon={<RotateLeftIcon />} onClick={() => rotate(-90)}>Rotate left</Button>
            <Button disabled={busy} startIcon={<RotateRightIcon />} onClick={() => rotate(90)}>Rotate right</Button>
            <Button disabled={busy} startIcon={<RestartAltIcon />} onClick={() => { setRotation(0); applyPreset('original', 0); }}>Reset</Button>
          </Stack>
          <Box sx={{ bgcolor: 'grey.900', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, borderRadius: 1, overflow: 'hidden', '& .ReactCrop': { maxWidth: '100%', lineHeight: 0 }, '& .ReactCrop__crop-selection:focus-visible': { outline: '3px solid', outlineColor: 'primary.light' } }}>
            {preview ? <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} aspect={ratio} minWidth={12} minHeight={12} disabled={busy} ruleOfThirds keepSelection>
              <img src={preview} alt="Drag the crop frame to choose the part to keep" style={{ display: 'block', maxWidth: '100%', maxHeight: '52vh', objectFit: 'contain' }} />
            </ReactCrop> : <CircularProgress aria-label="Preparing rotated image" />}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Drag the frame or its handles to crop. You can also focus the frame and handles and use arrow keys.</Typography>
        </Box>
        <Stack spacing={2.5}>
          <FormControl fullWidth disabled={busy}><InputLabel id="crop-preset-label">Crop preset</InputLabel>
            <Select labelId="crop-preset-label" label="Crop preset" value={preset} onChange={(e) => applyPreset(e.target.value)}>
              {presetStore.presets.map((item) => <MenuItem key={item.id} value={item.id}>{item.custom ? `${item.label} (${item.width} × ${item.height})` : item.label}</MenuItem>)}
              {!presetStore.presets.some(item => item.id === preset) && <MenuItem value={preset}>{selectedPreset.label} (current crop)</MenuItem>}
            </Select>
          </FormControl>
          <Button disabled={busy} onClick={() => setManagingPresets(true)}>Manage custom presets</Button>
          {presetStore.error && <Alert severity="warning" action={<Button onClick={presetStore.reload}>Retry</Button>}>Custom presets unavailable. Built-in presets still work.</Alert>}
          {selectedPreset.width && <Typography variant="body2" color="text.secondary">Suggested: {selectedPreset.width} × {Math.round(selectedPreset.width / selectedPreset.ratio)} px. Smaller images keep their available resolution.</Typography>}
          <TextField label="Output width (px)" type="number" value={width} disabled={busy} onChange={(e) => setWidth(e.target.value)} error={!validWidth} helperText={!validWidth ? 'Enter a whole number from 1 to 4096.' : 'Height stays proportional. Images are never enlarged.'} inputProps={{ min: 1, max: 4096, step: 1 }} />
          {output && <Typography variant="body2" fontWeight={600} aria-live="polite">Output: {output.width} × {output.height} px</Typography>}
          <Divider />
          <Typography variant="subtitle2">Preview</Typography>
          <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, textAlign: 'center', minHeight: 80 }}><canvas ref={previewCanvas} aria-label="Cropped image preview" style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain' }} /></Box>
          <Typography variant="body2" color="text.secondary">{onApplySettings ? 'Apply this crop to the batch preview. The original image is kept.' : 'Saved as a new image. The original and its existing placements are kept.'}</Typography>
        </Stack>
      </Box>}
    </DialogContent>
    <DialogActions sx={{ p: 2, gap: 1 }}><Button disabled={busy} onClick={onClose}>Cancel</Button><Button variant="contained" disabled={busy || !image || !preview || !crop || crop.width <= 0 || crop.height <= 0 || !validWidth} onClick={save}>{busy ? 'Saving…' : saveLabel}</Button></DialogActions>
  </Dialog>
    {managingPresets && <CropPresetManager store={presetStore} initialWidth={output?.width} initialHeight={output?.height} onClose={() => setManagingPresets(false)} />}
    <DuplicateMediaDialog media={duplicate?.media} onCancel={() => setDuplicate(null)} onSkip={() => setDuplicate(null)} onReuse={() => { onReuseExisting?.(duplicate.media); setDuplicate(null); }} onCopy={async () => {
      const file = duplicate.file;
      setDuplicate(null);
      setExporting(true);
      await persist(file, { allowDuplicate: true });
      if (mounted.current) setExporting(false);
    }} />
  </>;
}
