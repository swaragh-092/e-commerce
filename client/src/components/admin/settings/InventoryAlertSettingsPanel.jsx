import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  getInventoryAlertConfig,
  saveInventoryAlertConfig,
  testInventoryAlertEmail,
} from '../../../services/adminService';
import { useNotification } from '../../../context/NotificationContext';
import { useAuth } from '../../../hooks/useAuth';
import { PERMISSIONS } from '../../../utils/permissions';

const InventoryAlertSettingsPanel = () => {
  const { notify } = useNotification();
  const { hasAnyPermission } = useAuth();
  const canManage = hasAnyPermission([PERMISSIONS.NOTIFICATIONS_MANAGE]);
  const [config, setConfig] = useState(null);
  const [eligibleRecipients, setEligibleRecipients] = useState([]);
  const [fallbackRecipients, setFallbackRecipients] = useState([]);
  const [usingFallback, setUsingFallback] = useState(false);
  const [hasEmailDeliveryConfigured, setHasEmailDeliveryConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const applyPayload = (payload) => {
    setConfig(payload.config);
    setEligibleRecipients(payload.eligibleRecipients || []);
    setFallbackRecipients(payload.fallbackRecipients || []);
    setUsingFallback(Boolean(payload.usingFallback));
    setHasEmailDeliveryConfigured(Boolean(payload.hasEmailDeliveryConfigured));
  };

  useEffect(() => {
    let active = true;
    getInventoryAlertConfig()
      .then((response) => { if (active) applyPayload(response.data.data); })
      .catch((error) => {
        if (active) setLoadError(error.response?.data?.error?.message || 'Unable to load inventory alert settings.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateConfig = (key, value) => setConfig((current) => ({ ...current, [key]: value }));

  const toggleRecipient = (userId, checked) => {
    setConfig((current) => ({
      ...current,
      recipientUserIds: checked
        ? [...new Set([...current.recipientUserIds, userId])]
        : current.recipientUserIds.filter((id) => id !== userId),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await saveInventoryAlertConfig(config);
      applyPayload(response.data.data);
      notify('Inventory alert routing saved.', 'success');
    } catch (error) {
      notify(error.response?.data?.error?.message || 'Unable to save inventory alert routing.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await testInventoryAlertEmail();
      const delivered = Boolean(response.data.data?.delivered);
      notify(delivered ? 'Test inventory email sent to your account.' : 'Email delivery failed. Check SMTP configuration.', delivered ? 'success' : 'error');
    } catch (error) {
      notify(error.response?.data?.error?.message || 'Unable to send a test inventory email.', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>;
  if (loadError) return <Alert severity="error">{loadError}</Alert>;
  if (!config) return null;

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Inventory alert routing</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Route low-stock digests and urgent stockout emails to active, verified staff who can read and update products. Customers are never recipients.
      </Typography>
      {!hasEmailDeliveryConfigured && <Alert severity="warning" sx={{ mb: 2 }}>SMTP credentials are not configured. Alert emails and test delivery will not work until email is enabled.</Alert>}
      {usingFallback && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No eligible recipients are selected. Alerts currently fall back to: {fallbackRecipients.map((user) => user.name).join(', ') || 'no eligible super-admin account'}.
        </Alert>
      )}

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Email recipients</Typography>
      <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mb: 2 }}>
        {eligibleRecipients.map((user) => (
          <FormControlLabel
            key={user.id}
            disabled={!canManage}
            control={<Checkbox checked={config.recipientUserIds.includes(user.id)} onChange={(event) => toggleRecipient(user.id, event.target.checked)} />}
            label={<Box><Typography variant="body2">{user.name}</Typography><Typography variant="caption" color="text.secondary">{user.roles.join(', ') || 'Staff'} · {user.email}</Typography></Box>}
            sx={{ alignItems: 'flex-start', mr: 1 }}
          />
        ))}
        {!eligibleRecipients.length && <Typography variant="body2" color="text.secondary">No active, verified staff currently have both required product permissions.</Typography>}
      </FormGroup>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 2 }}>
        <TextField label="Timezone" size="small" value={config.timezone} disabled={!canManage} onChange={(event) => updateConfig('timezone', event.target.value)} helperText="Use an IANA name, e.g. Asia/Kolkata" />
        <TextField select label="Daily digest time" size="small" value={config.digestHour} disabled={!canManage} onChange={(event) => updateConfig('digestHour', Number(event.target.value))}>
          {Array.from({ length: 24 }, (_, hour) => <MenuItem key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</MenuItem>)}
        </TextField>
        <TextField type="number" label="Reminder interval (days)" size="small" inputProps={{ min: 1, max: 30 }} value={config.reminderIntervalDays} disabled={!canManage} onChange={(event) => updateConfig('reminderIntervalDays', Number(event.target.value))} />
      </Box>

      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <FormControlLabel disabled={!canManage} control={<Switch checked={config.immediateOutOfStock} onChange={(event) => updateConfig('immediateOutOfStock', event.target.checked)} />} label="Send an immediate email when an item becomes out of stock" />
        <FormControlLabel disabled={!canManage} control={<Switch checked={config.includeEnvironmentRecipients} onChange={(event) => updateConfig('includeEnvironmentRecipients', event.target.checked)} />} label="Also include the configured ADMIN_NOTIFICATION_EMAIL address" />
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={handleTest} disabled={testing || !canManage}>{testing ? 'Sending…' : 'Send test email to me'}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !canManage}>{saving ? 'Saving…' : 'Save alert routing'}</Button>
      </Stack>
    </Box>
  );
};

export default InventoryAlertSettingsPanel;
