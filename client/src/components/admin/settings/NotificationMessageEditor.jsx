import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { notificationService } from '../../../services/notificationService';
import { getApiErrorMessage } from '../../../utils/apiErrors';

export const channels = [{ key: 'email', label: 'Email' }, { key: 'sms', label: 'SMS' }, { key: 'whatsapp', label: 'WhatsApp' }];

export default function NotificationMessageEditor({ event, rule, channel, disabled, onChange }) {
  const message = rule.messages[channel];
  const [dialog, setDialog] = useState('preview');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [preview, setPreview] = useState(null);
  const [emailFormat, setEmailFormat] = useState(message.bodyHtml ? 'html' : 'text');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const focusedField = useRef(null);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current++; }, []);
  const update = patch => onChange({ messages: { ...rule.messages, [channel]: { ...message, ...patch } } });
  const insert = token => {
    const field = focusedField.current;
    const key = field?.dataset.messageField || (channel === 'email' && message.bodyHtml ? 'bodyHtml' : 'bodyText');
    const value = message[key] || '';
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    update({ [key]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => { if (field?.isConnected) { field.focus(); field.setSelectionRange(start + token.length, start + token.length); } });
  };
  const focusProps = field => ({ 'data-message-field': field, onFocus: event => { focusedField.current = event.target; } });
  const open = async mode => {
    setDialog(mode); setDialogOpen(true); setFeedback(null); setPreview(null);
    if (mode !== 'preview') return;
    const id = ++requestId.current;
    setBusy(true);
    try {
      const result = await notificationService.preview(event.key, message);
      if (id === requestId.current) setPreview(result);
    } catch (error) { if (id === requestId.current) setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Could not render this message. Check the template syntax.') }); }
    finally { if (id === requestId.current) setBusy(false); }
  };
  const sendTest = async () => {
    setBusy(true); setFeedback(null);
    try {
      const result = await notificationService.test(event.key, { channel, recipient: recipient.trim(), message });
      setFeedback(result.simulated ? { type: 'info', message: 'Test simulated in development. Configure email credentials in Messaging settings to deliver it to an inbox.' }
        : { type: 'success', message: 'Test message sent to the address you entered.' });
    } catch (error) { setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Could not send the test message.') }); }
    finally { setBusy(false); }
  };
  const close = () => { if (!busy || dialog === 'preview') { requestId.current++; setBusy(false); setDialogOpen(false); setRecipient(''); setFeedback(null); } };
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {channel === 'email' && <>
        <TextField fullWidth size="small" label="Email subject" value={message.subject} disabled={disabled} onChange={e => update({ subject: e.target.value })} inputProps={focusProps('subject')} />
        <TextField select size="small" label="Email format" value={emailFormat} disabled={disabled}
          onChange={e => { setEmailFormat(e.target.value); update({ bodyHtml: e.target.value === 'html' ? `<p>${(message.bodyText || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : '' }); }} sx={{ maxWidth: 260 }}>
          <MenuItem value="text">Plain text</MenuItem><MenuItem value="html">HTML email</MenuItem>
        </TextField>
      </>}
      <Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>Personalize your message — select a variable to insert it.</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap">{event.variables.map(variable => <Chip key={variable} size="small" variant="outlined" label={`{{${variable}}}`} disabled={disabled} onClick={() => insert(`{{${variable}}}`)} sx={{ fontFamily: 'monospace', fontSize: 11 }} />)}</Stack>
      </Box>
      {channel === 'email' && emailFormat === 'html' && <TextField fullWidth multiline minRows={10} maxRows={22} label="Email HTML" value={message.bodyHtml} disabled={disabled}
        onChange={e => update({ bodyHtml: e.target.value })} inputProps={{ ...focusProps('bodyHtml'), style: { fontFamily: 'monospace', fontSize: 12 } }} />}
      <TextField fullWidth multiline minRows={5} maxRows={12} label={channel === 'email' && message.bodyHtml ? 'Plain text fallback' : 'Message'}
        value={message.bodyText} disabled={disabled} onChange={e => update({ bodyText: e.target.value })} inputProps={focusProps('bodyText')}
        helperText={channel === 'sms' ? `${message.bodyText.length} characters. Longer messages may use multiple SMS segments.` : 'Variables are filled in using the actual order or enquiry.'} />
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => open('preview')}>Preview message</Button>
        <Button size="small" startIcon={<SendOutlinedIcon />} disabled={disabled} onClick={() => open('test')}>Send a test</Button>
      </Stack>
      <Dialog open={dialogOpen} onClose={close} fullWidth maxWidth={dialog === 'preview' ? 'md' : 'sm'}>
        <DialogTitle>{dialog === 'preview' ? 'Message preview' : 'Send a test message'}</DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 2 }}>
          <Alert severity="info">{dialog === 'preview' ? 'Preview uses sample data and your current edits.' : 'Uses your current edits and sends only to the address below. This does not activate or save the notification.'}</Alert>
          {feedback && <Alert severity={feedback.type}>{feedback.message}</Alert>}
          {busy && <CircularProgress size={24} aria-label={dialog === 'preview' ? 'Rendering preview' : 'Sending test'} />}
          {dialog === 'test' && <TextField autoFocus fullWidth label={channel === 'email' ? 'Test email address' : 'Test phone number'} value={recipient} disabled={busy} type={channel === 'email' ? 'email' : 'tel'}
            placeholder={channel === 'email' ? 'you@example.com' : '+919876543210'} onChange={e => setRecipient(e.target.value)} helperText="The selected channel must be enabled in Messaging settings." />}
          {preview && <>
            {channel === 'email' && <Typography fontWeight={600}>{preview.subject}</Typography>}
            {channel === 'email' && preview.html ? <Box component="iframe" title="Notification email preview" sandbox="" srcDoc={preview.html} sx={{ width: '100%', height: 480, border: 0, bgcolor: '#fff' }} />
              : <Box sx={{ whiteSpace: 'pre-wrap', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>{preview.text}</Box>}
          </>}
        </DialogContent>
        <DialogActions><Button disabled={busy && dialog === 'test'} onClick={close}>Close</Button>{dialog === 'test' && <Button variant="contained" disabled={busy || !recipient.trim()} onClick={sendTest}>Send test message</Button>}</DialogActions>
      </Dialog>
    </Box>
  );
}
