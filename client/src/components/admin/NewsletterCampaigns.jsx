import { useCallback, useEffect, useState, useRef } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function NewsletterCampaigns() {
  const { hasPermission } = useAuth();
  const { confirm, notify } = useNotification();
  const canEdit = hasPermission(PERMISSIONS.NEWSLETTER_MANAGE);
  const editAccess = useRef(canEdit);
  editAccess.current = canEdit;
  const [campaigns, setCampaigns] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scheduleId, setScheduleId] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');

  const load = useCallback(async () => {
    try { setCampaigns((await api.get('/newsletter/campaigns')).data.data); }
    catch (failure) { setError(getApiErrorMessage(failure, 'Could not load campaigns.')); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canEdit) { setScheduleId(null); setEditId(null); setSubject(''); setMessage(''); }
  }, [canEdit]);

  const action = async (callback, successMessage) => {
    if (!editAccess.current) return;
    setBusy(true);
    setError('');
    try {
      await callback();
      notify(successMessage, 'success');
      await load();
    } catch (failure) { setError(getApiErrorMessage(failure, 'Could not save campaign.')); }
    finally { setBusy(false); }
  };

  const sendNow = async (campaign) => {
    if (!await confirm('Send newsletter', `Queue “${campaign.subject}” for all active newsletter subscribers?`, 'warning')) return;
    await action(() => api.post(`/newsletter/campaigns/${campaign.id}/schedule`, {}), 'Campaign scheduled to send shortly.');
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Newsletter campaigns</Typography>
        <Button onClick={load} disabled={busy}>Refresh delivery results</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {canEdit && <Box component="form" onSubmit={(event) => {
        event.preventDefault();
        action(async () => {
          if (editId) await api.put(`/newsletter/campaigns/${editId}`, { subject, message });
          else await api.post('/newsletter/campaigns', { subject, message });
          setSubject(''); setMessage(''); setEditId(null);
        }, 'Campaign draft saved.');
      }}>
        <TextField fullWidth label="Email subject" required value={subject} onChange={(event) => setSubject(event.target.value)} inputProps={{ maxLength: 200 }} disabled={busy} sx={{ mb: 2 }} />
        <TextField fullWidth multiline minRows={5} label="Message" required value={message} onChange={(event) => setMessage(event.target.value)} inputProps={{ maxLength: 20000 }} disabled={busy} helperText="Write plain text. Store branding and an unsubscribe link are added to every email." sx={{ mb: 2 }} />
        {message && <Box sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2">Message preview</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 1 }}>{message}</Typography>
        </Box>}
        <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
          <Button variant="contained" type="submit" disabled={busy}>Save draft</Button>
          {editId && <Button disabled={busy} onClick={() => { setEditId(null); setSubject(''); setMessage(''); }}>Close draft</Button>}
          <Button disabled={busy || !subject.trim() || !message.trim()} onClick={() => action(() => api.post('/newsletter/campaigns/test', { subject, message }), 'Test email sent to your account email.')}>Send test to me</Button>
        </Stack>
      </Box>}
      <TableContainer>
        <Table size="small" aria-label="Newsletter campaigns">
          <TableHead><TableRow><TableCell>Campaign</TableCell><TableCell>Status</TableCell><TableCell>Delivery</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {!campaigns.length && <TableRow><TableCell colSpan={4}>No campaigns yet.</TableCell></TableRow>}
            {campaigns.map((campaign) => <TableRow key={campaign.id}>
              <TableCell>{campaign.subject}{campaign.scheduledAt && <Typography variant="caption" display="block">{new Date(campaign.scheduledAt).toLocaleString()}</Typography>}</TableCell>
              <TableCell><Chip size="small" label={campaign.status} /></TableCell>
              <TableCell>{campaign.recipientCount} queued · {campaign.delivery.sent || 0} sent · {campaign.delivery.failed || 0} failed · {campaign.delivery.skipped || 0} skipped</TableCell>
              <TableCell>{canEdit && <Stack direction="row" spacing={1}>
                {campaign.status === 'draft' && <>
                  <Button size="small" disabled={busy} onClick={() => { setEditId(campaign.id); setSubject(campaign.subject); setMessage(campaign.message); }}>Edit</Button>
                  <Button size="small" disabled={busy} onClick={() => sendNow(campaign)}>Send now</Button>
                  <Button size="small" disabled={busy} onClick={() => { setScheduleId(campaign.id); setScheduledAt(''); }}>Schedule</Button>
                </>}
                {['draft', 'scheduled'].includes(campaign.status) && <Button size="small" disabled={busy} onClick={async () => {
                  if (await confirm('Cancel campaign', `Cancel “${campaign.subject}”?`, 'warning')) await action(() => api.post(`/newsletter/campaigns/${campaign.id}/cancel`), 'Campaign cancelled.');
                }}>Cancel</Button>}
              </Stack>}</TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={canEdit && Boolean(scheduleId)} onClose={() => { if (!busy) setScheduleId(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Schedule newsletter</DialogTitle>
        <DialogContent>
          <TextField fullWidth type="datetime-local" label="Send time" InputLabelProps={{ shrink: true }} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} helperText="Shown in your local time. Sending begins within a minute of this time." sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setScheduleId(null)}>Close</Button><Button disabled={busy || !scheduledAt} onClick={() => action(async () => {
          await api.post(`/newsletter/campaigns/${scheduleId}/schedule`, { scheduledAt: new Date(scheduledAt).toISOString() }); setScheduleId(null);
        }, 'Campaign scheduled.')}>Schedule</Button></DialogActions>
      </Dialog>
    </Paper>
  );
}
