import { useState } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, Popover, Stack, TextField, Typography,
} from '@mui/material';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import { SECTION_DEFINITIONS, SECTION_VARIANTS } from '../../storefront/sections/sectionRegistry';
import { createDefaultSection, getSectionPresetGallery, SECTION_PRESET_GOALS } from '../../../utils/sectionPresets';

const productChoices = [
  { key: 'products-most-viewed', label: 'Most Viewed', source: 'mostViewed', link: '/products?sort=most-viewed' },
  { key: 'products-trending', label: 'Trending This Week', source: 'trending', link: '/products?sort=trending' },
  { key: 'products-staff-picks', label: 'Staff Picks', source: 'staffPicks', link: '' },
  { key: 'products-best-sellers', label: 'Best Sellers', source: 'bestSellers', link: '/products?sort=best-selling' },
  { key: 'products-featured', label: 'Featured Products', source: 'featured', link: '/products?featured=true' },
  { key: 'products-newest', label: 'New Arrivals', source: 'newest', link: '/products?sort=newest' },
  { key: 'products-sale', label: 'On Sale', source: 'sale', link: '/products?onSale=true' },
].map((choice) => ({
  ...choice,
  type: 'product-row',
  family: 'merchandising',
  goal: 'merchandising',
  variant: 'carousel',
  description: choice.source === 'featured'
    ? 'Show hand-picked featured products.'
    : choice.source === 'staffPicks' ? 'Choose and order the products in this row.'
      : `Show ${choice.label.toLowerCase()} products in a carousel or grid.`,
}));

const sectionOptions = Object.entries(SECTION_DEFINITIONS)
  .filter(([type, def]) => def.family !== 'system')
  .map(([type, def]) => ({
    type,
    label: def.label,
    goal: def.family,
  }));

const generateId = (type, existingIds) => {
  const base = type;
  let id = base;
  let i = 2;
  while (existingIds.includes(id)) { id = `${base}-${i}`; i++; }
  return id;
};

const AddSectionDialog = ({ open, anchorEl, onClose, onAdd, existingIds = [], sectionPresets = {}, allowedTypes, insertLabel = 'this template' }) => {
  const [query, setQuery] = useState('');
  const gallery = new Map(getSectionPresetGallery(sectionPresets).map((preset) => [preset.type, preset]));
  const options = [...productChoices, ...sectionOptions.flatMap((option) => {
    const preset = gallery.get(option.type) || option;
    return [preset, ...(SECTION_VARIANTS[option.type] || []).filter((variant) => variant !== preset.variant).map((variant) => ({
      ...preset,
      key: `${option.type}:${variant}`,
      label: `${preset.label}: ${variant.replaceAll('-', ' ')}`,
      variant,
    }))];
  })];
  const groups = new Map();
  const search = query.trim().toLowerCase();
  options.forEach((option) => {
    if (allowedTypes && !allowedTypes.includes(option.type)) return;
    if (![option.label, option.title, option.variant, option.description].some((value) => String(value || '').toLowerCase().includes(search))) return;
    const group = SECTION_PRESET_GOALS.find(({ value }) => value === option.goal)?.label || 'Sections';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(option);
  });

  const handleAdd = (option) => {
    const section = createDefaultSection(option.type, {
      variant: option.variant,
      sectionPresets,
    });
    // A reusable preset must not override the ID allocated for this instance.
    section.id = generateId(option.type, existingIds);
    setQuery('');
    onAdd(option.source ? {
      ...section,
      source: option.source,
      title: option.label,
      subtitle: '',
      viewAllLink: option.link,
      dataSourceSlug: '',
      query: {},
      saleLabel: '',
    } : section);
  };

  const handleClose = () => { setQuery(''); onClose(); };
  const content = <Stack spacing={1} sx={{ p: 1 }}>
    <TextField autoFocus size="small" label="Search sections" value={query} onChange={(event) => setQuery(event.target.value)} />
    <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>Insert in {insertLabel}</Typography>
    <Box sx={{ maxHeight: 'min(52vh, 420px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
      {groups.size === 0 && <Typography role="status" variant="body2" sx={{ p: 1 }}>No matching sections</Typography>}
      {[...groups].map(([group, choices]) => <Box component="section" aria-label={group} key={group} sx={{ py: 0.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography component="h3" variant="caption" fontWeight={700} sx={{ px: 1 }}>{group}</Typography>
        {choices.map((option) => <Button key={option.key || option.type} fullWidth color="inherit" size="small"
          title={option.description} onClick={() => handleAdd(option)} startIcon={<DashboardCustomizeOutlinedIcon />}
          sx={{ justifyContent: 'flex-start', textTransform: 'none', textAlign: 'left' }}>
          {option.label}
        </Button>)}
      </Box>)}
    </Box>
  </Stack>;

  if (anchorEl) return <Popover open={open} anchorEl={anchorEl} onClose={handleClose}
    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    slotProps={{ paper: { role: 'dialog', 'aria-label': 'Add section', sx: { width: 304 } } }}>
    {content}
  </Popover>;

  return <Dialog open={open} onClose={handleClose} aria-label="Add section" maxWidth="xs" fullWidth>
    <DialogTitle>Add section</DialogTitle>
    <DialogContent sx={{ p: 1 }}>{content}</DialogContent>
  </Dialog>;
};

export default AddSectionDialog;
