import { useId } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getMediaUrl } from '../../utils/media';

export default function DuplicateMediaDialog({ media, onCancel, onSkip, onCopy, onReuse }) {
  const titleId = useId();
  return <Dialog open={Boolean(media)} onClose={onCancel} maxWidth="sm" fullWidth aria-labelledby={titleId}>
    <DialogTitle id={titleId} sx={{ pr: 7 }}>This image is already in your library<IconButton aria-label="Cancel upload" onClick={onCancel} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton></DialogTitle>
    <DialogContent><Typography variant="body2" sx={{ mb: 2 }}>The file contents match exactly, even if the filename is different. Reuse the existing image to avoid another copy.</Typography>
      {media && <Stack direction="row" spacing={2} alignItems="center"><Box component="img" src={getMediaUrl(media.url)} alt="Existing library image" sx={{ width: 96, height: 96, objectFit: 'contain', borderRadius: 1, bgcolor: 'action.hover' }} /><Box sx={{ minWidth: 0 }}><Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{media.originalName || media.filename}</Typography><Typography variant="body2" color="text.secondary">Already uploaded · {(Number(media.size) / 1024).toFixed(1)} KB</Typography></Box></Stack>}
    </DialogContent>
    <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}><Button onClick={onSkip}>Skip</Button><Button onClick={onCopy}>Upload another copy</Button><Button variant="contained" onClick={onReuse}>Use existing image</Button></DialogActions>
  </Dialog>;
}
