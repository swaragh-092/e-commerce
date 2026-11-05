import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, InputAdornment, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationRuleCard from '../../components/admin/settings/NotificationRuleCard';
import { emptyRecipients, recipientTargets, targetSignature } from '../../components/admin/settings/NotificationRecipients';
import { notificationService } from '../../services/notificationService';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { useNotification } from '../../context/NotificationContext';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { isNotificationTemplateVisible } from '../../utils/notificationTemplateVisibility';

const SystemTemplates = lazy(() => import('./EmailTemplatesPage'));
const EMPTY_OPTIONS = { users: [], roles: [] };
const emptyMessage = () => ({ subject: '', bodyHtml: '', bodyText: '' });
const statusColor = status => ({ sent: 'success', failed: 'error', skipped: 'warning', processing: 'info', queued: 'default' })[status] || 'default';

function DeliveryHistory({ event }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setRows(null); setError('');
    notificationService.history(event).then(data => { if (active) setRows(data); })
      .catch(error => { if (active) setError(getApiErrorMessage(error, 'Could not load delivery history.')); });
    return () => { active = false; };
  }, [event, refresh]);
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="body2" color="text.secondary">The latest 100 deliveries from event notifications, including skipped recipients.</Typography><Button startIcon={<RefreshIcon />} onClick={() => setRefresh(value => value + 1)}>Refresh</Button></Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {!rows && !error && <CircularProgress size={24} aria-label="Loading delivery history" />}
      {rows?.length === 0 && <Alert severity="info">No deliveries yet. New activity will appear here after the event occurs with saved notifications.</Alert>}
      {rows?.map(row => <Paper key={row.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap"><Typography fontWeight={600}>{row.name}</Typography><Chip size="small" label={row.status} color={statusColor(row.status)} /></Stack>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere', mt: 0.5 }}>{row.recipient} · {row.channel}</Typography>
        <Typography variant="caption" color="text.secondary">{new Date(row.createdAt).toLocaleString()}{row.attempts ? ` · ${row.attempts} attempt${row.attempts === 1 ? '' : 's'}` : ''}</Typography>
        {row.error && <Typography variant="body2" color={row.status === 'failed' ? 'error.main' : 'text.secondary'} sx={{ mt: 1 }}>{row.error}</Typography>}
      </Paper>)}
    </Box>
  );
}

export default function NotificationEventsPage() {
  const { hasPermission } = useAuth();
  const { features } = useSettings();
  const { notify, confirm } = useNotification();
  const canEdit = hasPermission(PERMISSIONS.NOTIFICATIONS_MANAGE);
  const [tab, setTab] = useState('events');
  const [systemVisited, setSystemVisited] = useState(false);
  const [systemDirty, setSystemDirty] = useState(false);
  const [events, setEvents] = useState([]);
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [selectedEvent, setSelected] = useState('');
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [eventError, setEventError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [detailTab, setDetailTab] = useState('notifications');
  const [retry, setRetry] = useState(0);
  const [separateSource, setSeparateSource] = useState('');
  const [separateTarget, setSeparateTarget] = useState('');
  const [focusRule, setFocusRule] = useState('');
  const availableEvents = useMemo(() => features == null ? [] : events.filter(event =>
    [event.customerTemplate, event.internalTemplate].filter(Boolean).every(name => isNotificationTemplateVisible(name, features))
  ), [events, features]);
  const selected = availableEvents.some(event => event.key === selectedEvent) ? selectedEvent : availableEvents[0]?.key || '';
  const loadingNotifications = loading || features == null;
  const draft = drafts[selected];
  const dirty = systemDirty || Object.values(drafts).some(value => value.dirty);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    Promise.all([notificationService.events(), notificationService.options()]).then(([events, options]) => {
      if (!active) return;
      setEvents(events); setOptions(options);
    }).catch(error => { if (active) setLoadError(getApiErrorMessage(error, 'Could not load notifications.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (selectedEvent === selected) return;
    setSelected(selected); setDetailTab('notifications'); setEventError(''); setSaveError(''); setSeparateSource(''); setFocusRule('');
  }, [selectedEvent, selected]);

  useEffect(() => {
    if (!selected || drafts[selected]) return;
    let active = true;
    setLoadingEvent(true); setEventError('');
    notificationService.read(selected).then(data => {
      if (!active) return;
      setDrafts(previous => ({ ...previous, [selected]: { ...data, dirty: false } }));
      setExpanded(previous => ({ ...previous, [selected]: data.rules[0]?.id || '' }));
    }).catch(error => { if (active) setEventError(getApiErrorMessage(error, 'Could not load this event.')); })
      .finally(() => { if (active) setLoadingEvent(false); });
    return () => { active = false; };
  }, [selected, retry]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const updateRules = rules => {
    setDrafts(previous => ({ ...previous, [selected]: { ...previous[selected], rules, dirty: true } }));
    setSaveError('');
  };
  const addRule = () => {
    const rule = { id: crypto.randomUUID(), name: 'New notification', audience: 'internal', isActive: true, separateRuleIds: [],
      channels: ['email'], recipients: emptyRecipients(), messages: { email: emptyMessage(), sms: emptyMessage(), whatsapp: emptyMessage() } };
    updateRules([...draft.rules, rule]);
    setExpanded(previous => ({ ...previous, [selected]: rule.id }));
    setFocusRule(rule.id);
  };
  const openRule = id => { setExpanded(previous => ({ ...previous, [selected]: id })); setFocusRule(id); };
  const source = draft?.rules.find(rule => rule.id === separateSource);
  const delegatedRules = source ? draft.rules.filter(item => source.separateRuleIds?.includes(item.id)) : [];
  const delegatedTargets = new Set(delegatedRules.flatMap(item => recipientTargets(item, options).map(targetSignature)));
  const targets = source ? recipientTargets(source, options).filter(target => !delegatedTargets.has(targetSignature(target))) : [];
  const separateMessage = () => {
    const target = targets.find(item => item.key === separateTarget);
    if (!source || !target || draft.rules.length >= 30) return;
    const rule = { ...structuredClone(source), id: crypto.randomUUID(), name: `Message for ${target.label}`.slice(0, 100),
      audience: target.audience, recipients: target.recipients,
      // Keep earlier versions ahead of a newly separated group, including future role overlap.
      separateRuleIds: [...(source.separateRuleIds || [])] };
    updateRules([...draft.rules.map(item => item.id === source.id ? { ...item, separateRuleIds: [...(item.separateRuleIds || []), rule.id] } : item), rule]);
    setSeparateSource(''); setSeparateTarget(''); openRule(rule.id);
  };
  const removeRule = async rule => {
    const isSeparate = draft.rules.some(item => item.separateRuleIds?.includes(rule.id));
    if (await confirm({ title: 'Remove notification?', message: `Remove “${rule.name}”? ${isSeparate ? 'Its recipients will return to the shared message. ' : ''}This takes effect when you save the event.`, confirmText: 'Remove', severity: 'warning' })) {
      updateRules(draft.rules.filter(item => item.id !== rule.id).map(item => ({ ...item,
        separateRuleIds: [...new Set((item.separateRuleIds || []).flatMap(id => id === rule.id ? rule.separateRuleIds || [] : [id]))] })));
    }
  };
  const save = async () => {
    const key = selected;
    setSaving(true); setSaveError('');
    try {
      const result = await notificationService.save(key, { revision: draft.revision, rules: draft.rules });
      setDrafts(previous => ({ ...previous, [key]: { ...result, dirty: false } }));
      setEvents(previous => previous.map(event => event.key === key ? { ...event, managed: true, notificationCount: result.rules.length } : event));
      notify('Event notifications saved.', 'success');
    } catch (error) { setSaveError(getApiErrorMessage(error, 'Could not save notifications. Your changes are still here.')); }
    finally { setSaving(false); }
  };
  const reload = async () => {
    if (draft?.dirty && !await confirm({ title: 'Discard unsaved changes?', message: 'Reload this event using the latest saved settings.', confirmText: 'Reload', severity: 'warning' })) return;
    setDrafts(previous => { const next = { ...previous }; delete next[selected]; return next; });
    setRetry(value => value + 1); setSaveError('');
  };
  const excludedTemplates = events.flatMap(event => [event.customerTemplate, event.internalTemplate]).filter(Boolean);
  const visibleEvents = availableEvents.filter(event => `${event.label} ${event.group}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectEvent = key => { setSelected(key); setDetailTab('notifications'); setEventError(''); setSaveError(''); setSeparateSource(''); setFocusRule(''); };
  return (
    <Box>
      <Typography variant="h5" component="h1">Notifications</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>Choose an event, then decide who hears about it and what they receive.</Typography>
      <Tabs value={tab} onChange={(_, value) => { setTab(value); if (value === 'system') setSystemVisited(true); }} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="events" label="Event notifications" /><Tab value="system" label="Account & system templates" disabled={loadingNotifications || Boolean(loadError)} />
      </Tabs>
      {systemVisited && <Box sx={{ display: tab === 'system' ? 'block' : 'none' }}><Suspense fallback={<CircularProgress size={24} />}><SystemTemplates excludeTemplates={excludedTemplates} embedded onDirtyChange={setSystemDirty} /></Suspense></Box>}
      {loadingNotifications ? <CircularProgress aria-label="Loading notifications" /> : loadError ? <Alert severity="error" action={<Button onClick={() => setRetry(value => value + 1)}>Retry</Button>}>{loadError}</Alert> : !availableEvents.length ? <Box sx={{ display: tab === 'events' ? 'block' : 'none' }}><Alert severity="info">No event notifications are available for the enabled store features.</Alert></Box> : <Grid container spacing={3} sx={{ display: tab === 'events' ? 'flex' : 'none' }}>
        <Grid item xs={12} md={3}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: { xs: 'block', md: 'none' } }}><TextField select fullWidth size="small" label="Notification event" value={selected} disabled={saving} onChange={event => selectEvent(event.target.value)}>{availableEvents.map(event => <MenuItem key={event.key} value={event.key}>{event.label}</MenuItem>)}</TextField></Box>
            <Box sx={{ p: 2, display: { xs: 'none', md: 'block' } }}><TextField size="small" fullWidth placeholder="Search events" value={search} onChange={event => setSearch(event.target.value)}
              inputProps={{ 'aria-label': 'Search events' }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} /></Box>
            <List sx={{ py: 0, maxHeight: 'calc(100vh - 280px)', overflow: 'auto', display: { xs: 'none', md: 'block' } }}>
              {!visibleEvents.length && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No matching events.</Typography>}
              {visibleEvents.map(event => <ListItemButton key={event.key} aria-label={event.label} aria-current={selected === event.key ? 'page' : undefined} selected={selected === event.key} disabled={saving} onClick={() => selectEvent(event.key)} sx={{ mx: 1, mb: 0.5, borderRadius: 1.5 }}>
                <ListItemText primary={<Stack direction="row" alignItems="center" gap={1}><Typography variant="body2" fontWeight={selected === event.key ? 700 : 500}>{event.label}</Typography>{drafts[event.key]?.dirty && <Box component="span" aria-label="Unsaved changes" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} />}</Stack>} primaryTypographyProps={{ component: 'div' }} secondary={event.group} />
              </ListItemButton>)}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={9}>
          {loadingEvent && !draft ? <CircularProgress aria-label="Loading event" /> : eventError ? <Alert severity="error" action={<Button onClick={() => setRetry(value => value + 1)}>Retry</Button>}>{eventError}</Alert> : draft ? <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
              <Box><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="h6" component="h2">{draft.event.label}</Typography><Chip size="small" label={draft.dirty ? 'Unsaved changes' : draft.managed ? 'Configured' : 'Current defaults'} color={draft.dirty ? 'warning' : 'default'} variant="outlined" /></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{draft.event.description}</Typography></Box>
              <Stack direction="row" gap={1} alignItems="flex-start" sx={{ flexShrink: 0 }}><Button size="small" disabled={saving} onClick={reload}>Reload</Button>{canEdit && <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />} disabled={saving || (!draft.dirty && draft.managed)} onClick={save}>{saving ? 'Saving…' : 'Save event'}</Button>}</Stack>
            </Stack>
            {!canEdit && <Alert severity="info">You can view notifications. Editing requires notification management permission.</Alert>}
            {!draft.managed && <Alert severity="info">Your existing notifications are running. Saving this event activates the recipient and message settings below.</Alert>}
            {saveError && <Alert severity="error">{saveError}</Alert>}
            <Tabs value={detailTab} onChange={(_, value) => setDetailTab(value)}><Tab value="notifications" label={`Notifications (${draft.rules.length})`} /><Tab value="history" label="Delivery history" /></Tabs>
            {detailTab === 'history' ? <DeliveryHistory key={selected} event={selected} /> : <>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                  <Box><Typography fontWeight={600}>Messages & recipients</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Send one message to several recipients, or create different messages for your customer, team and individual people.</Typography></Box>
                  {canEdit && <Button variant="outlined" startIcon={<AddIcon />} disabled={saving || draft.rules.length >= 30} onClick={addRule} sx={{ flexShrink: 0 }}>Add different message</Button>}
                </Stack>
              </Paper>
              {draft.rules.map(rule => <NotificationRuleCard key={rule.id} event={draft.event} rule={rule} options={options} disabled={!canEdit || saving}
                separateRules={draft.rules.filter(item => rule.separateRuleIds?.includes(item.id))} canSeparate={draft.rules.length < 30} autoFocusName={focusRule === rule.id}
                sharedRules={draft.rules.filter(item => item.separateRuleIds?.includes(rule.id))}
                onSeparate={() => { setSeparateSource(rule.id); setSeparateTarget(''); }} onOpenRule={openRule}
                expanded={expanded[selected] === rule.id} onExpand={open => setExpanded(previous => ({ ...previous, [selected]: open ? rule.id : '' }))}
                onChange={patch => updateRules(draft.rules.map(item => item.id === rule.id ? { ...item, ...patch } : item))} onRemove={() => removeRule(rule)} />)}
              {!draft.rules.length && <Alert severity="info">No notifications are configured. Add one to notify someone, or save this event empty to stop its notifications.</Alert>}
              {draft.rules.length >= 30 && <Alert severity="info">This event has reached the limit of 30 messages.</Alert>}
            </>}
          </Box> : null}
        </Grid>
      </Grid>}
      <Dialog open={Boolean(source)} onClose={() => setSeparateSource('')} fullWidth maxWidth="sm" aria-labelledby="separate-message-title">
        <DialogTitle id="separate-message-title">Create a separate message</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>Choose a person or group from “{source?.name}”. They will receive their own message instead of the shared version. We’ll copy the channels and content for you to edit.</DialogContentText>
          <TextField select autoFocus fullWidth label="Recipient for separate message" value={separateTarget} onChange={event => setSeparateTarget(event.target.value)}>
            {targets.map(target => <MenuItem key={target.key} value={target.key} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{target.label}</MenuItem>)}
          </TextField>
          {!targets.length && <Alert severity="info" sx={{ mt: 2 }}>These recipients already have separate messages. Open one of those messages to change its content or split its recipients further.</Alert>}
        </DialogContent>
        <DialogActions><Button onClick={() => setSeparateSource('')}>Cancel</Button><Button variant="contained" disabled={!separateTarget || !canEdit || saving} onClick={separateMessage}>Create message</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
