import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import CropIcon from '@mui/icons-material/Crop';
import { mediaService } from '../../services/mediaService';
import DuplicateMediaDialog from './DuplicateMediaDialog';
import { useNotification } from '../../context/NotificationContext';

const MediaImageEditor = lazy(() => import('./MediaImageEditor'));
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const validateFile = (file) => !ALLOWED_MIMES.includes(file.type)
  ? 'Choose a JPEG, PNG, WebP, or GIF image.'
  : file.size > MAX_FILE_SIZE ? 'This file exceeds 5 MB. Choose a smaller image.' : '';

function UploadThumbnail({ file }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <Box component="img" src={src || undefined} alt="" sx={{ width: 56, height: 56, objectFit: 'contain', bgcolor: 'action.hover', borderRadius: 1 }} />;
}

export default function MediaUploader({ onUploadSuccess, onAllUploadsComplete, multiple = true, autoUpload = true, uploadType = 'image' }) {
  const [rows, setRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [duplicate, setDuplicate] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const abort = useRef(null);
  const decision = useRef(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const nextId = useRef(0);
  const { notify } = useNotification();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abort.current?.abort(); decision.current?.('skip'); };
  }, []);
  const update = (id, patch) => { if (mounted.current) setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row)); };
  const resolveDuplicate = (choice) => {
    decision.current?.(choice);
    decision.current = null;
    setDuplicate(null);
  };
  const cancel = () => {
    abort.current?.abort();
    resolveDuplicate('skip');
  };

  const run = async (queue, hasInvalid = rows.some((row) => row.status === 'Invalid')) => {
    if (busy.current || !queue.length) return;
    busy.current = true;
    setUploading(true);
    setProgress({ done: 0, total: queue.length });
    const controller = new AbortController();
    abort.current = controller;
    let failed = false;
    let completed = 0;
    for (const row of queue) {
      if (controller.signal.aborted || !mounted.current) break;
      update(row.id, { status: 'Uploading…', error: '' });
      try {
        let media;
        try {
          const response = await mediaService.uploadMedia(row.file, uploadType, controller.signal);
          media = response?.data?.media;
        } catch (err) {
          const existing = err.response?.data?.error;
          if (existing?.code !== 'DUPLICATE_MEDIA' || !existing.details?.media) throw err;
          if (controller.signal.aborted || !mounted.current) break;
          const choice = await new Promise((resolve) => {
            decision.current = resolve;
            setDuplicate({ file: row.file, media: existing.details.media });
          });
          if (controller.signal.aborted || !mounted.current) break;
          if (choice === 'skip') {
            update(row.id, { status: 'Skipped' });
            completed += 1;
            setProgress({ done: completed, total: queue.length });
            continue;
          }
          if (choice === 'reuse') media = existing.details.media;
          else {
            const response = await mediaService.uploadMedia(row.file, uploadType, controller.signal, { allowDuplicate: true });
            media = response?.data?.media;
          }
        }
        if (controller.signal.aborted || !mounted.current) break;
        if (!media) throw new Error('The server returned no image. Please retry.');
        update(row.id, { status: 'Ready' });
        onUploadSuccess?.(media);
      } catch (err) {
        if (controller.signal.aborted || !mounted.current) break;
        failed = true;
        update(row.id, { status: 'Failed', error: err.response?.data?.error?.message || err.message || 'Upload failed. Please retry.' });
      }
      completed += 1;
      if (mounted.current) setProgress({ done: completed, total: queue.length });
    }
    const cancelled = controller.signal.aborted;
    if (mounted.current) {
      if (cancelled) setRows((current) => current.map((row) => row.status === 'Uploading…' ? { ...row, status: 'Pending' } : row));
      setUploading(false);
      if (cancelled) notify('Upload cancelled. Remaining images are ready to retry.', 'info');
    }
    busy.current = false;
    abort.current = null;
    if (mounted.current && !failed && !cancelled && !hasInvalid) onAllUploadsComplete?.();
  };

  const selectFiles = (files) => {
    if (busy.current) return;
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (!multiple && selected.length > 1) notify('Only one image can be selected here.', 'info');
    const additions = (multiple ? selected : selected.slice(0, 1)).map((file) => ({
      id: ++nextId.current, file, error: validateFile(file), status: validateFile(file) ? 'Invalid' : 'Pending',
    }));
    setRows((current) => multiple ? [...current.filter((row) => !['Ready', 'Skipped'].includes(row.status)), ...additions] : additions);
    if (autoUpload) run(additions.filter((row) => !row.error), additions.some((row) => row.error));
  };
  const pending = rows.filter((row) => ['Pending', 'Failed'].includes(row.status));

  return <Box>
    <Box onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); selectFiles(e.dataTransfer.files); }}
      sx={{ border: '2px dashed', borderColor: dragging ? 'primary.main' : 'divider', borderRadius: 2, p: { xs: 2, sm: 3 }, bgcolor: dragging ? 'action.selected' : 'background.paper', textAlign: 'center' }}>
      <input ref={input} type="file" aria-label="Choose images" accept={ALLOWED_MIMES.join(',')} multiple={multiple} disabled={uploading} onChange={(e) => { selectFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
      <UploadIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
      <Typography variant="subtitle2">{multiple ? 'Drop images here' : 'Drop an image here'}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>JPEG, PNG, WebP or GIF · Up to 5 MB each</Typography>
      <Button variant="outlined" disabled={uploading} onClick={() => input.current?.click()} sx={{ mt: 1.5 }}>Choose {multiple ? 'images' : 'image'}</Button>
    </Box>
    {rows.length > 0 && <Stack spacing={1.5} sx={{ mt: 2 }}>
      {!autoUpload && <Typography variant="body2" color="text.secondary">Review your images. Crop or resize before uploading.</Typography>}
      <Stack spacing={1} sx={{ maxHeight: 340, overflowY: 'auto' }}>
        {rows.map((row) => <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, border: '1px solid', borderColor: row.error ? 'error.main' : 'divider', borderRadius: 1 }}>
          <UploadThumbnail file={row.file} />
          <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" noWrap title={row.file.name}>{row.file.name}</Typography><Typography variant="caption" color={row.error ? 'error.main' : 'text.secondary'} sx={{ display: 'block' }} role={row.error ? 'alert' : undefined}>{row.error || `${(row.file.size / 1024).toFixed(1)} KB · ${row.status}`}</Typography></Box>
          {!['Ready', 'Skipped'].includes(row.status) && <Stack direction="row">
            <Tooltip title={row.file.type === 'image/gif' ? 'GIF editing is unavailable to preserve animation' : 'Crop, rotate and resize'}><span><IconButton aria-label={`Edit ${row.file.name}`} disabled={uploading || row.status === 'Invalid' || row.file.type === 'image/gif'} onClick={() => setEditing(row)}><CropIcon /></IconButton></span></Tooltip>
            <IconButton aria-label={`Remove ${row.file.name}`} disabled={uploading} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><DeleteIcon /></IconButton>
          </Stack>}
        </Box>)}
      </Stack>
      {uploading ? <Box role="status" aria-live="polite"><LinearProgress variant="determinate" value={progress.total ? progress.done / progress.total * 100 : 0} /><Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}><Typography variant="body2">{duplicate ? 'Waiting for your duplicate choice' : `Processing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`}</Typography><Button color="error" onClick={cancel}>Cancel upload</Button></Stack></Box>
        : pending.length > 0 && <Button variant="contained" onClick={() => run(pending)} startIcon={<UploadIcon />}>Upload {pending.length} {pending.length === 1 ? 'image' : 'images'}</Button>}
    </Stack>}
    {editing && <Suspense fallback={<CircularProgress aria-label="Loading image editor" sx={{ m: 2 }} />}><MediaImageEditor source={editing.file} name={editing.file.name} onClose={() => setEditing(null)} onSave={(file) => { update(editing.id, { file, status: 'Pending', error: '' }); setEditing(null); }} /></Suspense>}
    <DuplicateMediaDialog media={duplicate?.media} onCancel={cancel} onSkip={() => resolveDuplicate('skip')} onCopy={() => resolveDuplicate('copy')} onReuse={() => resolveDuplicate('reuse')} />
  </Box>;
}
