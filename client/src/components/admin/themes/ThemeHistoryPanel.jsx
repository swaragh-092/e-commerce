import { Box, Typography, Button, Chip, Paper, Stack } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';

const ThemeHistoryPanel = ({ activations, onRollback, loading }) => {
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
                <Button size="small" startIcon={<RestoreIcon />} onClick={() => onRollback(a.id)} disabled={loading}>
                  Rollback
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      ))}
    </Stack>
  );
};

export default ThemeHistoryPanel;
