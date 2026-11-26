import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, Paper, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { userService } from '../../services/userService';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../utils/apiErrors';

const DeleteAccount = ({ user, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const isPhoneUser = user?.email?.endsWith('@phone.local');
  const isPendingDeletion = !!user?.scheduledDeletionAt;

  const closeDialog = () => {
    setOpen(false);
    setPassword('');
    setOtp('');
    setCodeSent(false);
    setError('');
  };

  const handleSendCode = async () => {
    setLoading(true);
    setError('');
    try {
      await userService.requestDeletionCode();
      setCodeSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send a verification code'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = isPhoneUser ? { otp } : { password };
      const result = await userService.deleteAccount(payload);
      closeDialog();
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
            You can cancel your request during the 30-day grace period. Active orders must be completed or cancelled first.
            If you have past orders, contact support for help with removing your account data after access ends.
          </Typography>
          <Button variant="outlined" color="error" onClick={() => setOpen(true)}>
            Delete My Account
          </Button>
        </Box>
      )}

      <Dialog open={open} onClose={loading ? undefined : closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Account Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {isPhoneUser
              ? 'Verify your phone number to schedule account deletion in 30 days.'
              : 'Enter your password to schedule account deletion in 30 days.'}
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {isPhoneUser ? (
            <>
              <Button onClick={handleSendCode} disabled={loading}>
                {codeSent ? 'Resend verification code' : 'Send verification code'}
              </Button>
              {codeSent && (
                <TextField
                  fullWidth label="Verification code" value={otp} onChange={(e) => setOtp(e.target.value)}
                  autoComplete="one-time-code" slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
                />
              )}
            </>
          ) : (
            <>
              <TextField
                fullWidth type="password" label="Password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
              />
              <Button component={Link} to="/forgot-password">Set or reset password</Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={loading}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}
            disabled={loading || (isPhoneUser ? !/^\d{6}$/.test(otp) : !password)}>
            {loading ? 'Processing...' : 'Schedule Deletion'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default DeleteAccount;
