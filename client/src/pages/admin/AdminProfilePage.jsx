import { useEffect, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Avatar, Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const readable = (value = '') => value.replace(/[_.-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const profileFor = user => ({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.profile?.phone || '' });
const emptyPasswords = { currentPassword: '', newPassword: '', confirmPassword: '' };

const AdminProfilePage = () => {
  const { user, roles = [], permissions = [], updateProfile } = useAuth();
  const [form, setForm] = useState(() => profileFor(user));
  const [saved, setSaved] = useState(() => profileFor(user));
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [emailChange, setEmailChange] = useState({ newEmail: '', password: '' });
  const [pendingEmail, setPendingEmail] = useState(user?.pendingEmail || '');
  const [emailFeedback, setEmailFeedback] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState(emptyPasswords);
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  useEffect(() => {
    const next = profileFor(user);
    setForm(next); setSaved(next);
    setPendingEmail(user?.pendingEmail || '');
  }, [user?.id, user?.firstName, user?.lastName, user?.profile?.phone, user?.pendingEmail]);
  const dirty = Object.keys(form).some(key => form[key] !== saved[key]);
  const groups = [...new Set(permissions)].sort().reduce((result, permission) => {
    const [group, ...action] = permission.split('.');
    (result[group] ||= []).push({ permission, label: readable(action.join(' ') || group) });
    return result;
  }, {});
  const saveProfile = async event => {
    event.preventDefault();
    if (profileBusy || !dirty) return;
    setProfileFeedback(null);
    if (form.phone && !/^\d{10,15}$/.test(form.phone)) {
      setProfileFeedback({ severity: 'error', message: 'Phone number must contain 10 to 15 digits.' }); return;
    }
    const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== saved[key]).map(([key, value]) => [key, value.trim()]));
    setProfileBusy(true);
    try {
      const updated = await updateProfile(changes);
      const next = profileFor(updated);
      setSaved(next); setForm(next);
      setProfileFeedback({ severity: 'success', message: 'Profile saved.' });
    } catch (error) {
      setProfileFeedback({ severity: 'error', message: getApiErrorMessage(error, 'Could not save profile. Please try again.') });
    } finally { setProfileBusy(false); }
  };
  const requestEmailChange = async () => {
    if (emailBusy) return;
    setEmailFeedback(null);
    const newEmail = emailChange.newEmail.trim().toLowerCase();
    if (!newEmail) {
      setEmailFeedback({ severity: 'error', message: 'Enter a new email address.' }); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailFeedback({ severity: 'error', message: 'Enter a valid email address.' }); return;
    }
    if (newEmail === String(user?.email || '').toLowerCase()) {
      setEmailFeedback({ severity: 'error', message: 'Enter a different email address.' }); return;
    }
    setEmailBusy(true);
    try {
      await userService.requestEmailChange({ newEmail, password: emailChange.password });
      setPendingEmail(newEmail);
      setEmailChange({ newEmail: '', password: '' });
      setEmailChangeOpen(false);
      setEmailFeedback({ severity: 'success', message: `Verification link sent to ${newEmail}. Your sign-in email changes after you confirm it.` });
    } catch (error) {
      setEmailFeedback({ severity: 'error', message: getApiErrorMessage(error, 'Could not send the verification email. Please try again.') });
    } finally { setEmailBusy(false); }
  };
  const changePassword = async event => {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordFeedback(null);
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordFeedback({ severity: 'error', message: 'New passwords do not match.' }); return;
    }
    if (passwords.newPassword.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/.test(passwords.newPassword)) {
      setPasswordFeedback({ severity: 'error', message: 'Use at least 8 characters, including uppercase, lowercase, a number, and a special character (!@#$%^&*).' }); return;
    }
    setPasswordBusy(true);
    try {
      await userService.changePassword(passwords);
      setPasswords(emptyPasswords);
      setPasswordFeedback({ severity: 'success', message: 'Password changed. Your other sessions have been signed out.' });
    } catch (error) {
      setPasswordFeedback({ severity: 'error', message: getApiErrorMessage(error, 'Could not change password. Please try again.') });
    } finally { setPasswordBusy(false); }
  };
  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto' }}>
      <Typography variant="h4" component="h1" fontWeight={700}>My Profile</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>Manage your contact details and account security.</Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'secondary.main' }}>{user?.firstName?.[0]?.toUpperCase() || 'A'}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Staff account'}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ overflowWrap: 'anywhere' }}>{user?.email}</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip size="small" label={readable(user?.status || 'Unknown')} color={user?.status === 'active' ? 'success' : 'default'} />
              {roles.map(role => <Chip size="small" key={role} label={readable(role)} variant="outlined" />)}
            </Stack>
          </Box>
        </Stack>
      </Paper>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
        <Paper component="form" onSubmit={saveProfile} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Profile details</Typography>
          <Stack spacing={2}>
            {['firstName', 'lastName', 'phone'].map(key => <TextField key={key} label={{ firstName: 'First name', lastName: 'Last name', phone: 'Phone number' }[key]} value={form[key]} disabled={profileBusy} required={key === 'firstName' || (key === 'lastName' && Boolean(saved.lastName))} type={key === 'phone' ? 'tel' : 'text'} inputProps={{ maxLength: key === 'phone' ? 15 : 50 }} autoComplete={{ firstName: 'given-name', lastName: 'family-name', phone: 'tel' }[key]} onChange={event => { setForm(prev => ({ ...prev, [key]: event.target.value })); setProfileFeedback(null); }} helperText={key === 'phone' ? 'Optional. Enter 10 to 15 digits.' : undefined} />)}
            <TextField label="Email address" value={user?.email || ''} InputProps={{ readOnly: true }} helperText="Your sign-in email address." />
            {pendingEmail && <Alert severity="info">Email change pending. Confirm the link sent to {pendingEmail} to finish updating your sign-in email.</Alert>}
            {emailFeedback && <Alert severity={emailFeedback.severity} role="status">{emailFeedback.message}</Alert>}
            {!emailChangeOpen ? (
              <Button type="button" variant="outlined" onClick={() => { setEmailChangeOpen(true); setEmailFeedback(null); }} sx={{ alignSelf: 'flex-start' }}>Change email</Button>
            ) : (
              <Stack spacing={2}>
                <TextField label="New email address" type="email" autoComplete="email" required value={emailChange.newEmail} disabled={emailBusy} onChange={event => setEmailChange(prev => ({ ...prev, newEmail: event.target.value }))} />
                <TextField label="Current password" type="password" autoComplete="current-password" required value={emailChange.password} disabled={emailBusy} onChange={event => setEmailChange(prev => ({ ...prev, password: event.target.value }))} helperText="Confirm your identity before changing your sign-in email." />
                <Stack direction="row" spacing={1}>
                  <Button type="button" variant="contained" disabled={emailBusy || !emailChange.newEmail || !emailChange.password} onClick={requestEmailChange}>{emailBusy ? 'Sending…' : 'Send verification link'}</Button>
                  <Button type="button" disabled={emailBusy} onClick={() => { setEmailChangeOpen(false); setEmailChange({ newEmail: '', password: '' }); setEmailFeedback(null); }}>Cancel</Button>
                </Stack>
              </Stack>
            )}
            {profileFeedback && <Alert severity={profileFeedback.severity} role="status">{profileFeedback.message}</Alert>}
            <Button type="submit" variant="contained" disabled={!dirty || profileBusy} sx={{ alignSelf: 'flex-start' }}>{profileBusy ? 'Saving…' : 'Save profile'}</Button>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Account security</Typography>
          <Stack spacing={2}>
            <Box><Typography variant="body2" color="text.secondary">Email verification</Typography><Chip size="small" sx={{ mt: 0.5 }} label={user?.emailVerified ? 'Verified' : 'Not verified'} color={user?.emailVerified ? 'success' : 'warning'} /></Box>
            <Box><Typography variant="body2" color="text.secondary">Two-factor authentication</Typography><Typography>{user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}</Typography></Box>
            <Box><Typography variant="body2" color="text.secondary">Last login</Typography><Typography>{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Not recorded'}</Typography></Box>
            <Divider />
            <Button variant="outlined" onClick={() => setPasswordOpen(true)} sx={{ alignSelf: 'flex-start' }} aria-expanded={passwordOpen}>Change password</Button>
            {passwordOpen && <Box component="form" onSubmit={changePassword}>
              <Stack spacing={2}>
                {Object.keys(emptyPasswords).map(key => <TextField key={key} label={{ currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password' }[key]} type="password" autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} value={passwords[key]} required disabled={passwordBusy} onChange={event => { setPasswords(prev => ({ ...prev, [key]: event.target.value })); setPasswordFeedback(null); }} helperText={key === 'newPassword' ? 'At least 8 characters: uppercase, lowercase, number, and !@#$%^&*.' : undefined} />)}
                {passwordFeedback && <Alert severity={passwordFeedback.severity} role="status">{passwordFeedback.message}</Alert>}
                <Stack direction="row" spacing={1}>
                  <Button type="submit" variant="contained" disabled={passwordBusy}>{passwordBusy ? 'Updating…' : 'Update password'}</Button>
                  <Button disabled={passwordBusy} onClick={() => { setPasswordOpen(false); setPasswords(emptyPasswords); setPasswordFeedback(null); }}>Cancel</Button>
                </Stack>
              </Stack>
            </Box>}
          </Stack>
        </Paper>
      </Box>
      <Accordion disableGutters elevation={0} sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="profile-permissions" id="profile-permissions-heading"><Typography fontWeight={600}>View permissions ({new Set(permissions).size})</Typography></AccordionSummary>
        <AccordionDetails id="profile-permissions">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Your permissions are assigned through your roles.</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {Object.entries(groups).map(([group, items]) => <Box key={group}><Typography variant="subtitle2" sx={{ mb: 1 }}>{readable(group)}</Typography><Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">{items.map(({ permission, label }) => <Chip key={permission} label={label} title={permission} size="small" variant="outlined" />)}</Stack></Box>)}
          </Box>
          {!permissions.length && <Typography color="text.secondary">No permissions assigned.</Typography>}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
export default AdminProfilePage;
