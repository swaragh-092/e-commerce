import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { sendTestNotification } from '../../../services/adminService';
import { useNotification } from '../../../context/NotificationContext';

const MessagingSettingsPanel = ({ form, set }) => {
  const { notify } = useNotification();
  const [testRecipients, setTestRecipients] = useState({
    email: '',
    sms: '',
    whatsapp: '',
  });
  const [testing, setTesting] = useState({
    email: false,
    sms: false,
    whatsapp: false,
  });

  const handleTest = async (channel) => {
    const recipient = testRecipients[channel];
    if (!recipient) {
      notify(`Please enter a recipient for ${channel} test`, 'error');
      return;
    }

    setTesting((p) => ({ ...p, [channel]: true }));
    try {
      await sendTestNotification('test_notification', recipient, channel);
      notify(`Test ${channel} sent to ${recipient}`, 'success');
    } catch (e) {
      notify(`Failed to send test ${channel}. Check your configuration.`, 'error');
    } finally {
      setTesting((p) => ({ ...p, [channel]: false }));
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure the messaging channels used by the notification system. 
        Changes made here require saving the overall settings.
      </Typography>

      {/* Email Section */}
      <Accordion defaultExpanded variant="outlined" sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700}>Email (SMTP)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={form['messaging.emailEnabled'] !== false && form['messaging.emailEnabled'] !== 'false'}
                onChange={(e) => set('messaging.emailEnabled', e.target.checked)}
              />
            }
            label="Enable Email Notifications"
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            SMTP is configured via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              label="Test Email Address"
              value={testRecipients.email}
              onChange={(e) => setTestRecipients((p) => ({ ...p, email: e.target.value }))}
              placeholder="you@example.com"
              sx={{ flex: 1, maxWidth: 300 }}
            />
            <Button
              variant="outlined"
              onClick={() => handleTest('email')}
              disabled={testing.email || !testRecipients.email}
            >
              {testing.email ? 'Sending...' : 'Test Email'}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* SMS Section */}
      <Accordion variant="outlined" sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700}>SMS (Twilio)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form['messaging.smsEnabled']) && form['messaging.smsEnabled'] !== 'false'}
                onChange={(e) => set('messaging.smsEnabled', e.target.checked)}
              />
            }
            label="Enable SMS Notifications"
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Twilio API credentials. These are securely stored server-side.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Twilio Account SID"
            type="password"
            value={form['messaging_credentials.twilio_sid'] || ''}
            onChange={(e) => set('messaging_credentials.twilio_sid', e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Twilio Auth Token"
            type="password"
            value={form['messaging_credentials.twilio_token'] || ''}
            onChange={(e) => set('messaging_credentials.twilio_token', e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Twilio From Number"
            placeholder="+1234567890"
            value={form['messaging_credentials.twilio_from_number'] || ''}
            onChange={(e) => set('messaging_credentials.twilio_from_number', e.target.value)}
            sx={{ mb: 2 }}
          />
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              label="Test Phone Number"
              value={testRecipients.sms}
              onChange={(e) => setTestRecipients((p) => ({ ...p, sms: e.target.value }))}
              placeholder="+1234567890"
              sx={{ flex: 1, maxWidth: 300 }}
            />
            <Button
              variant="outlined"
              onClick={() => handleTest('sms')}
              disabled={testing.sms || !testRecipients.sms}
            >
              {testing.sms ? 'Sending...' : 'Test SMS'}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* WhatsApp Section */}
      <Accordion variant="outlined" sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700}>WhatsApp (Twilio)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form['messaging.whatsappEnabled']) && form['messaging.whatsappEnabled'] !== 'false'}
                onChange={(e) => set('messaging.whatsappEnabled', e.target.checked)}
              />
            }
            label="Enable WhatsApp Notifications"
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Uses the same Twilio API credentials as SMS, but requires a specific WhatsApp sender number.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Twilio WhatsApp Sender"
            placeholder="whatsapp:+14155238886"
            value={form['messaging_credentials.twilio_whatsapp_from'] || ''}
            onChange={(e) => set('messaging_credentials.twilio_whatsapp_from', e.target.value)}
            sx={{ mb: 2 }}
          />
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              label="Test WhatsApp Number"
              value={testRecipients.whatsapp}
              onChange={(e) => setTestRecipients((p) => ({ ...p, whatsapp: e.target.value }))}
              placeholder="whatsapp:+1234567890"
              sx={{ flex: 1, maxWidth: 300 }}
            />
            <Button
              variant="outlined"
              onClick={() => handleTest('whatsapp')}
              disabled={testing.whatsapp || !testRecipients.whatsapp}
            >
              {testing.whatsapp ? 'Sending...' : 'Test WhatsApp'}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default MessagingSettingsPanel;
