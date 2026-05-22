import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, Paper, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { userService } from '../../services/userService';
import authService from '../../services/authService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const DeleteAccount = ({ user, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const isOAuthUser = user?.email?.endsWith('@phone.local') || !user?.email;
  const isPendingDeletion = !!user?.scheduledDeletionAt;

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = isOAuthUser ? { oauthProvider: user?.oauthProvider || 'google' } : { password };
      const result = await userService.deleteAccount(payload);
      setOpen(false);
      setPassword('');
      setSuccess(`Account scheduled for deletion. You can cancel before ${new Date(result.data.scheduledDeletionAt).toLocaleDateString()}.`);
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete account'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    try {
      await userService.cancelAccountDeletion();
      setSuccess('Account deletion cancelled.');
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to cancel deletion'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 3, border: '1px solid', borderColor: 'error.light' }}>
      <Typography variant="h6" color="error" sx={{ mb: 1 }}>Delete Account</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {isPendingDeletion ? (
        <Box>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your account is scheduled for deletion on {new Date(user.scheduledDeletionAt).toLocaleDateString()}.
          </Alert>
          <Button variant="contained" onClick={handleCancel} disabled={loading}>
            Cancel Deletion
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Your account will be scheduled for deletion after a 30-day grace period. You can cancel anytime during this period.
          </Typography>
          <Button variant="outlined" color="error" onClick={() => setOpen(true)}>
            Delete My Account
          </Button>
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Account Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {isOAuthUser
              ? 'Confirm to schedule your account for deletion in 30 days.'
              : 'Enter your password to confirm. Your account will be deleted after 30 days.'}
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {!isOAuthUser && (
            <TextField
              fullWidth type="password" label="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setPassword(''); setError(''); }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={loading || (!isOAuthUser && !password)}>
            {loading ? 'Processing...' : 'Schedule Deletion'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default DeleteAccount;
