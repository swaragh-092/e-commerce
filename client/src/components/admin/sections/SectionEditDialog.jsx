import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, FormControl, InputLabel, Select, MenuItem, Stack, Typography,
} from '@mui/material';
import { getSectionLabel, SECTION_VARIANTS, getSectionDefinition } from '../../storefront/sections/sectionRegistry';

const PRODUCT_SOURCES = [
  { value: 'featured', label: 'Featured' },
  { value: 'sale', label: 'On Sale' },
  { value: 'bestSellers', label: 'Best Sellers' },
  { value: 'newest', label: 'Newest' },
  { value: 'recommended', label: 'Recommended' },
];

const SectionEditDialog = ({ open, section, onClose, onSave }) => {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (section) setForm({ ...section });
  }, [section]);

  if (!section) return null;

  const variants = SECTION_VARIANTS[section.type] || [];
  const isProductRow = section.type === 'product-row';
  const isCountdown = section.type === 'countdown-sale';
  const isNewsletter = section.type === 'newsletter-signup';
  const isHero = section.type === 'hero-carousel';
  const hasCategories = section.type === 'category-shortcuts' || section.type === 'featured-collection-grid';
  const hasCtaLink = isCountdown || section.type === 'editorial-image-text' || section.type === 'promo-banners';

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit: {getSectionLabel(section)}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Title" value={form.title || ''} onChange={(e) => set('title', e.target.value)} size="small" fullWidth />
          <TextField label="Subtitle" value={form.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} size="small" fullWidth />

          {variants.length > 0 && (
            <FormControl size="small" fullWidth>
              <InputLabel>Variant</InputLabel>
              <Select value={form.variant || ''} label="Variant" onChange={(e) => set('variant', e.target.value)}>
                <MenuItem value="">Default</MenuItem>
                {variants.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {isCountdown && (
            <>
              <TextField
                label="End Date & Time"
                type="datetime-local"
                value={form.endDate ? form.endDate.slice(0, 16) : ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    set('endDate', '');
                    set('endDateTimezone', '');
                    return;
                  }
                  const utcIso = new Date(e.target.value).toISOString();
                  set('endDate', utcIso);
                  set('endDateTimezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
                }}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Countdown will auto-hide after this date"
              />
              <TextField label="CTA Link" value={form.ctaLink || ''} onChange={(e) => set('ctaLink', e.target.value)} size="small" fullWidth placeholder="/products?onSale=true" helperText="Where users go when they click the countdown" />
              <TextField label="CTA Text" value={form.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} size="small" fullWidth placeholder="Shop Sale" />
            </>
          )}

          {isNewsletter && (
            <TextField label="Button Text" value={form.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} size="small" fullWidth placeholder="Subscribe" />
          )}

          {hasCtaLink && !isCountdown && (
            <>
              <TextField label="CTA Link" value={form.ctaLink || ''} onChange={(e) => set('ctaLink', e.target.value)} size="small" fullWidth placeholder="/products?featured=true" />
              <TextField label="CTA Text" value={form.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} size="small" fullWidth placeholder="Shop Now" />
            </>
          )}

          {isProductRow && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Product Source</InputLabel>
                <Select value={form.source || 'featured'} label="Product Source" onChange={(e) => set('source', e.target.value)}>
                  {PRODUCT_SOURCES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Count" type="number" value={form.count || 8} onChange={(e) => set('count', parseInt(e.target.value) || 8)} size="small" fullWidth inputProps={{ min: 1, max: 24 }} />
              <TextField label="View All Link" value={form.viewAllLink || ''} onChange={(e) => set('viewAllLink', e.target.value)} size="small" fullWidth placeholder="/products?featured=true" />
            </>
          )}

          {hasCategories && (
            <TextField label="Count" type="number" value={form.count || 10} onChange={(e) => set('count', parseInt(e.target.value) || 10)} size="small" fullWidth inputProps={{ min: 1, max: 16 }} />
          )}

          {isHero && (
            <TextField label="Auto-play interval (ms)" type="number" value={form.interval || 6500} onChange={(e) => set('interval', parseInt(e.target.value) || 6500)} size="small" fullWidth inputProps={{ min: 1000, max: 30000, step: 500 }} />
          )}

          <Typography variant="caption" color="text.secondary">
            Section ID: {form.id} • Type: {form.type}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SectionEditDialog;
