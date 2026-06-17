import { useState } from 'react';
import {
  Box, Card, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormControl, InputLabel, Select, MenuItem, Stack, TextField, Typography, Chip,
} from '@mui/material';
import { SECTION_DEFINITIONS, SECTION_VARIANTS } from '../../storefront/sections/sectionRegistry';
import { createDefaultSection, getSectionPresetGallery, SECTION_PRESET_GOALS } from '../../../utils/sectionPresets';

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
  const [type, setType] = useState('');
  const [variant, setVariant] = useState('');
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('all');

  const variants = type ? (SECTION_VARIANTS[type] || []) : [];
  const presetCards = getSectionPresetGallery(sectionPresets).filter((preset) => goal === 'all' || preset.goal === goal);
  const selectedPreset = presetCards.find((preset) => preset.type === type) || getSectionPresetGallery(sectionPresets).find((preset) => preset.type === type);

  const handleAdd = () => {
    if (!type) return;
    const section = createDefaultSection(type, {
      id: generateId(type, existingIds),
      variant,
      title,
      sectionPresets,
    });
    onAdd(section);
    setType(''); setVariant(''); setTitle('');
  };

  const handleClose = () => { onClose(); setType(''); setVariant(''); setTitle(''); setGoal('all'); };

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

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, maxHeight: 360, overflowY: 'auto', pr: 0.5 }}>
            {presetCards.map((preset) => (
              <Card
                key={preset.type}
                variant="outlined"
                onClick={() => { setType(preset.type); setVariant(preset.variant || ''); setTitle(''); }}
                sx={{
                  p: 1.75,
                  cursor: 'pointer',
                  borderColor: type === preset.type ? 'primary.main' : 'divider',
                  borderWidth: type === preset.type ? 2 : 1,
                  bgcolor: type === preset.type ? 'action.selected' : 'background.paper',
                  '&:hover': { borderColor: 'primary.main', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' },
                }}
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
              </Card>
            ))}
          </Box>

          <FormControl size="small" fullWidth>
            <InputLabel>Section Type</InputLabel>
            <Select value={type} label="Section Type" onChange={(e) => { setType(e.target.value); setVariant(''); }}>
              {sectionOptions.map((opt) => (
                <MenuItem key={opt.type} value={opt.type}>
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
              <InputLabel>Variant</InputLabel>
              <Select value={variant} label="Variant" onChange={(e) => setVariant(e.target.value)}>
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
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!type}>Add Section</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddSectionDialog;
