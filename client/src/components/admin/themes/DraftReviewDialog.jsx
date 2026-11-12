import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material';
import { getDesignState } from '../../../services/settingsService';

const formatValue = (value, absent) => absent ? 'No stored value (uses defaults)' : JSON.stringify(value, null, 2);

export default function DraftReviewDialog({ open, onClose, draft, conflicts = [] }) {
  const [live, setLive] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLive(null);
    setError('');
    getDesignState().then(result => { if (active) setLive(result.groups || {}); })
      .catch(() => { if (active) setError('Could not load the live design. Close and retry.'); });
    return () => { active = false; };
  }, [open]);
  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle>Review saved draft against live design</DialogTitle>
    <DialogContent dividers>
      <Alert severity="info" sx={{ mb: 2 }}>This comparison is read-only. It does not publish, discard, or merge settings. Save unsaved edits before reviewing them here.</Alert>
      {error ? <Alert severity="error">{error}</Alert> : !live ? <CircularProgress aria-label="Loading live design comparison" /> : (
        <Stack spacing={2}>{(draft?.payload || []).map(entry => {
          const conflict = conflicts.some(item => item.group === entry.group && item.key === entry.key);
          const current = live[entry.group] || {};
          return <Paper variant="outlined" sx={{ p: 2 }} key={`${entry.group}.${entry.key}`}>
            <Typography fontWeight={700}>{entry.group}.{entry.key}{conflict ? ' — conflict' : ''}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
              <Box><Typography variant="subtitle2">Live design now</Typography><Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 220, overflow: 'auto', fontSize: 12 }}>{formatValue(current[entry.key], !Object.hasOwn(current, entry.key))}</Box></Box>
              <Box><Typography variant="subtitle2">Saved draft</Typography><Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 220, overflow: 'auto', fontSize: 12 }}>{entry.operation === 'delete' ? 'Reset to default' : formatValue(entry.value, false)}</Box></Box>
            </Box>
          </Paper>;
        })}</Stack>
      )}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Keep editing draft</Button></DialogActions>
  </Dialog>;
}
