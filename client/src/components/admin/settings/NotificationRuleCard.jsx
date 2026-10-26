import { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, Divider, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import NotificationRecipients, { recipientLabels, recipientTargets } from './NotificationRecipients';
import NotificationMessageEditor, { channels } from './NotificationMessageEditor';

export default function NotificationRuleCard({ event, rule, options, separateRules = [], sharedRules = [], expanded, onExpand, onChange, onRemove, onSeparate, onOpenRule, canSeparate, autoFocusName, disabled }) {
  const [channel, setChannel] = useState(rule.channels[0] || 'email');
  const labels = recipientLabels(rule, options);
  return (
    <Accordion expanded={expanded} onChange={(_, value) => onExpand(value)} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`notification-${rule.id}-content`} id={`notification-${rule.id}-header`}>
        <Box sx={{ minWidth: 0, flex: 1, py: 0.5 }}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography fontWeight={600}>{rule.name || 'New notification'}</Typography><Chip size="small" label={rule.isActive ? 'Active' : 'Paused'} color={rule.isActive ? 'success' : 'default'} variant="outlined" /></Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{labels.slice(0, 3).join(', ') || 'Choose recipients'}{labels.length > 3 ? ` +${labels.length - 3} more` : ''}{separateRules.length ? ` · ${separateRules.length} separate message${separateRules.length === 1 ? '' : 's'}` : ''} · {rule.channels.map(key => channels.find(item => item.key === key)?.label).join(', ') || 'No channels selected'}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ display: 'grid', gap: 3, px: { xs: 2, sm: 3 }, pb: 3 }}>
        {sharedRules.length > 0 && <Alert severity="info" icon={false}>Recipients on this card receive this version instead of {sharedRules.map(item => `“${item.name}”`).join(', ')}.</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }}>
          <TextField size="small" label="Notification name" value={rule.name} fullWidth autoFocus={autoFocusName} disabled={disabled} onChange={e => onChange({ name: e.target.value })} inputProps={{ maxLength: 100 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
            <FormControlLabel control={<Switch size="small" checked={rule.isActive} disabled={disabled} onChange={e => onChange({ isActive: e.target.checked })} />} label="Active" />
            <IconButton aria-label={`Remove ${rule.name || 'notification'}`} disabled={disabled} onClick={onRemove}><DeleteOutlineIcon /></IconButton>
          </Stack>
        </Stack>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <NotificationRecipients rule={rule} options={options} disabled={disabled} onChange={onChange} />
          {separateRules.length > 0 && <Alert severity="info" icon={false}>
            <Typography variant="body2">These recipients have their own message and are excluded from this one, even if they belong to a selected role:</Typography>
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>{separateRules.map(item => <Chip key={item.id} size="small" label={item.name} onClick={() => onOpenRule(item.id)} />)}</Stack>
          </Alert>}
          {!disabled && <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
              <Box><Typography variant="subtitle2">Different content for someone?</Typography><Typography variant="body2" color="text.secondary">Give a person or group their own message.</Typography></Box>
              <Button variant="outlined" size="small" startIcon={<CallSplitIcon />} disabled={!canSeparate || !recipientTargets(rule, options).length} onClick={onSeparate} sx={{ flexShrink: 0 }}>Separate message</Button>
            </Stack>
          </Box>}
        </Box>
        <Divider />
        <Box>
          <Typography variant="subtitle2">2. How should it be sent?</Typography>
          <Stack direction="row" flexWrap="wrap">{channels.map(item => <FormControlLabel key={item.key} label={item.label} control={<Checkbox size="small" disabled={disabled} checked={rule.channels.includes(item.key)} onChange={e => {
            onChange({ channels: e.target.checked ? [...rule.channels, item.key] : rule.channels.filter(key => key !== item.key) });
            if (e.target.checked) setChannel(item.key);
          }} />} />)}</Stack>
          <Typography variant="caption" color="text.secondary">Selecting multiple channels sends a separate message through each one.</Typography>
          {rule.channels.some(key => options.channelEnabled?.[key] === false) && <Alert severity="warning" sx={{ mt: 1 }}>{rule.channels.filter(key => options.channelEnabled?.[key] === false).map(key => channels.find(item => item.key === key).label).join(', ')} currently disabled. Enable the channel in Messaging settings before messages can be sent.</Alert>}
        </Box>
        <Divider />
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Typography variant="subtitle2">3. What should they receive?</Typography>
          <TextField select size="small" label="Message channel" value={channel} onChange={e => setChannel(e.target.value)} sx={{ maxWidth: 260 }}>
            {channels.map(item => <MenuItem key={item.key} value={item.key}>{item.label}{rule.channels.includes(item.key) ? '' : ' (not selected)'}</MenuItem>)}
          </TextField>
          <NotificationMessageEditor key={channel} event={event} rule={rule} channel={channel} disabled={disabled} onChange={onChange} />
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
