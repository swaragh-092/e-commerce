import { useState } from 'react';
import { Box, Typography, Button, Chip, Paper, Stack, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';

const ThemeHistoryPanel = ({ activations, onRollback, loading }) => {
  const [pendingRollback, setPendingRollback] = useState(null);

  if (!activations?.length) {
    return <Typography color="text.secondary">No theme installations yet.</Typography>;
  }

  return (
    <Stack spacing={1.5}>
      {activations.map((a) => (
        <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle2">{a.themeName} {a.themeVersion && `v${a.themeVersion}`}</Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(a.createdAt).toLocaleString()} • by {a.appliedByUser?.firstName || 'Admin'}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                {(Array.isArray(a.appliedScopes) ? a.appliedScopes : []).map(s => <Chip key={s} label={s} size="small" sx={{ mr: 0.5 }} />)}
              </Box>
            </Box>
            <Box>
              {a.rolledBackAt ? (
                <Chip label="Rolled back" size="small" color="warning" />
              ) : (
                <Button size="small" startIcon={<RestoreIcon />} onClick={() => setPendingRollback(a)} disabled={loading}>
                  Rollback
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      ))}
      <Dialog open={!!pendingRollback} onClose={() => !loading && setPendingRollback(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Rollback this template installation?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Settings and dynamic sources that still match this installation will be restored to their previous state. Newer edits made after the installation will be preserved and reported after rollback.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRollback(null)} disabled={loading}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<RestoreIcon />}
            onClick={() => {
              const activationId = pendingRollback?.id;
              setPendingRollback(null);
              if (activationId) onRollback(activationId);
            }}
            disabled={loading}
          >
            Confirm rollback
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ThemeHistoryPanel;
