import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControl, FormControlLabel,
  InputLabel, MenuItem, Paper, Select, Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import MailOutline from '@mui/icons-material/MailOutline';
import { Link } from 'react-router-dom';
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
  const [section, setSection] = useState('routing');
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
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>{rule.config.name}</Typography>
          <Typography variant="body2" color="text.secondary">{event.label}</Typography>
        </Box>
        <Chip size="small" label={rule.config.enabled ? 'Active' : 'Paused'} color={rule.config.enabled ? 'success' : 'default'} variant="outlined" />
      </Stack>
      <Tabs value={section} onChange={(_, value) => {
        setSection(value);
        if (value === 'activity' && !history && !busy) run(loadHistory);
      }} aria-label="Rule editor sections" variant="scrollable" scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
        <Tab value="routing" label="Routing" id="alert-rule-routing" aria-controls="alert-panel-routing" />
        <Tab value="message" label="Message" id="alert-rule-message" aria-controls="alert-panel-message" />
        {data.manage && <Tab value="activity" label="History & access" id="alert-rule-activity" aria-controls="alert-panel-activity" />}
      </Tabs>
      {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
      {section === 'routing' && <Stack spacing={2} role="tabpanel" id="alert-panel-routing" aria-labelledby="alert-rule-routing">
        <TextField label="Rule name" size="small" value={draft.name} disabled={!canEdit('name')} onChange={e => change('name', e.target.value)} />
        <Typography component="h4" variant="subtitle2">Conditions</Typography>
        {event.fields.map(field => <TextField key={field} label={`Match ${field.replaceAll('_', ' ')}`} size="small" value={draft.conditions[field] || ''}
          helperText="Leave empty to accept any value" disabled={!canEdit('conditions')} onChange={e => {
            const conditions = { ...draft.conditions };
            if (e.target.value) conditions[field] = e.target.value; else delete conditions[field];
            change('conditions', conditions);
          }} />)}
        <Typography component="h4" variant="subtitle2">Recipients</Typography>
        <MultiSelect label="Recipients" options={recipientOptions} values={draft.audience} disabled={!canEdit('audience')} onChange={value => change('audience', value)} />
        <Typography component="h4" variant="subtitle2">Delivery</Typography>
        <MultiSelect label="Channels" options={channelOptions} values={draft.channels} disabled={!canEdit('channels')} onChange={value => change('channels', value)} />
        <Box>
          {[['enabled', 'Enabled'], ['inAppDefault', 'Default inbox delivery'], ['emailDefault', 'Default email delivery'], ['urgent', 'Urgent email'], ['required', 'Require inbox delivery']].map(([field, label]) =>
            <FormControlLabel key={field} label={label} control={<Checkbox checked={draft[field]} disabled={!canEdit(field)} onChange={e => change(field, e.target.checked)} />} />)}
        </Box>
      </Stack>}
      {section === 'message' && <Stack spacing={2} role="tabpanel" id="alert-panel-message" aria-labelledby="alert-rule-message">
        <TextField select size="small" label="Insert variable into" value={messageField} onChange={e => setMessageField(e.target.value)}>
          {messageFields.map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
        </TextField>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {event.fields.map(field => <Chip key={field} label={field} disabled={!canEdit(messageField)} onClick={() => change(messageField, draft[messageField] + '{{' + field + '}}')} />)}
        </Stack>
        {messageFields.map(([field, label]) => <TextField key={field} label={label} size="small" multiline={['body', 'summary'].includes(field)} value={draft[field]}
          disabled={!canEdit(field)} onChange={e => change(field, e.target.value)} />)}
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button disabled={busy} onClick={() => run(() => api.preview(rule.id, draft).then(setPreview))}>Preview</Button>
          <Button disabled={busy} onClick={() => run(async () => { await api.test(rule.id, draft, 'in_app'); refreshAdminAlerts(); }, 'Test sent to your inbox.')}>Test inbox</Button>
          <Button disabled={busy || !data.emailEnabled || data.emailPaused} onClick={() => run(() => api.test(rule.id, draft, 'email'), 'Test email queued for your verified address.')}>Test email</Button>
        </Stack>
        {preview && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2">Inbox preview</Typography><Typography>{preview.title}</Typography><Typography>{preview.body}</Typography>
          <Typography color="primary">{preview.linkLabel}</Typography>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>Email preview</Typography><Typography>{preview.subject}</Typography><Typography>{preview.summary}</Typography>
        </Paper>}
      </Stack>}
      {section === 'activity' && data.manage && <Stack spacing={2} role="tabpanel" id="alert-panel-activity" aria-labelledby="alert-rule-activity">
        {!history && (busy
          ? <CircularProgress size={24} aria-label="Loading history and staff access" />
          : <Button variant="outlined" sx={{ alignSelf: 'start' }} onClick={() => run(loadHistory)}>Load history and staff access</Button>)}
        {history && <>
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
        </>}
      </Stack>}
      <Divider />
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" disabled={busy || JSON.stringify(draft) === JSON.stringify(rule.config)} onClick={() => run(async () => { await api.publish(rule, draft); await reload(); })}>Publish rule</Button>
      </Stack>
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
  return <Stack spacing={3}>
    {error && <Alert severity="error">{error}</Alert>}
    {data.manage && !assigned && <Paper component="section" variant="outlined" aria-labelledby="alert-delivery-heading" sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography id="alert-delivery-heading" component="h2" variant="h6">Delivery channels</Typography>
      </Box>
      <Stack divider={<Divider />} sx={{ px: { xs: 2, sm: 3 } }}>
        <Stack direction="row" gap={1.5} alignItems="center" sx={{ py: 2 }}>
          <NotificationsOutlined aria-hidden="true" color="action" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2">Admin inbox</Typography>
            <Typography variant="body2" color="text.secondary">Show the notification bell and deliver alerts in the admin panel.</Typography>
          </Box>
          <Switch checked={Boolean(data.inboxEnabled)} disabled={creating}
            inputProps={{ role: 'switch', 'aria-label': 'Enable admin notification inbox' }}
            onChange={(_, enabled) => toggleInbox(enabled)} />
        </Stack>
        <Stack direction="row" gap={1.5} alignItems="center" sx={{ py: 2, flexWrap: 'wrap' }}>
          <MailOutline aria-hidden="true" color="action" />
          <Box sx={{ flex: '1 1 180px' }}>
            <Typography variant="subtitle2">Internal email</Typography>
            <Typography variant="body2" color="text.secondary">
              {!data.emailEnabled ? 'Internal email is off.' : data.emailPaused ? 'Internal email is paused.' : 'Sends matching alerts to verified staff addresses.'}
            </Typography>
          </Box>
          <Chip size="small" variant="outlined" label={!data.emailEnabled ? 'Off' : data.emailPaused ? 'Paused' : 'On'} />
          {data.emailEnabled && data.inboxAvailable && <Button size="small" onClick={toggleEmail} disabled={creating}>{data.emailPaused ? 'Resume email' : 'Pause email'}</Button>}
        </Stack>
      </Stack>
    </Paper>}
    {data.inboxAvailable === false && <Typography variant="body2" color="text.secondary">
      {data.inboxEnabled ? 'Your account is outside the inbox pilot.' : 'Enable the admin inbox to configure notification rules.'}
    </Typography>}
    {data.inboxAvailable !== false && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(235px, 280px) minmax(0, 1fr)' }, alignItems: 'start', gap: 2 }}>
      <Paper component="section" variant="outlined" aria-labelledby="alert-rules-heading" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography id="alert-rules-heading" component="h2" variant="subtitle1" fontWeight={600}>Rules</Typography>
          {data.manage && !assigned && <>
            <TextField select size="small" label="Event" value={filter} onChange={e => setFilter(e.target.value)}>
              <MenuItem value="">All events</MenuItem>
              {Object.entries(data.events).map(([key, event]) => <MenuItem key={key} value={key}>{event.label}</MenuItem>)}
            </TextField>
            <Button variant="outlined" onClick={create} disabled={!filter || creating}>Add rule</Button>
            {!filter && <Typography variant="caption" color="text.secondary">Choose an event to add a rule.</Typography>}
          </>}
          {rule && <TextField select fullWidth size="small" label="Rule" value={rule.id} onChange={e => select(e.target.value)}>
            {shown.map(item => <MenuItem key={item.id} value={item.id}>{item.config.name} · {item.config.enabled ? 'Active' : 'Paused'}</MenuItem>)}
          </TextField>}
          {!assigned && <Button component={Link} to="/admin/notifications" sx={{ alignSelf: 'start' }}>Open inbox</Button>}
        </Stack>
      </Paper>
      {rule ? <RuleDetails key={rule.id + ':' + rule.version} rule={rule} data={data} reload={reload} />
        : <Box sx={{ p: 3 }}><Typography variant="subtitle1" fontWeight={600}>No rules to display</Typography>
          <Typography variant="body2" color="text.secondary">{assigned ? 'Rules assigned to you will appear here.' : 'Choose another event or add a rule for this event.'}</Typography></Box>}
    </Box>}
  </Stack>;
}
