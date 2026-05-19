import { useState, useEffect, useContext } from 'react';
import {
  Alert,
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  FormControl,
  Select,
  MenuItem,
  Button,
  Divider,
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
import { useAuth, useIsSuperAdmin } from '../../hooks/useAuth';
import { useMode } from '../../hooks/useSettings';
import { PERMISSIONS } from '../../utils/permissions';

const FeaturesPage = () => {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { notify } = useNotification();
  const { refreshSettings, features: resolvedFeatures } = useContext(SettingsContext) || {};
  const { hasPermission } = useAuth();
  const appMode = useMode();
  const selectedMode = form['general.mode'] || appMode;
  const isSuperAdmin = useIsSuperAdmin();
  const canManageSettings = hasPermission(PERMISSIONS.SETTINGS_MANAGE);
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
      setForm((f) => ({
        ...flat,
        ...Object.fromEntries(
          Object.entries(resolvedFeatures || {}).map(([k, v]) => [`features.${k}`, v])
        ),
      }));
    });
  }, [resolvedFeatures]);

  // Reactive Mode Preview: Update Tier 1 dots when mode changes in dropdown
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
    if (!canManageSettings) {
      notify('You do not have permission to manage features.', 'error');
      return;
    }

    setFeatureConfirmOpen(false);
    setSaving(true);
    try {
      const featureKeys = Object.entries(form)
        .filter(([k]) => k.startsWith('features.'))
        .map(([flatKey, value]) => ({
          group: 'features',
          key: flatKey.slice('features.'.length),
          value,
        }));

      if (form['general.mode']) {
        featureKeys.push({
          group: 'general',
          key: 'mode',
          value: form['general.mode']
        });
      }

      await updateSettings(featureKeys);
      notify('Platform features saved successfully.', 'success');
      if (refreshSettings) await refreshSettings();
    } catch (e) {
      notify(
        e?.response?.data?.message || 'Failed to save features. Superadmin access required.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key, label) => (
    <FormControlLabel
      key={key}
      control={<Switch checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} />}
      label={label}
      sx={{ mb: 1 }}
    />
  );

  const lockedToggle = (key, label, currentValue) => (
    <Box key={key} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1.5, opacity: 0.65 }}>
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(currentValue)}
            disabled
            sx={{ '& .MuiSwitch-thumb': { bgcolor: 'action.disabled' } }}
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Box
              component="span"
              sx={{
                px: 1, py: 0.2, borderRadius: 1, fontSize: 10, fontWeight: 700,
                bgcolor: 'action.selected', color: 'text.secondary',
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}
            >
              {appMode} mode • locked
            </Box>
          </Box>
        }
        sx={{ mb: 0 }}
      />
    </Box>
  );

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Platform Features
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure the core operational mode and optional features of your platform.
        </Typography>
      </Box>

      {!isSuperAdmin && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>Read-Only Mode:</strong> Only Superadmins can modify Platform Features.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, mb: 4 }}>
        {/* ── Mode Context Banner ── */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" fontWeight={700}>
              Current Mode: <Box component="span" sx={{ textTransform: 'uppercase', fontWeight: 900 }}>{selectedMode}</Box>
              {selectedMode === appMode ? (
                 <Chip label="DB" size="small" sx={{ height: 18, ml: 1, fontSize: 10, fontWeight: 700 }} />
              ) : (
                 <Chip label="PREVIEW" color="warning" size="small" sx={{ height: 18, ml: 1, fontSize: 10, fontWeight: 700 }} />
              )}
            </Typography>
            {isSuperAdmin && (
               <FormControl size="small" sx={{ minWidth: 150 }}>
                 <Select 
                   value={form['general.mode'] || appMode} 
                   onChange={(e) => set('general.mode', e.target.value)} 
                   sx={{ height: 30, bgcolor: 'background.paper', fontSize: '0.8rem' }}
                 >
                   <MenuItem value="ecommerce">E-COMMERCE</MenuItem>
                   <MenuItem value="catalog">CATALOG</MenuItem>
                 </Select>
               </FormControl>
            )}
          </Box>
          <Typography variant="body2">
            The store mode is set in the database and controls Tier 1 core features (pricing, cart, checkout, orders, payments, shipping).
            These are locked to the mode and cannot be toggled here.
            Only the optional Tier 2 features below are controllable independently.
          </Typography>
        </Alert>

        {/* ── Tier 1 Read-Only Reference ── */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Tier 1 — Mode-Locked Features
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These features are determined by the active <code>APP_MODE</code> and cannot be changed from the UI.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1 }}>
            {[['pricing', 'Pricing'], ['cart', 'Cart'], ['checkout', 'Checkout'], ['orders', 'Orders'], ['payments', 'Payments'], ['shipping', 'Shipping']].map(([key, label]) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, opacity: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: form[`features.${key}`] ? 'success.main' : 'error.light', flexShrink: 0 }} />
                <Typography variant="body2" fontWeight={600}>{label}</Typography>
                <Chip label="Locked" size="small" sx={{ ml: 'auto', height: 16, fontSize: 9, fontWeight: 700 }} />
              </Box>
            ))}
          </Box>
        </Paper>

        {/* ── Tier 2 Toggles ── */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Tier 2 — Optional Features</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            These features can be enabled or disabled regardless of the store mode.
            Default values differ per mode — the badge shows the mode&apos;s default.
          </Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            {[
              { key: 'features.wishlist', label: 'Wishlist', desc: 'Allow users to save products to a wishlist.', defaultE: true, defaultC: true },
              { key: 'features.reviews', label: 'Product Reviews', desc: 'Enable customer reviews on product pages.', defaultE: true, defaultC: true },
              { key: 'features.requirePurchaseForReview', label: 'Verified Purchase Reviews', desc: 'Only allow reviews from customers who bought the product.', defaultE: false, defaultC: false },
              { key: 'features.enquiry', label: 'Enquire Now Button', desc: 'Show an enquiry button on the product detail page.', defaultE: false, defaultC: true },
              { key: 'features.coupons', label: 'Coupons & Discounts', desc: 'Enable coupon codes at checkout.', defaultE: true, defaultC: false },
              { key: 'features.guestCheckout', label: 'Guest Checkout', desc: 'Allow purchasing without creating an account.', defaultE: true, defaultC: null },
              { key: 'features.socialLogin', label: 'Social Login (OAuth)', desc: 'Enable Google / OAuth login providers.', defaultE: false, defaultC: false },
              { key: 'features.emailVerification', label: 'Email Verification', desc: 'Require email confirmation after registration.', defaultE: false, defaultC: false },
              { key: 'features.showAvailableCoupons', label: 'Show Available Coupons', desc: 'Display applicable coupon codes on the cart page.', defaultE: true, defaultC: false },
              { key: 'features.multiCurrency', label: 'Multi-Currency', desc: 'Support multiple display currencies (experimental).', defaultE: false, defaultC: false },
              { key: 'features.showPrice', label: 'Show Product Prices', desc: 'Control whether prices are displayed on the storefront.', defaultE: true, defaultC: false },
            ].filter(item => {
              if (item.key === 'features.requirePurchaseForReview' && appMode === 'catalog') return false;
              return true;
            }).map(({ key, label, desc, defaultE, defaultC }) => {
              const modeDefault = selectedMode === 'catalog' ? defaultC : defaultE;
              const isNA = key === 'features.guestCheckout' && selectedMode === 'catalog';
              const isDependent = key === 'features.requirePurchaseForReview';
              const parentDisabled = isDependent && !Boolean(form['features.reviews']);
              
              return (
                <Box 
                  key={key} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: 2, 
                    p: 1.75, 
                    border: '1px solid', 
                    borderColor: 'divider', 
                    borderRadius: 2, 
                    opacity: (isNA || parentDisabled) ? 0.45 : 1,
                    ml: isDependent ? 4 : 0,
                    bgcolor: isDependent ? 'action.hover' : 'transparent'
                  }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography variant="body2" fontWeight={700}>{label}</Typography>
                      {modeDefault !== null && (
                        <Chip
                          label={`Default: ${modeDefault ? 'ON' : 'OFF'}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 9, fontWeight: 700, color: 'text.secondary' }}
                        />
                      )}
                      {isNA && <Chip label="N/A — checkout disabled" size="small" sx={{ height: 18, fontSize: 9, bgcolor: 'action.selected' }} />}
                      {isDependent && parentDisabled && <Chip label="Requires Reviews ON" size="small" sx={{ height: 18, fontSize: 9, bgcolor: 'action.selected' }} />}
                    </Box>
                    <Typography variant="caption" color="text.secondary">{desc}</Typography>
                  </Box>
                  <Switch
                    checked={Boolean(form[key])}
                    onChange={(e) => set(key, e.target.checked)}
                    disabled={isNA || parentDisabled || !isSuperAdmin}
                    size="small"
                  />
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
          <Button
            variant="contained"
            color="warning"
            disabled={saving || !isSuperAdmin}
            onClick={() => setFeatureConfirmOpen(true)}
            sx={{ fontWeight: 700, px: 4 }}
          >
            {saving ? 'Saving…' : 'Save Platform Features'}
          </Button>
        </Box>
      </Paper>

      {/* ── Platform Features Confirmation Dialog ── */}
      <Dialog open={featureConfirmOpen} onClose={() => setFeatureConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Feature Changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            These changes will affect <strong>all storefront visitors immediately</strong>.
            Enabling or disabling features like reviews, wishlist, or enquiry will change
            what customers see without any cache delay.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action requires Superadmin privileges. Any unauthorized request will be rejected by the server.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFeatureConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleSaveFeatures} sx={{ fontWeight: 700 }}>
            Yes, Save Features
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeaturesPage;
