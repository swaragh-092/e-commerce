import { useState } from 'react';
import { Alert, Button, Container, Paper, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import PageSEO from '../../components/common/PageSEO';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function NewsletterUnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const unsubscribe = async () => {
    setBusy(true); setError('');
    try { await api.post('/newsletter/unsubscribe', { token }); setDone(true); }
    catch (failure) { setError(getApiErrorMessage(failure, 'Could not unsubscribe. Try again.')); }
    finally { setBusy(false); }
  };
  return <Container maxWidth="sm" sx={{ py: 6 }}>
    <PageSEO title="Newsletter preferences" type="noindex" />
    <Paper variant="outlined" sx={{ p: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>Newsletter preferences</Typography>
      {!token && <Alert severity="error">This unsubscribe link is incomplete. Open the link in your newsletter email.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {done ? <Alert severity="success">You have unsubscribed from offers and store updates. Your order and account emails will continue.</Alert> : <>
        <Typography sx={{ mb: 3 }}>Stop receiving offers, new products, and store updates at this email address.</Typography>
        <Button variant="contained" disabled={!token || busy} onClick={unsubscribe}>{busy ? 'Unsubscribing…' : 'Unsubscribe'}</Button>
      </>}
    </Paper>
  </Container>;
}
