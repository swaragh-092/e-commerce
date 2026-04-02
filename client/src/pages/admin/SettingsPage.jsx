import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Tab, Tabs, TextField, Switch, FormControlLabel,
  Slider, Button, Alert, Divider, Grid, InputAdornment,
} from '@mui/material';
import { updateSettings } from '../../services/adminService';
import api from '../../services/api';

const SettingsPage = () => {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    api.get('/settings').then((res) => {
      // Flatten { group: { key: value } } → { 'group.key': value }
      const raw = res.data.data || {};
      const flat = {};
      Object.entries(raw).forEach(([group, keys]) => {
        if (typeof keys === 'object') {
          Object.entries(keys).forEach(([k, v]) => { flat[`${group}.${k}`] = v; });
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
      setAlert({ type: 'success', msg: 'Settings saved successfully.' });
    } catch (e) {
      setAlert({ type: 'error', msg: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = ['Theme', 'Features', 'Shipping', 'Tax', 'SEO', 'General'];

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
      control={
        <Switch
          checked={Boolean(form[key])}
          onChange={(e) => set(key, e.target.checked)}
        />
      }
      label={label}
      sx={{ mb: 1 }}
    />
  );

  const panels = [
    /* Theme */
    <Box key="theme">
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>{field('theme.primaryColor', 'Primary Color', 'color')}</Grid>
        <Grid item xs={12} sm={6}>{field('theme.secondaryColor', 'Secondary Color', 'color')}</Grid>
        <Grid item xs={12} sm={6}>{field('theme.fontFamily', 'Font Family')}</Grid>
        <Grid item xs={12} sm={6}>{field('theme.borderRadius', 'Border Radius')}</Grid>
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
      {field('shipping.flatRate', 'Flat Rate ($)', 'number', { InputProps: { startAdornment: <InputAdornment position="start">$</InputAdornment> } })}
      {field('shipping.freeThreshold', 'Free Shipping Above ($)', 'number', { InputProps: { startAdornment: <InputAdornment position="start">$</InputAdornment> } })}
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
      {field('general.currency', 'Currency (e.g. USD)')}
      {field('general.timezone', 'Time Zone')}
      {field('general.contactEmail', 'Contact Email', 'email')}
    </Box>,
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Settings</Typography>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save All'}
        </Button>
      </Box>

      {alert && <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.msg}</Alert>}

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {tabs.map((t) => <Tab key={t} label={t} />)}
        </Tabs>
        <Divider />
        <Box sx={{ p: 3 }}>
          {panels[tab]}
        </Box>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
