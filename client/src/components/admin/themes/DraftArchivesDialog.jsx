import { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material';
import { getDraftArchives, restoreDraftArchive } from '../../../services/settingsService';

export default function DraftArchivesDialog({ open, onClose, draft, dirty, onRestored }) {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setError('');
    setSelected(null);
    setLoading(true);
    getDraftArchives().then(result => { if (active) setArchives(result.archives || []); })
      .catch(() => { if (active) setError('Could not load archived drafts. Close and retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);
  const restore = async () => {
    setRestoring(true);
    setError('');
    try {
      await restoreDraftArchive(selected.id, draft?.revision);
      await onRestored();
      onClose();
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Could not restore this draft. Close, reload the latest draft, and retry.');
    } finally { setRestoring(false); }
  };
  return <Dialog open={open} onClose={restoring ? undefined : onClose} maxWidth="sm" fullWidth>
    <DialogTitle>{selected ? 'Restore archived draft?' : 'Archived drafts'}</DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {dirty && <Alert severity="warning" sx={{ mb: 2 }}>Save your current edits before restoring an archive.</Alert>}
      {selected ? <Typography>This replaces the current saved draft with archived revision {selected.revision}. The current saved draft will be archived first. Your live storefront stays unchanged. Review the restored design before publishing.</Typography> : loading ? <CircularProgress aria-label="Loading archived drafts" /> : <Stack spacing={1}>
        <Typography variant="body2">Drafts replaced using Use live storefront are kept here for recovery.</Typography>
        {archives.length ? archives.map(archive => <Paper key={archive.id} variant="outlined" sx={{ p: 2 }}>
          <Typography>Draft revision {archive.revision}</Typography>
          <Typography variant="caption">Archived {new Date(archive.createdAt).toLocaleString()}</Typography>
          <Button onClick={() => setSelected(archive)} disabled={dirty || restoring}>Restore draft</Button>
        </Paper>) : <Typography>No archived drafts yet.</Typography>}
      </Stack>}
    </DialogContent>
    <DialogActions>
      <Button onClick={selected ? () => setSelected(null) : onClose} disabled={restoring}>{selected ? 'Cancel' : 'Close'}</Button>
      {selected && <Button variant="contained" onClick={restore} disabled={dirty || restoring}>{restoring ? 'Restoring...' : 'Confirm restore to draft'}</Button>}
    </DialogActions>
  </Dialog>;
}
