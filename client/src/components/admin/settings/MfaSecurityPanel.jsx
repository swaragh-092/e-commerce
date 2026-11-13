import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Paper,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import authService from '../../../services/authService';
import TwoFactorSetup from '../../storefront/TwoFactorSetup';

const emptyPolicy = () => ({
  requireAdministrators: false,
  allowEmailCodes: false,
  staffMode: 'optional',
  requiredRoleIds: [],
});

const errorMessage = (error, fallback) => error?.response?.data?.error?.message || error?.response?.data?.message || fallback;

export default function MfaSecurityPanel() {
  const [config, setConfig] = useState(null);
  const [policy, setPolicy] = useState(emptyPolicy);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const load = useCallback(async (active = () => true) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await authService.getMfaPolicy();
      if (!active()) return;
      setConfig(result);
      setPolicy({
        requireAdministrators: Boolean(result.policy?.requireAdministrators),
        allowEmailCodes: result.policy?.allowEmailCodes === true,
        staffMode: result.policy?.staffMode || 'optional',
        requiredRoleIds: Array.isArray(result.policy?.requiredRoleIds) ? [...result.policy.requiredRoleIds] : [],
      });
    } catch (error) {
      if (active()) setLoadError(errorMessage(error, 'Unable to load MFA policy.'));
    } finally {
      if (active()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    load(() => active);
    return () => { active = false; };
  }, [load]);

  const updatePolicy = (key, value) => {
    setPolicy(current => ({ ...current, [key]: value }));
    setSaveError('');
    setSaveSuccess(false);
  };
  const refreshEnrollment = async () => {
    try {
      const result = await authService.getMfaPolicy();
      setConfig(current => ({ ...current, ...result }));
      if (result.mfaEnabled) setSetupOpen(false);
      setSaveError('');
    } catch (error) {
      setSaveError(errorMessage(error, 'Unable to refresh authenticator status.'));
    }
  };
  const toggleRole = (roleId, checked) => {
    setPolicy(current => ({
      ...current,
      requiredRoleIds: checked
        ? [...new Set([...current.requiredRoleIds, roleId])]
        : current.requiredRoleIds.filter(id => id !== roleId),
    }));
    setSaveError('');
    setSaveSuccess(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!config?.canManage || saving || (policy.allowEmailCodes && !config.mfaEnabled)
      || (policy.staffMode === 'selected' && !policy.requiredRoleIds.length)) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    const payload = {
      policy: {
        requireAdministrators: policy.requireAdministrators,
        ...(policy.allowEmailCodes ? { allowEmailCodes: true } : {}),
        staffMode: policy.staffMode,
        requiredRoleIds: policy.staffMode === 'selected' ? [...policy.requiredRoleIds] : [],
      },
      verification: {
        currentPassword,
        ...(config.mfaEnabled && code ? { code } : {}),
      },
    };
    try {
      const result = await authService.updateMfaPolicy(payload);
      if (result?.policy) {
        setConfig(result);
        setPolicy({
          requireAdministrators: Boolean(result.policy.requireAdministrators),
          allowEmailCodes: result.policy.allowEmailCodes === true,
          staffMode: result.policy.staffMode || 'optional',
          requiredRoleIds: Array.isArray(result.policy.requiredRoleIds) ? [...result.policy.requiredRoleIds] : [],
        });
      } else {
        setConfig(current => ({ ...current, policy: payload.policy }));
      }
      setSaveSuccess(true);
      setConfirmOpen(false);
    } catch (error) {
      setSaveError(errorMessage(error, 'Unable to save MFA policy.'));
    } finally {
      setCurrentPassword('');
      setCode('');
      setSaving(false);
    }
  };

  if (loading) return <Box role="status" aria-label="Loading MFA policy" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} /></Box>;
  if (loadError) return <Stack spacing={2}>
    <Alert severity="error">{loadError}</Alert>
    <Box><Button variant="outlined" onClick={() => load()}>Retry</Button></Box>
  </Stack>;
  if (!config) return null;

  const canManage = Boolean(config.canManage);
  const enforcementEnabled = policy.requireAdministrators || policy.staffMode !== 'optional';
  const hasSelectedRoles = policy.staffMode !== 'selected' || policy.requiredRoleIds.length > 0;

  const emailSetupRequired = policy.allowEmailCodes && !config.mfaEnabled;
  const changed = policy.requireAdministrators !== Boolean(config.policy?.requireAdministrators)
    || policy.allowEmailCodes !== (config.policy?.allowEmailCodes === true)
    || policy.staffMode !== (config.policy?.staffMode || 'optional')
    || [...policy.requiredRoleIds].sort().join() !== [...(config.policy?.requiredRoleIds || [])].sort().join();
  const cardSx = { p: { xs: 2, md: 2.5 }, borderRadius: 2, minWidth: 0 };

  return (
    <Box component="section" aria-labelledby="mfa-policy-title" sx={{ maxWidth: 1040 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 1 }}>
        <Typography id="mfa-policy-title" variant="h6" fontWeight={700}>MFA security policy</Typography>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Chip size="small" label={changed ? 'Unsaved changes' : 'Current policy'} color={changed ? 'warning' : 'default'} variant="outlined" />
          {canManage && <Button variant="contained" disabled={!changed || !hasSelectedRoles || emailSetupRequired} onClick={() => { setSaveError(''); setConfirmOpen(true); }}>Save MFA policy</Button>}
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set up your own authenticator, then choose who needs a second sign-in step and which methods they can use. Customer MFA is managed separately.
      </Typography>
      {!canManage && <Alert severity="info" sx={{ mb: 2 }}>You can view this policy, but only a super administrator can change it.</Alert>}
      {saveError && !confirmOpen && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
      {saveSuccess && <Alert severity="success" role="status" sx={{ mb: 2 }}>MFA policy saved.</Alert>}
      <Stack spacing={2.5}>
        <Paper variant="outlined" sx={cardSx}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Your authenticator</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
                {config.mfaEnabled ? 'Your account is ready to verify security policy changes.' : 'Set up an authenticator app before allowing email codes or confirming policy changes with a code.'}
              </Typography>
            </Box>
            <Chip size="small" label={config.mfaEnabled ? 'Set up' : 'Not set up'} color={config.mfaEnabled ? 'success' : 'warning'} variant="outlined" />
          </Stack>
          {!config.mfaEnabled && <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button onClick={() => { setSetupOpen(true); document.getElementById('mfa-inline-setup')?.scrollIntoView({ block: 'center' }); }} variant="outlined" size="small">Set up authenticator</Button>
          </Stack>}
        </Paper>

        <Paper variant="outlined" sx={cardSx}>
          <Typography variant="subtitle1" fontWeight={700}>Who must use MFA?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>Apply requirements to administrators and staff roles. Each person uses their own authenticator.</Typography>
          <Stack spacing={2}>
            <FormControlLabel
              control={<Switch checked={policy.requireAdministrators} disabled={!canManage || saving} onChange={event => updatePolicy('requireAdministrators', event.target.checked)} />}
              label="Require MFA for administrators"
            />
            <FormControl fullWidth size="small" disabled={!canManage || saving}>
              <InputLabel id="mfa-staff-mode-label">Staff MFA requirement</InputLabel>
              <Select labelId="mfa-staff-mode-label" label="Staff MFA requirement" value={policy.staffMode} onChange={event => updatePolicy('staffMode', event.target.value)}>
                <MenuItem value="optional">Optional for staff</MenuItem>
                <MenuItem value="all">Require for all staff</MenuItem>
                <MenuItem value="selected">Require for selected staff roles</MenuItem>
              </Select>
            </FormControl>
            {policy.staffMode === 'selected' && <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: .5 }}>
              <FormGroup role="group" aria-label="Staff roles requiring MFA">
                {(config.roles || []).map(role => <FormControlLabel key={role.id} disabled={!canManage || saving}
                  control={<Checkbox checked={policy.requiredRoleIds.includes(role.id)} onChange={event => toggleRole(role.id, event.target.checked)} />}
                  label={`${role.name} (${role.slug})`} />)}
                {!config.roles?.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No staff roles are available.</Typography>}
              </FormGroup>
              {!hasSelectedRoles && <Typography variant="caption" color="error">Select at least one staff role before saving.</Typography>}
            </Box>}
            {enforcementEnabled && <Alert severity="warning">
              Before enabling mandatory MFA, make sure every affected active administrator and staff member has enrolled. On their next password sign-in, anyone who has not enrolled will be guided through authenticator setup before access is granted.
            </Alert>}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={cardSx}>
          <Typography variant="subtitle1" fontWeight={700}>Available sign-in methods</Typography>
          <Typography variant="body2" fontWeight={600} sx={{ mt: 2 }}>Authenticator app</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>The primary second step for accounts using MFA. Backup codes remain available for account recovery.</Typography>
          <FormControlLabel
            control={<Switch checked={policy.allowEmailCodes} disabled={!canManage || saving || (!config.mfaEnabled && !policy.allowEmailCodes)} onChange={event => updatePolicy('allowEmailCodes', event.target.checked)} />}
            label="Allow email codes after password sign-in"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            An alternative for verified staff email addresses after an initial password-and-authenticator sign-in. A password or email change requires the authenticator again.
          </Typography>
          {!config.mfaEnabled && <Alert severity="info" sx={{ mt: 2 }} action={<Button onClick={() => setSetupOpen(true)}>Set up authenticator</Button>}>
            {emailSetupRequired ? 'Finish authenticator setup or turn off email codes before saving.' : 'Set up your authenticator to enable email codes.'}
          </Alert>}
          <Box id="mfa-inline-setup">
            {setupOpen && <TwoFactorSetup user={{ twoFactorEnabled: false }} onUpdate={refreshEnrollment} />}
          </Box>
        </Paper>

        {canManage && <Dialog open={confirmOpen} onClose={() => {
          if (saving) return;
          setConfirmOpen(false);
          setCurrentPassword('');
          setCode('');
        }} aria-labelledby="confirm-mfa-policy">
          <DialogTitle id="confirm-mfa-policy">Confirm MFA policy changes</DialogTitle>
          <DialogContent>
          <Box component="form" onSubmit={handleSave}>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <Typography variant="subtitle1" fontWeight={700}>Review and save</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>
            Changes apply only after saving. Confirm your identity with your current password{config.mfaEnabled ? ' and authenticator code' : ''}.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: config.mfaEnabled ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 440px)' }, gap: 2, maxWidth: 760 }}>
            <TextField label="Current password" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={saving} />
            {config.mfaEnabled && <TextField label="Authenticator code" inputProps={{ inputMode: 'numeric', maxLength: 6 }} autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={saving} helperText="Enter a current authenticator code." />}
          </Box>
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={saving || !currentPassword || (config.mfaEnabled && code.length !== 6) || !hasSelectedRoles || emailSetupRequired}>
            {saving ? 'Saving MFA policy…' : 'Confirm and save'}
          </Button>
          {emailSetupRequired && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Complete authenticator setup or turn off email codes to save this policy.</Typography>}
          </Box>
          </DialogContent>
        </Dialog>}
      </Stack>
    </Box>
  );
}
