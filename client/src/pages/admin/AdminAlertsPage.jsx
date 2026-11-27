import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel,
  MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { adminAlerts as api, refreshAdminAlerts } from '../../services/adminAlerts';
import { getApiErrorMessage } from '../../utils/apiErrors';
import InternalAlertRules from './InternalAlertRules';

const preferencesPath = '/admin/notifications/preferences';
const inboxPath = '/admin/notifications';

function Inbox() {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.inbox(unread, 30, page * 30, controller.signal).then(setState).catch(error => {
      if (!controller.signal.aborted) setError(getApiErrorMessage(error, 'Could not load inbox.'));
    });
    return () => controller.abort();
  }, [unread, page, revision]);
  const update = async action => {
    setBusy(true);
    setError('');
    try {
      await action();
      setPage(0);
      setRevision(value => value + 1);
      refreshAdminAlerts();
    } catch (error) { setError(getApiErrorMessage(error, 'Could not update inbox.')); }
    finally { setBusy(false); }
  };
  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    {!state && !error && <CircularProgress aria-label="Loading inbox" />}
    {state && !state.enabled && <Alert severity="info">The notification inbox is unavailable.</Alert>}
    {state?.enabled && <>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button variant={unread ? 'text' : 'contained'} onClick={() => { setUnread(false); setPage(0); }}>All</Button>
        <Button variant={unread ? 'contained' : 'text'} onClick={() => { setUnread(true); setPage(0); }}>Unread ({state.unread})</Button>
        <Button disabled={!state.unread || busy} onClick={() => update(api.markAll)}>Mark all as read</Button>
      </Stack>
      {!state.items.length && <Typography color="text.secondary">No {unread ? 'unread ' : ''}notifications.</Typography>}
      {state.items.map(item => <Paper variant="outlined" key={item.id} sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={item.read_at ? 400 : 700}>{item.message.title}</Typography>
        <Typography variant="body2">{item.message.body}</Typography>
        <Typography variant="caption" color="text.secondary">{new Date(item.created_at).toLocaleString()}</Typography>
        <Box>
          <Button component={Link} to={item.message.link}>{item.message.linkLabel}</Button>
          <Button disabled={busy} onClick={() => update(() => api.mark(item.id, !item.read_at))}>Mark as {item.read_at ? 'unread' : 'read'}</Button>
        </Box>
      </Paper>)}
      {state.total > 30 && <Stack direction="row" spacing={1}>
        <Button disabled={!page} onClick={() => setPage(value => value - 1)}>Previous</Button>
        <Button disabled={(page + 1) * 30 >= state.total} onClick={() => setPage(value => value + 1)}>Next</Button>
      </Stack>}
    </>}
  </Stack>;
}

function Preferences() {
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const data = await api.preferences();
    setState(data);
    setDraft(data.preferences);
  };
  useEffect(() => {
    load().catch(error => setError(getApiErrorMessage(error, 'Could not load preferences.')));
  }, []);
  const updateChoice = (event, channel, value) => {
    const choices = { ...draft.events[event] };
    if (value === '') delete choices[channel]; else choices[channel] = value === 'on';
    setDraft({ ...draft, events: { ...draft.events, [event]: choices } });
    setSaved(false);
  };
  const save = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await api.savePreferences(draft); await load(); setSaved(true); }
    catch (error) { setError(getApiErrorMessage(error, 'Could not save preferences.')); }
    finally { setBusy(false); }
  };
  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success">Preferences saved.</Alert>}
    {!draft && !error && <CircularProgress aria-label="Loading preferences" />}
    {draft && <Stack component="form" onSubmit={save} spacing={2}>
      {(!state.canEmail || state.emailPaused) && <Alert severity="info">{!state.canEmail ? 'Verify your email address to receive alerts by email.' : 'Internal email delivery is currently unavailable.'}</Alert>}
      {state.events.map(event => <Paper variant="outlined" key={event.key} sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>{event.label}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {[['in_app', 'Inbox'], ['email', 'Email']].map(([channel, label]) => {
            const locked = channel === 'in_app' && event.required;
            const value = draft.events[event.key]?.[channel];
            return <TextField select key={channel} size="small" label={label} sx={{ minWidth: 160 }}
              disabled={locked || (channel === 'email' && !state.canEmail)} value={locked ? 'on' : value === undefined ? '' : value ? 'on' : 'off'}
              helperText={locked ? 'Required by a notification rule' : `Current routing policy: ${event[channel] ? 'on' : 'off'}`}
              onChange={change => updateChoice(event.key, channel, change.target.value)}>
              <MenuItem value="">Store default</MenuItem><MenuItem value="on">On</MenuItem><MenuItem value="off">Off</MenuItem>
            </TextField>;
          })}
        </Stack>
      </Paper>)}
      <FormControlLabel label="Email quiet hours" control={<Checkbox checked={Boolean(draft.quiet)} onChange={event => {
        setSaved(false);
        setDraft({ ...draft, quiet: event.target.checked ? { start: '22:00', end: '07:00', zone: Intl.DateTimeFormat().resolvedOptions().timeZone } : null });
      }} />} />
      {draft.quiet && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {[['start', 'Start'], ['end', 'End'], ['zone', 'IANA time zone']].map(([field, label]) =>
          <TextField required key={field} label={label} type={field === 'zone' ? 'text' : 'time'} value={draft.quiet[field]}
            InputLabelProps={{ shrink: true }} onChange={event => {
              setSaved(false);
              setDraft({ ...draft, quiet: { ...draft.quiet, [field]: event.target.value } });
            }} />)}
      </Stack>}
      <Button type="submit" variant="contained" disabled={busy} sx={{ alignSelf: 'start' }}>Save preferences</Button>
    </Stack>}
  </Stack>;
}

export default function AdminAlertsPage() {
  const path = useLocation().pathname;
  const preferences = path === preferencesPath;
  const assigned = path.endsWith('/assigned');
  return <Stack spacing={2}>
    <Typography component="h1" variant="h5">{preferences ? 'My notifications' : assigned ? 'Assigned notification rules' : 'Notification inbox'}</Typography>
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Button component={Link} to={inboxPath}>Inbox</Button>
      <Button component={Link} to={preferencesPath}>My notifications</Button>
      <Button component={Link} to={inboxPath + '/assigned'}>Assigned rules</Button>
    </Stack>
    {preferences ? <Preferences /> : assigned ? <InternalAlertRules assigned /> : <Inbox />}
  </Stack>;
}
