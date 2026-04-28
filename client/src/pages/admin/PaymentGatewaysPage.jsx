import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Switch, FormControlLabel, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip,
  CircularProgress, Alert, Divider, Stack,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

// ─── Gateway logos (inline SVG / emoji fallbacks) ───────────────────────────
const GATEWAY_LOGOS = {
  razorpay: (
    <Box
      sx={{
        width: 40, height: 40, borderRadius: 2, bgcolor: '#072654',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 11, letterSpacing: -0.5 }}>RZP</Typography>
    </Box>
  ),
  cashfree: (
    <Box
      sx={{
        width: 40, height: 40, borderRadius: 2, bgcolor: '#1B4965',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 11 }}>CF</Typography>
    </Box>
  ),
  stripe: (
    <Box
      sx={{
        width: 40, height: 40, borderRadius: 2, bgcolor: '#635BFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>S</Typography>
    </Box>
  ),
  payu: (
    <Box
      sx={{
        width: 40, height: 40, borderRadius: 2, bgcolor: '#FF6600',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 11 }}>PayU</Typography>
    </Box>
  ),
  cod: (
    <Box
      sx={{
        width: 40, height: 40, borderRadius: 2, bgcolor: '#2E7D32',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <Typography sx={{ fontSize: 20 }}>💵</Typography>
    </Box>
  ),
};

const GATEWAY_DOCS = {
  razorpay: 'https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/',
  cashfree: 'https://docs.cashfree.com/docs/getting-started#step-1-create-a-cashfree-account',
  stripe: 'https://dashboard.stripe.com/apikeys',
  payu: 'https://developer.payubiz.in/v2/page/getting-started',
  cod: null,
};

// ─── Setup Modal ─────────────────────────────────────────────────────────────
const SetupModal = ({ gateway, open, onClose, onSaved }) => {
  const [values, setValues] = useState({});
  const [shown, setShown] = useState({});
  const [saving, setSaving] = useState(false);
  const { notify } = useNotification();

  useEffect(() => {
    if (open && gateway) {
      // Pre-populate with empty strings; user fills in fresh values
      const initial = {};
      (gateway.fields || []).forEach((f) => { initial[f.key] = ''; });
      setValues(initial);
      setShown({});
    }
  }, [open, gateway]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out empty fields (don't overwrite existing keys with empty)
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v.trim() !== '')
      );
      await api.post(`/payments/gateways/${gateway.id}/configure`, payload);
      notify(`${gateway.name} credentials saved.`, 'success');
      onSaved();
      onClose();
    } catch (err) {
      notify(err?.response?.data?.error?.message || 'Failed to save credentials.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!gateway) return null;

  const hasValues = Object.values(values).some((v) => v.trim() !== '');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        {GATEWAY_LOGOS[gateway.id]}
        <Box>
          <Typography variant="h6" fontWeight={700}>Configure {gateway.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            Credentials are stored securely in the database. Leave a field blank to keep the existing value.
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {GATEWAY_DOCS[gateway.id] && (
          <Alert
            severity="info"
            sx={{ mb: 2.5 }}
            action={
              <Button
                size="small"
                endIcon={<OpenInNewIcon fontSize="small" />}
                href={GATEWAY_DOCS[gateway.id]}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Keys
              </Button>
            }
          >
            Find your API keys in the {gateway.name} dashboard.
          </Alert>
        )}

        {gateway.comingSoon && (
          <Alert severity="warning" sx={{ mb: 2.5 }}>
            <strong>{gateway.name} backend integration is coming soon.</strong> You can save credentials now,
            but gateway processing will be available in the next release.
          </Alert>
        )}

        {gateway.maskedKey && (
          <Alert severity="success" sx={{ mb: 2.5 }}>
            Currently connected: <strong>{gateway.maskedKey}</strong>
            {gateway.mode && <> · Mode: <strong>{gateway.mode}</strong></>}
          </Alert>
        )}

        <Stack spacing={2} sx={{ mt: 1 }}>
          {(gateway.fields || []).map((field) => {
            if (field.type === 'select') {
              return (
                <FormControl key={field.key} fullWidth size="small">
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    label={field.label}
                    value={values[field.key] || (field.options?.[0] ?? '')}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  >
                    {(field.options || []).map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }
            return (
              <TextField
                key={field.key}
                fullWidth
                size="small"
                label={field.label}
                placeholder={field.placeholder}
                type={field.secret && !shown[field.key] ? 'password' : 'text'}
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                InputProps={
                  field.secret
                    ? {
                        endAdornment: (
                          <IconButton
                            size="small"
                            onClick={() => setShown((s) => ({ ...s, [field.key]: !s[field.key] }))}
                          >
                            {shown[field.key] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        ),
                      }
                    : undefined
                }
              />
            );
          })}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasValues || saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Saving…' : 'Save & Apply'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Gateway Card ─────────────────────────────────────────────────────────────
const GatewayCard = ({ gateway, paymentSettings, onToggle, onConfigure, togglingId }) => {
  const enabledKey = `${gateway.id}Enabled`;
  const isEnabled = Boolean(paymentSettings[enabledKey]);
  const isToggling = togglingId === gateway.id;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        border: isEnabled ? '1.5px solid' : '1px solid',
        borderColor: isEnabled ? 'primary.main' : 'divider',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
      }}
    >
      {/* Logo */}
      {GATEWAY_LOGOS[gateway.id]}

      {/* Info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" fontWeight={700}>{gateway.name}</Typography>

          {/* Connection status */}
          {gateway.id !== 'cod' && (
            gateway.connected ? (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                label={`Connected · ${gateway.mode}`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 22, fontSize: 11 }}
              />
            ) : (
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
                label="Setup required"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 22, fontSize: 11 }}
              />
            )
          )}

          {gateway.comingSoon && (
            <Chip label="Coming soon" size="small" sx={{ height: 22, fontSize: 11, bgcolor: 'action.hover' }} />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {gateway.description}
        </Typography>

        {gateway.maskedKey && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', mt: 0.5, display: 'block' }}>
            Key: {gateway.maskedKey}
          </Typography>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {/* Configure button — not needed for COD */}
        {gateway.id !== 'cod' && (
          <Tooltip title="Configure API credentials">
            <IconButton
              size="small"
              onClick={() => onConfigure(gateway)}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Enable toggle */}
        <Tooltip title={isEnabled ? 'Disable at checkout' : 'Enable at checkout'}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isToggling ? (
              <CircularProgress size={24} />
            ) : (
              <Switch
                checked={isEnabled}
                onChange={() => onToggle(gateway.id, !isEnabled)}
                color="primary"
              />
            )}
          </Box>
        </Tooltip>
      </Box>
    </Paper>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────
const PaymentGatewaysPage = () => {
  const [gateways, setGateways] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [configuring, setConfiguring] = useState(null); // gateway object or null
  const { notify } = useNotification();
  const { hasPermission } = useAuth();

  const canManage = hasPermission(PERMISSIONS.SETTINGS_MANAGE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gwRes, settingsRes] = await Promise.all([
        api.get('/payments/gateways'),
        api.get('/settings'),
      ]);
      setGateways(gwRes.data?.data || []);
      const allSettings = settingsRes.data?.data || {};
      setPaymentSettings(allSettings.payments || {});
    } catch {
      notify('Failed to load gateway data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (gatewayId, enabled) => {
    setTogglingId(gatewayId);
    try {
      await api.put('/settings/bulk', [
        { group: 'payments', key: `${gatewayId}Enabled`, value: enabled },
      ]);
      setPaymentSettings((prev) => ({ ...prev, [`${gatewayId}Enabled`]: enabled }));
      notify(`${gatewayId.charAt(0).toUpperCase() + gatewayId.slice(1)} ${enabled ? 'enabled' : 'disabled'}.`, 'success');
    } catch {
      notify('Failed to update gateway status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDefaultChange = async (e) => {
    try {
      await api.put('/settings/bulk', [
        { group: 'payments', key: 'defaultMethod', value: e.target.value },
      ]);
      setPaymentSettings((prev) => ({ ...prev, defaultMethod: e.target.value }));
      notify('Default payment method updated.', 'success');
    } catch {
      notify('Failed to update default method.', 'error');
    }
  };

  const enabledGateways = gateways.filter((g) => paymentSettings[`${g.id}Enabled`]);
  const selectedDefaultId = enabledGateways.find(g => g.id === paymentSettings.defaultMethod)
    ? paymentSettings.defaultMethod
    : (enabledGateways[0]?.id || '');

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>Payment Gateways</Typography>
        <Typography variant="body2" color="text.secondary">
          Choose which payment methods are available at checkout. Enable a gateway, then click
          the ⚙ icon to enter your API keys — no server restart needed.
        </Typography>
      </Box>

      {!canManage && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You have read-only access. Contact an administrator to make changes.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Gateway cards */}
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            {gateways.map((gw) => (
              <GatewayCard
                key={gw.id}
                gateway={gw}
                paymentSettings={paymentSettings}
                onToggle={canManage ? handleToggle : () => notify('No permission.', 'error')}
                onConfigure={canManage ? setConfiguring : () => notify('No permission.', 'error')}
                togglingId={togglingId}
              />
            ))}
          </Stack>

          {/* Default method picker */}
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Default Payment Method
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This method is pre-selected when a customer reaches the payment step.
            </Typography>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Default method</InputLabel>
              <Select
                label="Default method"
                value={selectedDefaultId}
                onChange={handleDefaultChange}
                disabled={!canManage}
              >
                {enabledGateways.length === 0
                  ? <MenuItem value="" disabled>No gateways enabled</MenuItem>
                  : enabledGateways.map((gw) => (
                      <MenuItem key={gw.id} value={gw.id}>{gw.name}</MenuItem>
                    ))
                }
              </Select>
            </FormControl>
          </Paper>

          {/* Info footer */}
          <Divider sx={{ my: 3 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: '1 1 220px' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                🔒 Where are keys stored?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                API keys are saved to your database and are <strong>never sent to the browser</strong>.
                They are server-side only. Existing <code>.env</code> values continue to work as fallbacks.
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: '1 1 220px' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                🔗 Webhooks
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Set your webhook URL in each gateway's dashboard:<br />
                <code style={{ fontSize: 11 }}>{window.location.origin}/api/payments/webhook</code> (Razorpay)<br />
                <code style={{ fontSize: 11 }}>{window.location.origin}/api/payments/webhook/cashfree</code> (Cashfree)
              </Typography>
            </Paper>
          </Box>
        </>
      )}

      {/* Configure Modal */}
      <SetupModal
        gateway={configuring}
        open={Boolean(configuring)}
        onClose={() => setConfiguring(null)}
        onSaved={load}
      />
    </Box>
  );
};

export default PaymentGatewaysPage;
