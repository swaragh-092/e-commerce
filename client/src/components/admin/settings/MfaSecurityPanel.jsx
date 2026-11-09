import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
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

  const updatePolicy = (key, value) => setPolicy(current => ({ ...current, [key]: value }));
  const toggleRole = (roleId, checked) => setPolicy(current => ({
    ...current,
    requiredRoleIds: checked
      ? [...new Set([...current.requiredRoleIds, roleId])]
      : current.requiredRoleIds.filter(id => id !== roleId),
  }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (!config?.canManage || saving) return;
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

  return (
    <Box component="section" aria-labelledby="mfa-policy-title">
      <Typography id="mfa-policy-title" variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>MFA security policy</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set which administrator and staff accounts must use multi-factor authentication. Customer MFA remains voluntary and is managed by each customer.
      </Typography>
      {config.source === 'environment' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          These are your current store requirements. Changes take effect only when you save the policy below.
        </Alert>
      )}
      {enforcementEnabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Before enabling mandatory MFA, make sure every affected active administrator and staff member has enrolled. New staff assigned a required role will need operator-assisted enrollment before their first sign-in.
        </Alert>
      )}
      {!canManage && (
        <Alert severity="info" sx={{ mb: 2 }}>You can view this policy, but only a super administrator can change it.</Alert>
      )}
      {saveError && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{saveError}</Alert>}
      {saveSuccess && <Alert severity="success" role="status" sx={{ mb: 2 }}>MFA policy saved.</Alert>}

      <Stack spacing={2}>
        <FormControlLabel
          control={<Switch checked={policy.requireAdministrators} disabled={!canManage || saving} onChange={event => updatePolicy('requireAdministrators', event.target.checked)} />}
          label="Require MFA for administrators"
        />
        <FormControlLabel
          control={<Switch checked={policy.allowEmailCodes} disabled={!canManage || saving} onChange={event => updatePolicy('allowEmailCodes', event.target.checked)} />}
          label="Allow email codes after password sign-in"
        />
        <Typography variant="body2" color="text.secondary">
          Staff and admins with a verified email must first sign in with their password and authenticator.
          After a password or email change, they need to use their authenticator again before email codes are available.
        </Typography>
        <FormControl fullWidth size="small" disabled={!canManage || saving}>
          <InputLabel id="mfa-staff-mode-label">Staff MFA requirement</InputLabel>
          <Select
            labelId="mfa-staff-mode-label"
            label="Staff MFA requirement"
            value={policy.staffMode}
            onChange={event => updatePolicy('staffMode', event.target.value)}
          >
            <MenuItem value="optional">Optional for staff</MenuItem>
            <MenuItem value="all">Require for all staff</MenuItem>
            <MenuItem value="selected">Require for selected staff roles</MenuItem>
          </Select>
        </FormControl>
        {policy.staffMode === 'selected' && (
          <FormGroup role="group" aria-label="Staff roles requiring MFA" sx={{ pl: 1 }}>
            {(config.roles || []).map(role => (
              <FormControlLabel
                key={role.id}
                disabled={!canManage || saving}
                control={<Checkbox checked={policy.requiredRoleIds.includes(role.id)} onChange={event => toggleRole(role.id, event.target.checked)} />}
                label={`${role.name} (${role.slug})`}
              />
            ))}
            {!config.roles?.length && <Typography variant="body2" color="text.secondary">No staff roles are available.</Typography>}
          </FormGroup>
        )}

        {canManage && (
          <Box component="form" onSubmit={handleSave}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Confirm this policy change</Typography>
            <Stack spacing={2} sx={{ maxWidth: 440 }}>
              <TextField
                label="Current password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
              />
              {config.mfaEnabled && (
                <TextField
                  label="Authenticator code"
                  inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  helperText="Enter a current authenticator code."
                />
              )}
              <Button
                type="submit"
                variant="contained"
                disabled={saving || !currentPassword || (config.mfaEnabled && code.length !== 6) || !hasSelectedRoles}
              >
                {saving ? 'Saving MFA policy…' : 'Save MFA policy'}
              </Button>
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
