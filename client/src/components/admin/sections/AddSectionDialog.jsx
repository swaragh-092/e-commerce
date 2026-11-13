import { useState, useId } from 'react';
import {
  Box, Card, CardActionArea, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormControl, InputLabel, Select, MenuItem, Stack, TextField, Typography, Chip,
} from '@mui/material';
import { SECTION_DEFINITIONS, SECTION_VARIANTS } from '../../storefront/sections/sectionRegistry';
import { createDefaultSection, getSectionPresetGallery, SECTION_PRESET_GOALS } from '../../../utils/sectionPresets';

const productChoices = [
  { key: 'products-most-viewed', label: 'Most Viewed', source: 'mostViewed', link: '/products?sort=most-viewed' },
  { key: 'products-trending', label: 'Trending Products', source: 'featured', link: '/products?featured=true' },
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
    : `Show ${choice.label.toLowerCase()} products in a carousel or grid.`,
}));

const sectionOptions = Object.entries(SECTION_DEFINITIONS)
  .filter(([type, def]) => def.family !== 'system')
  .map(([type, def]) => ({
    type,
    label: def.label,
    family: def.family,
  }));

const generateId = (type, existingIds) => {
  const base = type;
  let id = base;
  let i = 2;
  while (existingIds.includes(id)) { id = `${base}-${i}`; i++; }
  return id;
};

const AddSectionDialog = ({ open, onClose, onAdd, existingIds = [], sectionPresets = {}, insertLabel = 'last section' }) => {
  const typeLabelId = useId();
  const variantLabelId = useId();
  const [selection, setSelection] = useState('');
  const [variant, setVariant] = useState('');
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('all');

  const productChoice = productChoices.find((choice) => choice.key === selection);
  const type = productChoice?.type || selection;
  const variants = type ? (SECTION_VARIANTS[type] || []) : [];
  const presetCards = [...productChoices, ...getSectionPresetGallery(sectionPresets)].filter((preset) => goal === 'all' || preset.goal === goal);
  const selectedPreset = productChoice || presetCards.find((preset) => preset.type === type) || getSectionPresetGallery(sectionPresets).find((preset) => preset.type === type);

  const handleAdd = () => {
    if (!type) return;
    const section = createDefaultSection(type, {
      id: generateId(type, existingIds),
      variant,
      title,
      sectionPresets,
    });
    onAdd(productChoice ? {
      ...section,
      source: productChoice.source,
      title: title || productChoice.label,
      subtitle: '',
      viewAllLink: productChoice.link,
      dataSourceSlug: '',
      query: {},
      saleLabel: '',
    } : section);
    setSelection(''); setVariant(''); setTitle('');
  };

  const handleClose = () => { onClose(); setSelection(''); setVariant(''); setTitle(''); setGoal('all'); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Section</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {SECTION_PRESET_GOALS.map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                clickable
                color={goal === item.value ? 'primary' : 'default'}
                variant={goal === item.value ? 'filled' : 'outlined'}
                onClick={() => setGoal(item.value)}
              />
            ))}
          </Stack>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gridAutoRows: 'min-content',
            alignContent: 'start',
            gap: 1.5,
            maxHeight: { xs: 240, sm: 360 },
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehaviorY: 'contain',
            pr: 0.5,
            flexShrink: 0,
          }}>
            {presetCards.map((preset) => (
              <Card
                key={preset.key || preset.type}
                variant="outlined"
                sx={{
                  borderColor: selection === (preset.key || preset.type) ? 'primary.main' : 'divider',
                  borderWidth: selection === (preset.key || preset.type) ? 2 : 1,
                  bgcolor: selection === (preset.key || preset.type) ? 'action.selected' : 'background.paper',
                  '&:hover': { borderColor: 'primary.main', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' },
                }}
              >
                <CardActionArea
                  aria-pressed={selection === (preset.key || preset.type)}
                  onClick={() => { setSelection(preset.key || preset.type); setVariant(preset.variant || ''); setTitle(''); }}
                  sx={{ height: '100%', p: 1.75, textAlign: 'left', alignItems: 'stretch' }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography variant="subtitle2" fontWeight={800}>{preset.label}</Typography>
                      {preset.installed && <Chip label="Theme" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>{preset.description}</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip label={preset.goal} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
                      {preset.variant && <Chip label={preset.variant} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />}
                    </Stack>
                  </Stack>
                </CardActionArea>
              </Card>
            ))}
          </Box>

          <FormControl size="small" fullWidth>
            <InputLabel id={typeLabelId}>Section Type</InputLabel>
            <Select labelId={typeLabelId} value={selection} label="Section Type" onChange={(e) => { setSelection(e.target.value); setVariant(''); }}>
              {[...productChoices, ...sectionOptions].map((opt) => (
                <MenuItem key={opt.key || opt.type} value={opt.key || opt.type}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>{opt.label}</span>
                    <Chip label={opt.family} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedPreset?.description && (
            <Typography variant="caption" color="text.secondary">
              Selected preset: {selectedPreset.description}
            </Typography>
          )}

          {variants.length > 0 && (
            <FormControl size="small" fullWidth>
              <InputLabel id={variantLabelId}>Variant</InputLabel>
              <Select labelId={variantLabelId} value={variant} label="Variant" onChange={(e) => setVariant(e.target.value)}>
                <MenuItem value="">Default</MenuItem>
                {variants.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <TextField label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} size="small" fullWidth />

          {type && (
            <Typography variant="caption" color="text.secondary">
              Will be added to {insertLabel}. You can reorder after adding.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!type}>Add Section</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddSectionDialog;
