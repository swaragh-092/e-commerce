import { useState, useEffect, useContext } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  TextField,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Button,
  Divider,
  Grid,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import { updateSettings } from '../../services/adminService';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';

const CURRENCIES = [
  { code: 'USD', symbol: '$',  name: 'US Dollar' },
  { code: 'INR', symbol: '₹',  name: 'Indian Rupee' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'GBP', symbol: '£',  name: 'British Pound' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese Yen' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'BDT', symbol: '৳',  name: 'Bangladeshi Taka' },
  { code: 'PKR', symbol: '₨',  name: 'Pakistani Rupee' },
];

const getCurrencySymbol = (code) =>
  CURRENCIES.find((c) => c.code === code)?.symbol || code || '$';

const FONTS = [
  'Roboto',
  'Inter',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Source Sans Pro',
  'Ubuntu',
  'IBM Plex Sans',
  'Work Sans',
  'Quicksand',
  'Raleway',
];

const SettingsPage = () => {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const notify = useNotification();
  const { refreshSettings } = useContext(SettingsContext) || {};

  useEffect(() => {
    api.get('/settings').then((res) => {
      // Flatten { group: { key: value } } → { 'group.key': value }
      const raw = res.data.data || {};
      const flat = {};
      Object.entries(raw).forEach(([group, keys]) => {
        if (typeof keys === 'object') {
          Object.entries(keys).forEach(([k, v]) => {
            flat[`${group}.${k}`] = v;
          });
        }
      });
      setForm(flat);
    });
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(form).map(([flatKey, value]) => {
        const [group, ...keyParts] = flatKey.split('.');
        return { group, key: keyParts.join('.'), value };
      });
      await updateSettings(payload);
      notify('Settings saved successfully.', 'success');
      // Refresh theme settings in real-time
      if (refreshSettings) {
        await refreshSettings();
      }
    } catch (e) {
      notify('Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const tabs = ['Theme', 'Features', 'Shipping', 'Tax', 'SEO', 'General'];

  // Current currency symbol — used in shipping adornments
  const currSymbol = getCurrencySymbol(form['general.currency']);
  const field = (key, label, type = 'text', extra = {}) => (
    <TextField
      key={key}
      fullWidth
      size="small"
      label={label}
      type={type}
      value={form[key] ?? ''}
      onChange={(e) => set(key, e.target.value)}
      sx={{ mb: 2 }}
      {...extra}
    />
  );

  const toggle = (key, label) => (
    <FormControlLabel
      key={key}
      control={<Switch checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} />}
      label={label}
      sx={{ mb: 1 }}
    />
  );

  const panels = [
    /* Theme */
    <Box key="theme">
      <FormControlLabel
        control={
          <Switch
            checked={form['theme.mode'] === 'dark'}
            onChange={(e) => set('theme.mode', e.target.checked ? 'dark' : 'light')}
          />
        }
        label="Dark Mode"
        sx={{ mb: 2, display: 'block' }}
      />
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          {field('theme.primaryColor', 'Primary Color', 'color')}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('theme.secondaryColor', 'Secondary Color', 'color')}
        </Grid>
        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={FONTS}
            value={form['theme.fontFamily'] || ''}
            onChange={(e, value) => set('theme.fontFamily', value || '')}
            freeSolo
            renderInput={(params) => <TextField {...params} label="Font Family" size="small" sx={{ mb: 2 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('theme.borderRadius', 'Border Radius')}
        </Grid>
      </Grid>
    </Box>,

    /* Features */
    <Box key="features" sx={{ display: 'flex', flexDirection: 'column' }}>
      {toggle('features.wishlist', 'Wishlist')}
      {toggle('features.reviews', 'Reviews')}
      {toggle('features.coupons', 'Coupons')}
      {toggle('features.requirePurchaseForReview', 'Require purchase to review')}
      {toggle('features.requireEmailVerification', 'Require email verification')}
    </Box>,

    /* Shipping */
    <Box key="shipping">
      {field('shipping.method', 'Shipping Method')}
      {field('shipping.flatRate', `Flat Rate (${currSymbol})`, 'number', {
        InputProps: { startAdornment: <InputAdornment position="start">{currSymbol}</InputAdornment> },
      })}
      {field('shipping.freeThreshold', `Free Shipping Above (${currSymbol})`, 'number', {
        InputProps: { startAdornment: <InputAdornment position="start">{currSymbol}</InputAdornment> },
      })}
    </Box>,

    /* Tax */
    <Box key="tax">
      {field('tax.rate', 'Tax Rate (e.g. 0.18 for 18%)', 'number')}
      {toggle('tax.inclusive', 'Prices include tax')}
    </Box>,

    /* SEO */
    <Box key="seo">
      {field('seo.siteName', 'Site Name')}
      {field('seo.metaDescription', 'Meta Description')}
      {field('seo.googleAnalyticsId', 'Google Analytics ID')}
    </Box>,

    /* General */
    <Box key="general">
      {field('general.storeName', 'Store Name')}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Currency</InputLabel>
        <Select
          label="Currency"
          value={form['general.currency'] || 'USD'}
          onChange={(e) => set('general.currency', e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <MenuItem key={c.code} value={c.code}>
              {c.symbol}&nbsp;&nbsp;{c.name} ({c.code})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {field('general.timezone', 'Time Zone')}
      {field('general.contactEmail', 'Contact Email', 'email')}
    </Box>,
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Settings
        </Typography>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save All'}
        </Button>
      </Box>

      <Paper
        elevation={0}
        sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {tabs.map((t) => (
            <Tab key={t} label={t} />
          ))}
        </Tabs>
        <Divider />
        <Box sx={{ p: 3 }}>{panels[tab]}</Box>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
