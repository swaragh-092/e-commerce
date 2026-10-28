import { Alert, Autocomplete, Box, Button, Checkbox, FormControlLabel, Grid, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

export const emptyRecipients = () => ({ defaultAdmins: false, userIds: [], roleIds: [], contacts: [] });
export const includesCustomer = rule => ['customer', 'mixed'].includes(rule.audience);
const hasInternalRecipients = recipients => recipients.defaultAdmins || recipients.userIds.length || recipients.roleIds.length || recipients.contacts.length;
export const audienceFor = (customer, recipients) => customer ? hasInternalRecipients(recipients) ? 'mixed' : 'customer' : 'internal';
export const recipientLabels = (rule, options) => [
  ...(includesCustomer(rule) ? ['Involved customer'] : []),
  ...(rule.recipients.defaultAdmins ? ['Store administrators'] : []),
  ...rule.recipients.userIds.map(id => options.users.find(user => user.id === id)?.name || 'Unavailable person'),
  ...rule.recipients.roleIds.map(id => options.roles.find(role => role.id === id)?.name || 'Unavailable role'),
  ...rule.recipients.contacts.map(contact => contact.name || contact.email || contact.phone || 'Additional contact'),
];

// Role members are available individually too, so an individual can get their own version.
export const recipientTargets = (rule, options) => {
  const recipients = rule.recipients;
  const target = (key, label, audience, patch = {}) => ({ key, label, audience, recipients: { ...emptyRecipients(), ...patch } });
  return [
    ...(includesCustomer(rule) ? [target('customer', 'Customer involved in this event', 'customer')] : []),
    ...(recipients.defaultAdmins ? [target('admins', 'Store administrators', 'internal', { defaultAdmins: true })] : []),
    ...options.roles.filter(role => recipients.roleIds.includes(role.id)).map(role => target(`role:${role.id}`, `${role.name} (role)`, 'internal', { roleIds: [role.id] })),
    ...options.users.filter(user => recipients.userIds.includes(user.id) || (recipients.defaultAdmins && user.isStoreAdmin) || user.roleIds?.some(id => recipients.roleIds.includes(id)))
      .map(user => target(`user:${user.id}`, `${user.name} (${user.email})`, 'internal', { userIds: [user.id] })),
    ...recipients.contacts.map((contact, index) => target(`contact:${index}`, contact.name || contact.email || contact.phone || `Contact ${index + 1}`, 'internal', { contacts: [{ ...contact }] })),
  ];
};
export const targetSignature = target => target.key.startsWith('contact:')
  ? JSON.stringify([target.recipients.contacts[0].email.trim().toLowerCase(), target.recipients.contacts[0].phone.trim()]) : target.key;

export default function NotificationRecipients({ rule, options, disabled, onChange }) {
  const recipients = rule.recipients;
  const update = (patch, customer = includesCustomer(rule)) => {
    const next = { ...recipients, ...patch };
    onChange({ recipients: next, audience: audienceFor(customer, next) });
  };
  const unavailable = recipients.userIds.some(id => !options.users.some(user => user.id === id)) || recipients.roleIds.some(id => !options.roles.some(role => role.id === id));
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>1. Who receives this?</Typography>
      <Typography variant="body2" color="text.secondary">Select everyone who should receive this message. You can combine these recipients.</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" sx={{ my: 1 }}>
        <FormControlLabel control={<Checkbox checked={includesCustomer(rule)} disabled={disabled} size="small" onChange={event => update({}, event.target.checked)} />} label="Customer involved in this event" />
        <FormControlLabel control={<Checkbox size="small" checked={recipients.defaultAdmins} disabled={disabled} onChange={event => update({ defaultAdmins: event.target.checked })} />} label="Store administrators" />
      </Stack>
      {includesCustomer(rule) && <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>Only the customer from this order or enquiry is included. Other customers will not receive it.</Typography>}
      <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Autocomplete multiple options={options.users} disabled={disabled}
              value={options.users.filter(user => recipients.userIds.includes(user.id))}
              isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={user => `${user.name} (${user.email})`}
              onChange={(_, users) => update({ userIds: users.map(user => user.id) })}
              renderInput={params => <TextField {...params} size="small" label="Specific people" helperText="Active staff and administrator accounts" />} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete multiple options={options.roles} disabled={disabled}
              value={options.roles.filter(role => recipients.roleIds.includes(role.id))}
              isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={role => role.name}
              onChange={(_, roles) => update({ roleIds: roles.map(role => role.id) })}
              renderInput={params => <TextField {...params} size="small" label="Roles" helperText="Sent to active members of these roles at the time of the event" />} />
          </Grid>
        </Grid>
        {unavailable && <Alert severity="warning" action={<Button disabled={disabled} onClick={() => update({ userIds: recipients.userIds.filter(id => options.users.some(user => user.id === id)), roleIds: recipients.roleIds.filter(id => options.roles.some(role => role.id === id)) })}>Remove unavailable</Button>}>A previously selected person or role is unavailable. Review the recipient selection before saving.</Alert>}
        {recipients.contacts.map((contact, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Grid container spacing={1}>
              {[['name', 'Contact name'], ['email', 'Email address'], ['phone', 'Phone number']].map(([field, label]) => (
                <Grid item xs={12} sm={4} key={field}>
                  <TextField fullWidth size="small" label={`${label} ${index + 1}`} value={contact[field]} disabled={disabled}
                    type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                    placeholder={field === 'phone' ? '+919876543210' : ''}
                    helperText={field === 'phone' ? 'Include the country code' : undefined}
                    onChange={event => update({ contacts: recipients.contacts.map((item, i) => i === index ? { ...item, [field]: event.target.value } : item) })} />
                </Grid>
              ))}
            </Grid>
            <IconButton aria-label={`Remove contact ${index + 1}`} disabled={disabled} onClick={() => update({ contacts: recipients.contacts.filter((_, i) => i !== index) })}><CloseIcon fontSize="small" /></IconButton>
          </Box>
        ))}
        <Box><Button size="small" startIcon={<AddIcon />} disabled={disabled || recipients.contacts.length >= 100} onClick={() => update({ contacts: [...recipients.contacts, { name: '', email: '', phone: '' }] })}>Add another contact</Button></Box>
        <Typography variant="caption" color="text.secondary">Additional contacts do not need an account. Everyone selected here receives the same content, personalized with variables. Overlapping selections receive one copy per channel.</Typography>
      </Box>
    </Box>
  );
}
