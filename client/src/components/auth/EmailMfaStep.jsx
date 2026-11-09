import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import authService from '../../services/authService';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function EmailMfaStep({ challenge, onBack, onComplete }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (sent) {
        await authService.verifyEmailMfaCode(challenge, code);
        await onComplete();
      } else {
        await authService.sendEmailMfaCode(challenge);
        setSent(true);
      }
    } catch (err) {
      // A previous send from this sign-in may still be valid.
      if (!sent && err.response?.status === 429) setSent(true);
      setError(getApiErrorMessage(err, 'Email verification could not finish. Try your authenticator.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack component="form" onSubmit={submit} spacing={2}>
      <Typography variant="h6">Verify by email</Typography>
      <Typography variant="body2">
        {sent ? 'Enter the six-digit code sent to your verified email address.'
          : 'Send a one-time sign-in code to your verified email address.'}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {sent && <TextField
        label="Email code" value={code} autoFocus
        onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 6 }}
      />}
      <Button type="submit" variant="contained" disabled={busy || (sent && code.length !== 6)}>
        {sent ? 'Verify and sign in' : 'Email me a code'}
      </Button>
      <Button type="button" disabled={busy} onClick={onBack}>Use authenticator or backup code</Button>
    </Stack>
  );
}
