import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack, Paper, Chip, CircularProgress, Box } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';

const formatVersionDate = (value) => {
  if (!value) return 'Unknown publish time';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown publish time' : date.toLocaleString();
};

const DesignVersionHistoryDialog = ({ open, onClose, versions = [], loading, restoringId, onRestore }) => (
  <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <HistoryIcon color="primary" fontSize="small" />
      Published design history
    </DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Restore a published version into the current draft for review. Nothing becomes live until you publish again.
      </Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} aria-label="Loading published design history" />
        </Box>
      ) : versions.length ? (
        <Stack spacing={1}>
          {versions.map((version) => {
            const publisher = version.publisher;
            const publisherName = [publisher?.firstName, publisher?.lastName].filter(Boolean).join(' ') || publisher?.email || 'Admin';
            return (
              <Paper key={version.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" fontWeight={800}>Version {version.revision}</Typography>
                    <Chip label="Published" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {formatVersionDate(version.publishedAt)} · by {publisherName}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RestoreIcon />}
                  onClick={() => onRestore(version)}
                  disabled={Boolean(restoringId)}
                  sx={{ flexShrink: 0 }}
                >
                  Restore
                </Button>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          No published design versions yet.
        </Typography>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={Boolean(restoringId)}>Close</Button>
    </DialogActions>
  </Dialog>
);

export default DesignVersionHistoryDialog;
