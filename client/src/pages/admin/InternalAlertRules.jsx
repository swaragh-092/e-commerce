import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControl, FormControlLabel,
  InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { adminAlerts as api, refreshAdminAlerts } from '../../services/adminAlerts';
import { getApiErrorMessage } from '../../utils/apiErrors';

const channelOptions = [['in_app', 'Inbox'], ['email', 'Email']];
const messageFields = [['title', 'Inbox title'], ['body', 'Inbox message'], ['subject', 'Email subject'], ['summary', 'Email summary'], ['linkLabel', 'Inbox link label']];
const friendlyField = key => Object.fromEntries(messageFields)[key] || ({
  name: 'Rule name', enabled: 'Enabled', conditions: 'Conditions', audience: 'Recipients',
  channels: 'Channels', inAppDefault: 'Default inbox delivery', emailDefault: 'Default email delivery', urgent: 'Urgent',
})[key] || key;

function MultiSelect({ label, options, values, onChange, disabled }) {
  const labelId = label.toLowerCase().replaceAll(' ', '-');
  const choices = new Map(options);
  values.forEach(value => { if (!choices.has(value)) choices.set(value, value); });
  return <FormControl size="small" disabled={disabled} fullWidth>
    <InputLabel id={labelId}>{label}</InputLabel>
    <Select multiple value={values} label={label} labelId={labelId} onChange={event => onChange(event.target.value)}
      renderValue={selected => selected.map(value => choices.get(value)).join(', ')}>
      {[...choices].map(([key, name]) => <MenuItem key={key} value={key}>
        <Checkbox checked={values.includes(key)} />{name}
      </MenuItem>)}
    </Select>
  </FormControl>;
}

function RuleDetails({ rule, data, reload }) {
  const [draft, setDraft] = useState(rule.config);
  const [messageField, setMessageField] = useState('body');
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState(null);
  const [staff, setStaff] = useState('');
  const [fields, setFields] = useState([]);
  const [audience, setAudience] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const event = data.events[rule.event];
  const canEdit = field => data.manage || rule.allowed_fields?.includes(field);
  const change = (field, value) => {
    setDraft(current => ({ ...current, [field]: value }));
    setPreview(null);
    setNotice(null);
  };
  const recipients = [
    ...event.audience.map(key => [key, ({
      participant: 'Event participant / assignee', staff_admins: 'Staff access administrators', store_admins: 'Store administrators',
    })[key]]),
    ...data.staff.map(person => ['user:' + person.id, person.label]),
    ...data.roles.map(role => ['role:' + role, 'Role: ' + role]),
  ];
  const recipientOptions = data.manage ? recipients : (rule.allowed_audience || []).map(key => [key, new Map(recipients).get(key) || key]);
  const run = async (action, success) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (success) setNotice({ severity: 'success', text: success });
    } catch (error) {
      setNotice({ severity: 'error', text: getApiErrorMessage(error, 'Unable to complete this action.') });
    } finally { setBusy(false); }
  };
  const loadHistory = () => api.history(rule.id).then(setHistory);
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
    <Stack spacing={2}>
      {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
      <Typography variant="subtitle2">Event</Typography>
      <Typography>{event.label}</Typography>
      <TextField label="Rule name" size="small" value={draft.name} disabled={!canEdit('name')} onChange={e => change('name', e.target.value)} />
      <Typography variant="subtitle2">Conditions</Typography>
      {event.fields.map(field => <TextField key={field} label={`Match ${field}`} size="small" value={draft.conditions[field] || ''}
        helperText="Leave empty to accept any value" disabled={!canEdit('conditions')} onChange={e => {
          const conditions = { ...draft.conditions };
          if (e.target.value) conditions[field] = e.target.value; else delete conditions[field];
          change('conditions', conditions);
        }} />)}
      <Typography variant="subtitle2">Recipients</Typography>
      <MultiSelect label="Recipients" options={recipientOptions} values={draft.audience} disabled={!canEdit('audience')} onChange={value => change('audience', value)} />
      <Typography variant="subtitle2">Delivery</Typography>
      <MultiSelect label="Channels" options={channelOptions} values={draft.channels} disabled={!canEdit('channels')} onChange={value => change('channels', value)} />
      <Box>
        {[['enabled', 'Enabled'], ['inAppDefault', 'Default inbox delivery'], ['emailDefault', 'Default email delivery'], ['urgent', 'Urgent email'], ['required', 'Require inbox delivery']].map(([field, label]) =>
          <FormControlLabel key={field} label={label} control={<Checkbox checked={draft[field]} disabled={!canEdit(field)} onChange={e => change(field, e.target.checked)} />} />)}
      </Box>
      <Typography variant="subtitle2">Message</Typography>
      <TextField select size="small" label="Insert variable into" value={messageField} onChange={e => setMessageField(e.target.value)}>
        {messageFields.map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
      </TextField>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {event.fields.map(field => <Chip key={field} label={field} disabled={!canEdit(messageField)} onClick={() => change(messageField, draft[messageField] + '{{' + field + '}}')} />)}
      </Stack>
      {messageFields.map(([field, label]) => <TextField key={field} label={label} size="small" multiline={['body', 'summary'].includes(field)} value={draft[field]}
        disabled={!canEdit(field)} onChange={e => change(field, e.target.value)} />)}
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button variant="contained" disabled={busy} onClick={() => run(async () => { await api.publish(rule, draft); await reload(); })}>Publish rule</Button>
        <Button disabled={busy} onClick={() => run(() => api.preview(rule.id, draft).then(setPreview))}>Preview</Button>
        <Button disabled={busy} onClick={() => run(async () => { await api.test(rule.id, draft, 'in_app'); refreshAdminAlerts(); }, 'Test sent to your inbox.')}>Test inbox</Button>
        <Button disabled={busy || !data.emailEnabled || data.emailPaused} onClick={() => run(() => api.test(rule.id, draft, 'email'), 'Test email queued for your verified address.')}>Test email</Button>
        {data.manage && <Button disabled={busy} onClick={() => run(loadHistory)}>History and delegation</Button>}
      </Stack>
      {preview && <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2">Inbox preview</Typography><Typography>{preview.title}</Typography><Typography>{preview.body}</Typography>
        <Typography color="primary">{preview.linkLabel}</Typography>
        <Typography variant="subtitle2" sx={{ mt: 2 }}>Email preview</Typography><Typography>{preview.subject}</Typography><Typography>{preview.summary}</Typography>
      </Paper>}
      {history && data.manage && <Stack spacing={2}>
        <Typography variant="subtitle2">Staff delegation</Typography>
        <TextField select size="small" label="Staff member" value={staff} onChange={e => {
          const user = e.target.value;
          const grant = history.delegations.find(item => item.user_id === user);
          setStaff(user); setFields(grant?.fields || []); setAudience(grant?.audience || []);
        }}>
          {data.staff.map(person => <MenuItem key={person.id} value={person.id}>{person.label}</MenuItem>)}
        </TextField>
        <MultiSelect label="Editable fields" options={data.fields.map(key => [key, friendlyField(key)])} values={fields} onChange={setFields} />
        <MultiSelect label="Permitted recipients" options={recipients} values={audience} onChange={setAudience} />
        <Button disabled={busy || !staff || !fields.length} onClick={() => run(async () => { await api.grant(rule.id, staff, fields, audience); await loadHistory(); }, 'Delegation saved.')}>Save delegation</Button>
        {history.delegations.map(grant => <Stack key={grant.user_id} direction="row" alignItems="center" justifyContent="space-between">
          <Typography>{data.staff.find(person => person.id === grant.user_id)?.label || grant.user_id} · {grant.fields.map(friendlyField).join(', ')}</Typography>
          <Button disabled={busy} onClick={() => run(async () => { await api.revoke(rule.id, grant.user_id); await loadHistory(); }, 'Delegation revoked.')}>Revoke</Button>
        </Stack>)}
        <Typography variant="subtitle2">Rule versions</Typography>
        {history.versions.map(version => <Stack key={version.version} direction="row" alignItems="center" justifyContent="space-between">
          <Typography>Version {version.version} · {version.config.name} · {version.config.enabled ? 'Enabled' : 'Paused'} · {new Date(version.created_at).toLocaleString()} · {data.staff.find(person => person.id === version.editor_id)?.label || (version.editor_id ? 'Former staff member' : 'System')}</Typography>
          <Button disabled={busy || version.version === rule.version} onClick={() => run(async () => { await api.restore(rule, version.version); await reload(); })}>Restore</Button>
        </Stack>)}
        <Typography variant="subtitle2">Email delivery</Typography>
        <Typography variant="body2">Pending events: {history.pending.count}{history.pending.oldest && ` · Oldest: ${new Date(history.pending.oldest).toLocaleString()}`}</Typography>
        {history.deliveries.map(delivery => <Typography key={delivery.id} variant="body2">
          {data.staff.find(person => person.id === delivery.user_id)?.label || 'Staff member'} · {delivery.status} · {delivery.attempts} attempts
          {delivery.error && ' · ' + delivery.error}
        </Typography>)}
      </Stack>}
    </Stack>
  </Paper>;
}

export default function InternalAlertRules({ assigned = false }) {
  const [data, setData] = useState(null);
  const [selected, select] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const reload = async () => setData(await api.rules());
  useEffect(() => {
    reload().catch(error => setError(error.response?.status === 404
      ? 'Internal alerts are unavailable.' : getApiErrorMessage(error, 'Could not load internal rules.')));
  }, []);
  if (!data) return error ? <Alert severity="info">{error}</Alert> : <CircularProgress aria-label="Loading internal rules" />;
  const shown = data.rules.filter(item => !filter || item.event === filter);
  const rule = shown.find(item => item.id === selected) || shown[0];
  const toggleInbox = async enabled => {
    setCreating(true);
    setError('');
    try {
      await api.setInboxEnabled(enabled);
      refreshAdminAlerts();
      await reload();
    } catch (error) { setError(getApiErrorMessage(error, 'Could not update the notification inbox.')); }
    finally { setCreating(false); }
  };
  const toggleEmail = async () => {
    setCreating(true);
    setError('');
    try { await api.pauseEmail(!data.emailPaused); await reload(); }
    catch (error) { setError(getApiErrorMessage(error, 'Could not update email delivery.')); }
    finally { setCreating(false); }
  };
  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const event = data.events[filter];
      const created = await api.create(filter, {
        name: event.label + ' rule', enabled: false, audience: event.defaultAudience || event.audience, conditions: {}, channels: ['in_app'],
        required: false, urgent: false, inAppDefault: true, emailDefault: false, title: event.label, body: event.label, subject: event.label,
        summary: event.label, linkLabel: 'Open admin panel',
      });
      await reload(); select(created.id);
    } catch (error) { setError(getApiErrorMessage(error, 'Could not create the rule.')); }
    finally { setCreating(false); }
  };
  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    {data.manage && !assigned && <FormControlLabel
      label="Enable admin notification inbox"
      control={<Switch inputProps={{ role: 'switch' }} checked={data.inboxEnabled} disabled={creating} onChange={(_, enabled) => toggleInbox(enabled)} />}
    />}
    {data.inboxAvailable === false && <Alert severity="info">
      {data.inboxEnabled ? 'Your account is outside the inbox pilot.' : 'Turn on the inbox to show the notification bell and configure internal alerts.'}
    </Alert>}
    {data.inboxAvailable !== false && data.manage && !assigned && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField select size="small" label="Event" value={filter} onChange={e => setFilter(e.target.value)} sx={{ minWidth: 245 }}>
        <MenuItem value="">All events</MenuItem>
        {Object.entries(data.events).map(([key, event]) => <MenuItem key={key} value={key}>{event.label}</MenuItem>)}
      </TextField>
      <Button onClick={create} disabled={!filter || creating}>Add rule</Button>
      <Button onClick={toggleEmail} disabled={creating || !data.emailEnabled}>{!data.emailEnabled ? 'Internal email is off' : data.emailPaused ? 'Resume internal email' : 'Pause internal email'}</Button>
    </Stack>}
    {data.inboxAvailable !== false && (rule ? <>
      <TextField select size="small" label="Rule" value={rule.id} onChange={e => select(e.target.value)}>
        {shown.map(item => <MenuItem key={item.id} value={item.id}>{item.config.name} · {item.config.enabled ? 'Enabled' : 'Paused'}</MenuItem>)}
      </TextField>
      <RuleDetails key={rule.id + ':' + rule.version} rule={rule} data={data} reload={reload} />
    </> : <Typography color="text.secondary">No notification rules available.</Typography>)}
  </Stack>;
}
