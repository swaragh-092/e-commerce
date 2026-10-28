import { useState } from 'react';
import { Alert, Button, Container, Paper, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import PageSEO from '../../components/common/PageSEO';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function NewsletterConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [already, setAlready] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setBusy(true); setError('');
    try {
      const res = await api.post('/newsletter/confirm', { token });
      const data = res.data?.data || {};
      if (data.cancelled) setCancelled(true);
      else if (data.alreadyConfirmed) setAlready(true);
      else setDone(true);
    } catch (failure) { setError(getApiErrorMessage(failure, 'Could not confirm subscription. Try again.')); }
    finally { setBusy(false); }
  };
  return <Container maxWidth="sm" sx={{ py: 6 }}>
    <PageSEO title="Confirm newsletter subscription" type="noindex" />
    <Paper variant="outlined" sx={{ p: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>Confirm your subscription</Typography>
      {!token && <Alert severity="error">This confirmation link is incomplete. Open the link in your confirmation email.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {done ? <Alert severity="success">Your subscription is confirmed. You'll receive store updates at this email address.</Alert>
        : already ? <Alert severity="info">Your subscription is already confirmed.</Alert>
        : cancelled ? <Alert severity="info">This subscription was cancelled, so this confirmation link is no longer valid. Sign up again if you'd like to resubscribe.</Alert>
        : <>
          <Typography sx={{ mb: 3 }}>Click confirm to start receiving offers, new products, and store updates at this email address.</Typography>
          <Button variant="contained" disabled={!token || busy} onClick={confirm}>{busy ? 'Confirming…' : 'Confirm subscription'}</Button>
        </>}
    </Paper>
  </Container>;
}
