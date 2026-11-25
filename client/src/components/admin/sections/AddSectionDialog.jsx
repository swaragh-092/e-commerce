import { useRef, useState } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, IconButton, Popover, Stack, TextField, Typography,
} from '@mui/material';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { SECTION_DEFINITIONS, SECTION_VARIANTS } from '../../storefront/sections/sectionRegistry';
import { createDefaultSection, getSectionPresetGallery, SECTION_PRESET_GOALS } from '../../../utils/sectionPresets';
import SectionLayoutPreview from './SectionLayoutPreview';
import productRow from '../../../../../shared/product-row.json';
import { applyProductSourcePreset } from '../../../utils/productRowSources';

const productChoices = ['mostViewed', 'trending', 'staffPicks', 'bestSellers', 'featured', 'newest', 'sale', 'combo'].map((source) => ({
  key: `products-${source}`,
  label: productRow.sources[source].presetLabel,
  source,
  type: productRow.type,
  family: 'merchandising',
  goal: 'merchandising',
  variant: productRow.defaults.variant,
  description: source === 'featured'
    ? 'Show hand-picked featured products.'
    : source === 'staffPicks' ? 'Choose and order the products in this row.'
      : `Show ${productRow.sources[source].presetLabel.toLowerCase()} products in a carousel or grid.`,
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
  const [previewKey, setPreviewKey] = useState(null);
  const firstResultRef = useRef(null);
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

  const visibleOptions = [...groups.values()].flat();
  const previewOption = visibleOptions.find((option) => (option.key || option.type) === previewKey) || visibleOptions[0];
  const reset = () => { setQuery(''); setPreviewKey(null); };

  const handleAdd = (option) => {
    const section = createDefaultSection(option.type, {
      variant: option.variant,
      sectionPresets,
    });
    // A reusable preset must not override the ID allocated for this instance.
    section.id = generateId(option.type, existingIds);
    reset();
    onAdd(option.source ? applyProductSourcePreset(section, option.source) : section);
  };

  const handleClose = () => { reset(); onClose(); };
  const content = <Stack spacing={1} sx={{ p: 1 }}>
    <TextField autoFocus size="small" label="Search sections" value={query} onChange={(event) => { setQuery(event.target.value); setPreviewKey(null); }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' || event.nativeEvent.isComposing || !firstResultRef.current) return;
        event.preventDefault();
        firstResultRef.current.focus();
      }} />
    <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>Insert in {insertLabel}</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start', gap: 1 }}>
    <Box sx={{ maxHeight: { xs: 'min(32vh, 240px)', sm: 'min(52vh, 420px)' }, overflowY: 'auto', overscrollBehavior: 'contain' }}>
      {groups.size === 0 && <Typography role="status" variant="body2" sx={{ p: 1 }}>No matching sections</Typography>}
      {[...groups].map(([group, choices]) => <Box component="section" aria-label={group} key={group} sx={{ py: 0.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography component="h3" variant="caption" fontWeight={700} sx={{ px: 1 }}>{group}</Typography>
        {choices.map((option) => <Stack direction="row" key={option.key || option.type}>
        <Button ref={option === visibleOptions[0] ? firstResultRef : undefined} fullWidth color="inherit" size="small"
          title={option.description} onClick={() => handleAdd(option)} startIcon={<DashboardCustomizeOutlinedIcon />}
          onFocus={() => setPreviewKey(option.key || option.type)} onPointerEnter={() => setPreviewKey(option.key || option.type)}
          sx={{ justifyContent: 'flex-start', textTransform: 'none', textAlign: 'left', bgcolor: option === previewOption ? 'action.hover' : undefined }}>
          {option.label}
        </Button>
        <IconButton size="small" aria-label={`Preview ${option.label}`} onClick={() => setPreviewKey(option.key || option.type)}
          sx={{ display: 'none', '@media (hover: none)': { display: 'inline-flex' }, flexShrink: 0 }}>
          <VisibilityOutlinedIcon fontSize="small" />
        </IconButton>
        </Stack>)}
      </Box>)}
    </Box>
    <SectionLayoutPreview option={previewOption} />
    </Box>
  </Stack>;

  if (anchorEl) return <Popover open={open} anchorEl={anchorEl} onClose={handleClose}
    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    slotProps={{ paper: { role: 'dialog', 'aria-label': 'Add section', sx: { width: 'min(560px, calc(100vw - 32px))' } } }}>
    {content}
  </Popover>;

  return <Dialog open={open} onClose={handleClose} aria-label="Add section" maxWidth="sm" fullWidth>
    <DialogTitle>Add section</DialogTitle>
    <DialogContent sx={{ p: 1 }}>{content}</DialogContent>
  </Dialog>;
};

export default AddSectionDialog;
