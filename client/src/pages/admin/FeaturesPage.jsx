import { useState, useEffect, useContext } from 'react';
import {
  Alert,
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { updateSettings } from '../../services/adminService';
import { getAllSettings } from '../../services/settingsService';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import { useMode } from '../../hooks/useSettings';
import platformFeatures from '../../../../shared/platform-features.json';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const FeaturesPage = () => {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { notify } = useNotification();
  const { refreshSettings } = useContext(SettingsContext) || {};
  const appMode = useMode();
  const selectedMode = form['general.mode'] || appMode;
  const isSuperAdmin = useIsSuperAdmin();
  const [featureConfirmOpen, setFeatureConfirmOpen] = useState(false);

  useEffect(() => {
    getAllSettings().then((raw = {}) => {
      const flat = {};
      Object.entries(raw).forEach(([group, keys]) => {
        if (typeof keys === 'object') {
          Object.entries(keys).forEach(([k, v]) => {
            flat[`${group}.${k}`] = v;
          });
        }
      });
      // Store raw merchant preferences from DB settings.
      // Do NOT overwrite stored preferences with effective values that were forced off by catalog mode!
      setForm((f) => ({
        ...flat,
      }));
    });
  }, []);

  // Keep mode-locked fields aligned with the selected mode preview.
  // Note: Tier 2 stored preferences in `form` are kept intact so switching modes doesn't erase them.
  useEffect(() => {
    if (!form['general.mode']) return;

    const tier1Presets = {
      ecommerce: { pricing: true, cart: true, checkout: true, orders: true, payments: true, shipping: true },
      catalog: { pricing: false, cart: false, checkout: false, orders: false, payments: false, shipping: false }
    };

    const preset = tier1Presets[form['general.mode']];
    if (preset) {
      setForm(f => {
        const next = { ...f };
        Object.entries(preset).forEach(([k, v]) => {
          next[`features.${k}`] = v;
        });
        return next;
      });
    }
  }, [form['general.mode']]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSaveFeatures = async () => {
    if (!isSuperAdmin) {
      notify('Only superadmins can manage platform features and store mode.', 'error');
      return;
    }

    setFeatureConfirmOpen(false);
    setSaving(true);
    try {
      const tier1Keys = ['pricing', 'cart', 'checkout', 'orders', 'payments', 'shipping'];
      // Only save Tier 2 features to DB; Tier 1 keys are mode-locked on server
      const featureKeys = Object.entries(form)
        .filter(([k]) => k.startsWith('features.'))
        .map(([flatKey, value]) => ({
          group: 'features',
          key: flatKey.slice('features.'.length),
          value,
        }))
        .filter(({ key }) => !tier1Keys.includes(key));

      const visibilityKeys = Object.entries(form)
        .filter(([k]) => k.startsWith('visibility.'))
        .map(([flatKey, value]) => ({
          group: 'visibility',
          key: flatKey.slice('visibility.'.length),
          value,
        }));

      if (form['general.mode']) {
        featureKeys.push({
          group: 'general',
          key: 'mode',
          value: form['general.mode']
        });
      }

      await updateSettings([...featureKeys, ...visibilityKeys]);
      notify('Platform features saved successfully.', 'success');
      if (refreshSettings) await refreshSettings();
    } catch (e) {
      notify(
        e?.response?.data?.error?.message
          || e?.response?.data?.message
          || 'Failed to save platform features. Check your connection and try again.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight={800} gutterBottom>
          Platform Features
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Choose how your store works, then manage the features your team and customers can see.
        </Typography>
      </Box>

      {!isSuperAdmin && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>Read-Only Mode:</strong> Only Superadmins can modify Platform Features.
        </Alert>
      )}

      <Box sx={{ mb: 4 }}>
        {/* ── Mode Context Banner ── */}
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2.5, justifyContent: 'space-between' }}>
            <Box sx={{ maxWidth: '65ch' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                <Typography variant="h6" component="h2" fontWeight={700}>Store mode</Typography>
                <Chip
                  label={selectedMode === appMode ? 'Current mode' : 'Unsaved mode change'}
                  color={selectedMode === appMode ? 'default' : 'warning'}
                  size="small" variant="outlined"
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedMode === 'catalog'
                  ? 'Catalog mode lets customers browse your products. Pricing, cart, checkout, orders, payments, and shipping are turned off.'
                  : 'E-commerce mode enables pricing, cart, checkout, orders, payments, and shipping. Choose where their interfaces appear below.'}
              </Typography>
            </Box>
            {isSuperAdmin ? (
              <FormControl size="small" sx={{ minWidth: 200, alignSelf: { sm: 'center' } }}>
                <InputLabel id="store-mode-label">Store mode</InputLabel>
                <Select labelId="store-mode-label" label="Store mode" value={selectedMode}
                  onChange={(e) => set('general.mode', e.target.value)} disabled={saving}>
                  <MenuItem value="ecommerce">E-COMMERCE</MenuItem>
                  <MenuItem value="catalog">CATALOG</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Chip label={selectedMode === 'catalog' ? 'Catalog' : 'E-commerce'} sx={{ alignSelf: 'flex-start' }} />
            )}
          </Box>
          {selectedMode !== appMode && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Previewing {selectedMode === 'catalog' ? 'Catalog' : 'E-commerce'} mode. Your live store changes only after you save.
            </Alert>
          )}
        </Paper>

        {/* ── Tier 1 Capability + Visibility ── */}
        <Box component="section" aria-labelledby="core-features-heading" sx={{ mb: 4 }}>
          <Typography id="core-features-heading" variant="h6" component="h2" fontWeight={700} gutterBottom>
            Core features
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Store mode controls availability. When a feature is available, these switches only hide its interface;
            backend processing continues.
          </Typography>
          {selectedMode === 'catalog' && (
            <Alert icon={<LockOutlinedIcon fontSize="inherit" />} severity="info" sx={{ mb: 2 }}>
              These six features are locked off in Catalog mode. Switch to E-commerce to enable them.
              Your saved visibility preferences will be restored.
            </Alert>
          )}
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {[['pricing', 'Pricing'], ['cart', 'Cart'], ['checkout', 'Checkout'], ['orders', 'Orders'], ['payments', 'Payments'], ['shipping', 'Shipping']].map(([key, label]) => {
              const capabilityOn = selectedMode === 'ecommerce';
              const adminKey = `visibility.admin${key.charAt(0).toUpperCase()}${key.slice(1)}`;
              const storefrontKey = `visibility.storefront${key.charAt(0).toUpperCase()}${key.slice(1)}`;
              const adminVisible = form[adminKey] !== false;
              const storefrontVisible = form[storefrontKey] !== false;
              const effectiveAdmin = capabilityOn && adminVisible;
              const effectiveStorefront = capabilityOn && storefrontVisible;

              return (
                <Box
                  key={key}
                  sx={{ px: { xs: 2, sm: 2.5 }, py: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 1fr) minmax(360px, 1fr)' }, gap: { xs: 1, md: 3 }, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={700}>{label}</Typography>
                    {!capabilityOn && <LockOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                    <Typography variant="caption" color="text.secondary">
                      {capabilityOn ? 'Available' : 'Locked OFF in Catalog mode'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                    <FormControlLabel
                      control={<Switch inputProps={{ 'aria-label': `Show in Admin UI: ${label}` }} checked={effectiveAdmin} onChange={(e) => set(adminKey, e.target.checked)} disabled={saving || !isSuperAdmin || !capabilityOn} />}
                      label={
                        <Typography variant="body2" color="text.secondary">
                          Show in Admin UI
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      control={<Switch inputProps={{ 'aria-label': `Show in Storefront: ${label}` }} checked={effectiveStorefront} onChange={(e) => set(storefrontKey, e.target.checked)} disabled={saving || !isSuperAdmin || !capabilityOn} />}
                      label={
                        <Typography variant="body2" color="text.secondary">
                          Show in Storefront
                        </Typography>
                      }
                    />
                  </Box>
                </Box>
              );
            })}
          </Paper>
        </Box>

        {/* ── Tier 2 Toggles ── */}
        <Box component="section" aria-labelledby="optional-features-heading" sx={{ mb: 3 }}>
          <Typography id="optional-features-heading" variant="h6" component="h2" fontWeight={700} gutterBottom>Optional features</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Choose the tools available to your team and customers. Some options require E-commerce mode
            or another feature to be enabled. Turning a feature off hides its interface; authorized staff
            can still access historical records through the API.
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {platformFeatures.optional.map(({ key: featureKey, label, description: desc, defaults }) => ({
              key: `features.${featureKey}`, label, desc,
              defaultE: defaults.ecommerce, defaultC: defaults.catalog,
            })).map(({ key, label, desc, defaultE, defaultC }) => {
              const modeDefault = selectedMode === 'catalog' ? defaultC : defaultE;
              const isCatalog = selectedMode === 'catalog';

              let isEffectiveLockedOff = false;
              let lockReason = null;

              if (key === 'features.showPrice' && isCatalog) {
                isEffectiveLockedOff = true;
                lockReason = 'Locked OFF in Catalog mode (Pricing is disabled)';
              } else if (key === 'features.coupons' && isCatalog) {
                isEffectiveLockedOff = true;
                lockReason = 'Locked OFF in Catalog mode (Cart & Checkout disabled)';
              } else if (key === 'features.guestCheckout' && isCatalog) {
                isEffectiveLockedOff = true;
                lockReason = 'Locked OFF in Catalog mode (Checkout disabled)';
              } else if (key === 'features.requirePurchaseForReview') {
                if (isCatalog) {
                  isEffectiveLockedOff = true;
                  lockReason = 'Locked OFF in Catalog mode (Orders disabled)';
                } else if (!Boolean(form['features.reviews'])) {
                  isEffectiveLockedOff = true;
                  lockReason = 'Requires Reviews ON';
                }
              } else if (key === 'features.showAvailableCoupons') {
                if (isCatalog) {
                  isEffectiveLockedOff = true;
                  lockReason = 'Locked OFF in Catalog mode (Cart disabled)';
                } else if (!Boolean(form['features.coupons'])) {
                  isEffectiveLockedOff = true;
                  lockReason = 'Requires Coupons ON';
                }
              }

              const isDisabled = saving || isEffectiveLockedOff || !isSuperAdmin;
              const isChecked = isEffectiveLockedOff ? false : (form[key] !== undefined ? Boolean(form[key]) : Boolean(modeDefault));
              const isIndented = key === 'features.requirePurchaseForReview' || key === 'features.showAvailableCoupons';

              return (
                <Box
                  key={key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: { xs: 2, sm: 2.5 },
                    py: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 0 },
                    pl: isIndented ? { xs: 3, sm: 5 } : { xs: 2, sm: 2.5 },
                    bgcolor: isEffectiveLockedOff ? 'action.hover' : 'transparent'
                  }}
                >
                  <Box id={`${key}-description`} sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight={700}>{label}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">{desc}</Typography>
                    {lockReason ? (
                      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', mt: 0.75, color: 'text.secondary' }}>
                        <LockOutlinedIcon sx={{ fontSize: 16, mt: 0.15, flexShrink: 0 }} />
                        <Typography variant="caption">{lockReason}</Typography>
                      </Box>
                    ) : modeDefault !== null ? (
                      <Typography variant="caption" color="text.secondary">
                        Mode default: {modeDefault ? 'On' : 'Off'}
                      </Typography>
                    ) : null}
                  </Box>
                  <Switch
                    checked={isChecked}
                    onChange={(e) => set(key, e.target.checked)}
                    disabled={isDisabled}
                    inputProps={{ 'aria-label': label, 'aria-describedby': `${key}-description` }}
                    sx={{ flexShrink: 0 }}
                  />
                </Box>
              );
            })}
          </Paper>
        </Box>

        <Paper variant="outlined" sx={{ position: 'sticky', bottom: 16, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="body2" color="text.secondary">Changes apply to your store after you save.</Typography>
          <Button
            variant="contained"
            disabled={saving || !isSuperAdmin}
            onClick={() => setFeatureConfirmOpen(true)}
            sx={{ fontWeight: 700, px: 4 }}
          >
            {saving ? 'Saving…' : 'Save Platform Features'}
          </Button>
        </Paper>
      </Box>

      {/* ── Platform Features Confirmation Dialog ── */}
      <Dialog open={featureConfirmOpen} onClose={() => setFeatureConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Feature Changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            These changes will affect <strong>all storefront visitors and admin users immediately</strong>.
            Store mode controls core feature availability. Visibility switches hide interfaces for enabled
            features without stopping backend processing. Saved preferences are preserved across mode changes.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action requires Superadmin privileges. Any unauthorized request will be rejected by the server.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="error" onClick={() => setFeatureConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleSaveFeatures} sx={{ fontWeight: 700 }}>
            Yes, Save Features
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeaturesPage;
