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
      // Store raw merchant preferences from DB settings.
      // Do NOT overwrite stored preferences with effective values that were forced off by catalog mode!
      setForm((f) => ({
        ...flat,
      }));
    });
  }, []);

  // Reactive Mode Preview: Update Tier 1 dots when mode changes in dropdown.
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
        <Typography variant="h4" component="h1" fontWeight={800} gutterBottom>
          Platform Features
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure the core operational mode and every optional feature of your platform.
          This page is the single control point for feature switches; related settings panels
          link back here.
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
            The store mode controls Tier 1 backend capability (pricing, cart, checkout, orders, payments, shipping)
            and cannot be changed on this page except through the mode selector. The visibility switches below are
            presentation-only: <strong>hides the interface; backend processing continues.</strong> Visibility can
            never turn on a capability that the mode disables.
          </Typography>
        </Alert>

        {/* ── Tier 1 Capability + Visibility ── */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Tier 1 — Mode-Locked Capability + Visibility
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The mode controls whether the backend capability is available. The two switches control whether its
            interface is shown in the admin and on the storefront. <strong>Hides the interface; backend processing
            continues.</strong> Stored visibility preferences are preserved when the mode changes.
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {[['pricing', 'Pricing'], ['cart', 'Cart'], ['checkout', 'Checkout'], ['orders', 'Orders'], ['payments', 'Payments'], ['shipping', 'Shipping']].map(([key, label]) => {
              const capabilityOn = Boolean(form[`features.${key}`]);
              const adminKey = `visibility.admin${key.charAt(0).toUpperCase()}${key.slice(1)}`;
              const storefrontKey = `visibility.storefront${key.charAt(0).toUpperCase()}${key.slice(1)}`;
              const adminVisible = form[adminKey] !== false;
              const storefrontVisible = form[storefrontKey] !== false;
              const effectiveAdmin = capabilityOn && adminVisible;
              const effectiveStorefront = capabilityOn && storefrontVisible;

              return (
                <Box
                  key={key}
                  sx={{ p: 1.75, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: capabilityOn ? 'success.main' : 'error.light', flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={700}>{label}</Typography>
                    <Chip
                      label={capabilityOn ? 'Mode: ON' : 'Mode: OFF'}
                      size="small"
                      color={capabilityOn ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ height: 18, fontSize: 9, fontWeight: 700 }}
                    />
                    {!capabilityOn && (
                      <Chip
                        label="Hidden regardless of visibility"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ height: 18, fontSize: 9, fontWeight: 700 }}
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <FormControlLabel
                      control={<Switch size="small" checked={adminVisible} onChange={(e) => set(adminKey, e.target.checked)} disabled={!isSuperAdmin} />}
                      label={
                        <Typography variant="caption" color="text.secondary">
                          Show in Admin UI {effectiveAdmin ? '' : '(hidden)'}
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      control={<Switch size="small" checked={storefrontVisible} onChange={(e) => set(storefrontKey, e.target.checked)} disabled={!isSuperAdmin} />}
                      label={
                        <Typography variant="caption" color="text.secondary">
                          Show in Storefront {effectiveStorefront ? '' : '(hidden)'}
                        </Typography>
                      }
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>

        {/* ── Tier 2 Toggles ── */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Tier 2 — Optional Features</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            These features can be enabled or disabled regardless of the store mode.
            Default values differ per mode — the badge shows the mode&apos;s default.
            When OFF, related admin navigation, form controls, and storefront UI are hidden.
            Authorized staff API access to historical records is preserved.
          </Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            {[
              { key: 'features.wishlist', label: 'Wishlist', desc: 'Allow users to save products to a wishlist.', defaultE: true, defaultC: true },
              { key: 'features.reviews', label: 'Product Reviews', desc: 'Enable customer reviews on product pages.', defaultE: true, defaultC: true },
              { key: 'features.requirePurchaseForReview', label: 'Verified Purchase Reviews', desc: 'Only allow reviews from customers who bought the product.', defaultE: false, defaultC: false },
              { key: 'features.enquiry', label: 'Enquire Now Button', desc: 'Show an enquiry button on the product detail page.', defaultE: false, defaultC: true },
              { key: 'features.coupons', label: 'Coupons & Discounts', desc: 'Enable coupon codes at checkout.', defaultE: true, defaultC: false },
              { key: 'features.guestCheckout', label: 'Guest Checkout', desc: 'Allow customers to checkout without creating an account.', defaultE: true, defaultC: false },
              { key: 'features.emailVerification', label: 'Email Verification', desc: 'Require email confirmation after registration.', defaultE: false, defaultC: false },
              { key: 'features.showAvailableCoupons', label: 'Show Available Coupons', desc: 'Display applicable coupon codes on the cart page.', defaultE: true, defaultC: false },
              { key: 'features.showPrice', label: 'Show Product Prices', desc: 'Control whether prices are displayed on the storefront.', defaultE: true, defaultC: false },
              { key: 'features.productAssistant', label: 'AI Product Assistant', desc: 'Show the AI product creation assistant on product forms.', defaultE: true, defaultC: true },
              { key: 'features.brands', label: 'Brands', desc: 'Show brand pages, brand navigation, brand filters, and brand details on products.', defaultE: true, defaultC: true },
              { key: 'features.themes', label: 'Store Themes', desc: 'Enable the theme gallery and store designer tools.', defaultE: true, defaultC: true },
              { key: 'features.seo', label: 'SEO Features', desc: 'Enable storefront SEO metadata, sitemap, robots, and URL overrides.', defaultE: true, defaultC: true },
              { key: 'features.apiBuilder', label: 'API Builder', desc: 'Allow admins to publish custom public API endpoints.', defaultE: true, defaultC: true },
            ].map(({ key, label, desc, defaultE, defaultC }) => {
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

              const isDisabled = isEffectiveLockedOff || !isSuperAdmin;
              const isChecked = isEffectiveLockedOff ? false : (form[key] !== undefined ? Boolean(form[key]) : Boolean(modeDefault));
              const isIndented = key === 'features.requirePurchaseForReview' || key === 'features.showAvailableCoupons';

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
                    opacity: isEffectiveLockedOff ? 0.65 : 1,
                    ml: isIndented ? 4 : 0,
                    bgcolor: isEffectiveLockedOff ? 'action.hover' : 'transparent'
                  }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight={700}>{label}</Typography>
                      {modeDefault !== null && (
                        <Chip
                          label={`Default: ${modeDefault ? 'ON' : 'OFF'}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 9, fontWeight: 700, color: 'text.secondary' }}
                        />
                      )}
                      {lockReason && (
                        <Chip
                          label={lockReason}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 9, fontWeight: 700 }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">{desc}</Typography>
                  </Box>
                  <Switch
                    checked={isChecked}
                    onChange={(e) => set(key, e.target.checked)}
                    disabled={isDisabled}
                    size="small"
                  />
                </Box>
              );
            })}
          </Box>
        </Paper>

        {/* ── Declared but not implemented ── */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Not Implemented — No Switch
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            These keys exist in the feature configuration but have no underlying behaviour yet.
            They are intentionally omitted from the toggles so they are never presented as working features.
          </Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {[
              { key: 'multiCurrency', desc: 'Needs multi-currency pricing, per-currency formatting, and exchange-rate handling.' },
              { key: 'socialLogin', desc: 'Needs OAuth providers, account linking, and callback routes.' },
            ].map(({ key, desc }) => (
              <Box
                key={key}
                sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 1.25, border: '1px dashed', borderColor: 'divider', borderRadius: 1.5 }}
              >
                <Chip label="UNIMPLEMENTED" size="small" sx={{ height: 18, fontSize: 9, fontWeight: 700 }} />
                <Box>
                  <Typography variant="body2" fontWeight={700} component="span" sx={{ mr: 1 }}>{key}</Typography>
                  <Typography variant="caption" color="text.secondary">{desc}</Typography>
                </Box>
              </Box>
            ))}
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
            These changes will affect <strong>all storefront visitors and admin users immediately</strong>.
            Optional features hide their UI when OFF. Tier 1 visibility switches only hide the interface;
            backend processing continues and stored preferences are preserved across mode changes.
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
