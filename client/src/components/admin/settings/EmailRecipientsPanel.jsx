import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, CircularProgress, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import api from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { PERMISSIONS } from '../../../utils/permissions';
import { getApiErrorMessage } from '../../../utils/apiErrors';

export default function EmailRecipientsPanel() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.NOTIFICATIONS_MANAGE);
  const [data, setData] = useState(null);
  const [selection, setSelection] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const load = () => api.get('/notifications/recipients').then((response) => {
    const result = response.data.data;
    setData(result);
    setSelection(Object.fromEntries(result.categories.map((category) => [category.key, category.recipientUserIds])));
    setStatus(null);
  }).catch((error) => setStatus({ type: 'error', message: getApiErrorMessage(error, 'Could not load email recipients.') }));

  useEffect(() => {
    let active = true;
    api.get('/notifications/recipients').then((response) => {
      if (!active) return;
      const result = response.data.data;
      setData(result);
      setSelection(Object.fromEntries(result.categories.map((category) => [category.key, category.recipientUserIds])));
    }).catch((error) => {
      if (active) setStatus({ type: 'error', message: getApiErrorMessage(error, 'Could not load email recipients.') });
    });
    return () => { active = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const response = await api.put('/notifications/recipients', selection);
      setData(response.data.data);
      setStatus({ type: 'success', message: 'Email recipients saved.' });
    } catch (error) {
      setStatus({ type: 'error', message: getApiErrorMessage(error, 'Could not save email recipients.') });
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>Admin and staff email recipients</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose recipients for each alert. Selected staff must have active accounts, verified emails, and the required permissions. Inventory alerts have their own recipient settings.
      </Typography>
      {status && <Alert severity={status.type} sx={{ mb: 2 }}>{status.message}</Alert>}
      {!data && !status && <CircularProgress size={24} aria-label="Loading email recipients" />}
      {!data && status && <Button onClick={load}>Retry</Button>}
      {data?.categories.map((category) => {
        const options = data.users.filter((user) => user.categories.includes(category.key));
        const ids = selection[category.key];
        const useDefaults = !Array.isArray(ids);
        const unavailableIds = Array.isArray(ids) ? ids.filter((id) => !options.some((user) => user.id === id)) : [];
        return (
          <Box key={category.key} sx={{ mb: 3 }}>
            <Typography fontWeight={600}>{category.label}</Typography>
            <FormControlLabel
              control={<Switch checked={useDefaults} disabled={!canEdit || saving} onChange={(event) => setSelection((previous) => ({ ...previous, [category.key]: event.target.checked ? null : [] }))} />}
              label="Use default admin recipients"
            />
            {!useDefaults && <Autocomplete
              multiple options={options} disabled={!canEdit || saving}
              value={options.filter((user) => ids.includes(user.id))}
              getOptionLabel={(user) => `${user.name} (${user.email})`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, users) => setSelection((previous) => ({ ...previous, [category.key]: users.map((user) => user.id) }))}
              renderInput={(params) => <TextField {...params} label={`${category.label} recipients`} helperText={unavailableIds.length ? 'Some saved recipients are no longer eligible. Select recipients again before saving.' : 'No recipients selected means these alerts are disabled.'} />}
            />}
          </Box>
        );
      })}
      {data && canEdit && <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save email recipients'}</Button>}
    </Box>
  );
}
