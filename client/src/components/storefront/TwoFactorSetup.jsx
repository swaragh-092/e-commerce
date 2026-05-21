import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, Paper } from '@mui/material';
import authService from '../../services/authService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const TwoFactorSetup = ({ user, onUpdate }) => {
  const [step, setStep] = useState('idle'); // idle | setup | verify
  const [qrData, setQrData] = useState(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const is2FAEnabled = user?.twoFactorEnabled;

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.setup2FA();
      setQrData(data);
      setStep('verify');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to setup 2FA'));
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.enable2FA(code);
      setSuccess('2FA enabled successfully!');
      setStep('idle');
      setCode('');
      setQrData(null);
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.disable2FA(disableCode);
      setSuccess('2FA disabled.');
      setDisableCode('');
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid code.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Two-Factor Authentication</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {is2FAEnabled ? (
        <Box component="form" onSubmit={handleDisable}>
          <Alert severity="info" sx={{ mb: 2 }}>2FA is currently enabled on your account.</Alert>
          <TextField
            size="small"
            placeholder="Enter 6-digit code to disable"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
            sx={{ mr: 1 }}
          />
          <Button type="submit" variant="outlined" color="error" disabled={loading || disableCode.length !== 6}>
            Disable 2FA
          </Button>
        </Box>
      ) : step === 'verify' && qrData ? (
        <Box component="form" onSubmit={handleEnable}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
          </Typography>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <img src={qrData.qrCodeDataUrl} alt="2FA QR Code" style={{ width: 200, height: 200 }} />
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mb: 2, wordBreak: 'break-all', color: 'text.secondary' }}>
            Manual key: {qrData.secret}
          </Typography>
          <TextField
            size="small"
            autoFocus
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
            sx={{ mr: 1 }}
          />
          <Button type="submit" variant="contained" disabled={loading || code.length !== 6}>
            Verify & Enable
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Add an extra layer of security to your account with a time-based one-time password (TOTP).
          </Typography>
          <Button variant="contained" onClick={handleSetup} disabled={loading}>
            Set Up 2FA
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default TwoFactorSetup;
