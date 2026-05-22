import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, Paper } from '@mui/material';
import authService from '../../services/authService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const TwoFactorSetup = ({ user, onUpdate }) => {
  const [step, setStep] = useState('idle'); // idle | setup | verify | showCodes
  const [qrData, setQrData] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const is2FAEnabled = user?.twoFactorEnabled;

  const handleSetup = async () => {
    setLoading(true); setError('');
    try {
      const data = await authService.setup2FA();
      setQrData(data);
      setStep('verify');
    } catch (err) { setError(getApiErrorMessage(err, 'Failed to setup 2FA')); }
    finally { setLoading(false); }
  };

  const handleEnable = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const data = await authService.enable2FA(code);
      setBackupCodes(data.backupCodes);
      setStep('showCodes');
      setCode(''); setQrData(null);
      if (onUpdate) onUpdate();
    } catch (err) { setError(getApiErrorMessage(err, 'Invalid code.')); }
    finally { setLoading(false); }
  };

  const handleDisable = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await authService.disable2FA(disableCode);
      setSuccess('2FA disabled.'); setDisableCode('');
      if (onUpdate) onUpdate();
    } catch (err) { setError(getApiErrorMessage(err, 'Invalid code.')); }
    finally { setLoading(false); }
  };

  const handleRegenerate = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const data = await authService.regenerateBackupCodes(regenCode);
      setBackupCodes(data.backupCodes);
      setStep('showCodes');
      setRegenCode('');
      setSuccess('New backup codes generated.');
    } catch (err) { setError(getApiErrorMessage(err, 'Invalid code.')); }
    finally { setLoading(false); }
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Two-Factor Authentication</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Show backup codes after enable or regenerate */}
      {step === 'showCodes' && backupCodes ? (
        <Box>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Save these backup codes securely. Each can be used once if you lose access to your authenticator app.
          </Alert>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2, fontFamily: 'monospace', fontSize: 14 }}>
            {backupCodes.map((c, i) => (
              <Box key={i} sx={{ p: 1, bgcolor: 'grey.100', borderRadius: 1, textAlign: 'center' }}>{c}</Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="outlined" size="small" onClick={() => {
              navigator.clipboard.writeText(backupCodes.join('\n'));
              setSuccess('Codes copied to clipboard');
            }}>
              Copy
            </Button>
            <Button variant="outlined" size="small" onClick={() => {
              const text = `2FA Backup Codes\n${'='.repeat(20)}\n\n${backupCodes.join('\n')}\n\nEach code can only be used once.`;
              const blob = new Blob([text], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = '2fa-backup-codes.txt'; a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}>
              Download
            </Button>
          </Box>
          <Button variant="contained" onClick={() => { setStep('idle'); setBackupCodes(null); }}>
            I've saved my codes
          </Button>
        </Box>
      ) : is2FAEnabled ? (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>2FA is currently enabled on your account.</Alert>
          
          <Box component="form" onSubmit={handleDisable} sx={{ mb: 3 }}>
            <TextField
              size="small" placeholder="Enter 6-digit code to disable"
              value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ maxLength: 6, inputMode: 'numeric' }} sx={{ mr: 1 }}
            />
            <Button type="submit" variant="outlined" color="error" disabled={loading || disableCode.length !== 6}>
              Disable 2FA
            </Button>
          </Box>

          <Box component="form" onSubmit={handleRegenerate}>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Lost your backup codes? Generate new ones:
            </Typography>
            <TextField
              size="small" placeholder="Enter 6-digit code"
              value={regenCode} onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ maxLength: 6, inputMode: 'numeric' }} sx={{ mr: 1 }}
            />
            <Button type="submit" variant="outlined" disabled={loading || regenCode.length !== 6}>
              Regenerate Backup Codes
            </Button>
          </Box>
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
            size="small" autoFocus placeholder="Enter 6-digit code"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ maxLength: 6, inputMode: 'numeric' }} sx={{ mr: 1 }}
          />
          <Button type="submit" variant="contained" disabled={loading || code.length !== 6}>
            Verify & Enable
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Add an extra layer of security with a time-based one-time password (TOTP).
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
