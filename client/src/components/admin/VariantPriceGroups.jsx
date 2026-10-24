import { useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { getPriceAttributes, groupVariantPrices, validGroupPrice } from '../../utils/variantPriceGroups';

export default function VariantPriceGroups({ rows, entries, disabled, onApply, saveHint }) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [drafts, setDrafts] = useState({});
  const attributes = useMemo(() => getPriceAttributes(rows, entries), [rows, entries]);
  const groups = useMemo(() => groupVariantPrices(entries, attributes, selectedIds), [entries, attributes, selectedIds]);
  const changes = new Map();
  let invalid = false;
  for (const group of groups) {
    if (!Object.hasOwn(drafts, group.key)) continue;
    const value = drafts[group.key];
    if (!validGroupPrice(value)) { invalid = true; continue; }
    for (const entry of group.entries) {
      if (!validGroupPrice(entry.price) || Number(entry.price) !== Number(value)) changes.set(entry.id, Number(value));
    }
  }
  const apply = () => {
    if (disabled || invalid || !changes.size) return;
    onApply(changes);
    setOpen(false);
  };
  return <>
    <Button variant="outlined" disabled={disabled || !entries.length} sx={{ mb: 2, minHeight: 44 }} onClick={() => {
      setSelectedIds([]); setDrafts({}); setOpen(true);
    }}>Set prices by attribute</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md" aria-labelledby="price-groups-title">
      <DialogTitle id="price-groups-title">Set prices by attribute</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>Choose only the attributes that change the MRP. For example, choose Flowering Days and leave Flower Colour unchecked to use the same price across colours.</Typography>
        <Typography fontWeight={700}>Price varies by</Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
          {attributes.map((attribute) => <FormControlLabel key={attribute.id} label={attribute.name} control={<Checkbox disabled={disabled} checked={selectedIds.includes(attribute.id)} onChange={(_, checked) => {
            setSelectedIds((current) => checked ? [...current, attribute.id] : current.filter((id) => id !== attribute.id));
            setDrafts({});
          }} />} />)}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>Only options used by these variants appear here. Unchecked attributes keep their variants and share prices. Changing this selection clears unapplied prices. To add another option, turn on “Use for variants” and create its combinations first.</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>{selectedIds.length
          ? `One MRP per combination of the selected attributes.${attributes.length > selectedIds.length ? ' Shared across: ' + attributes.filter((attribute) => !selectedIds.includes(attribute.id)).map((attribute) => attribute.name).join(', ') + '.' : ''}`
          : 'No attributes selected: use one MRP for all variants.'} Stock, SKUs, availability, and images stay unchanged.</Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Edit the groups you want to change. Mixed prices stay unchanged until you enter a shared MRP. These are draft edits, not automatic pricing rules for future variants.</Typography>
        <Stack spacing={2}>
          {groups.map((group, index) => {
            const value = drafts[group.key] ?? group.price;
            const error = Object.hasOwn(drafts, group.key) && !validGroupPrice(value);
            return <Box key={group.key} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography fontWeight={600} id={`price-group-${index}`}>{group.label}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{group.entries.length} {group.entries.length === 1 ? 'variant' : 'variants'}</Typography>
              <TextField fullWidth size="small" label={`MRP for ${group.label}`} type="number" value={value} disabled={disabled} inputProps={{ min: 0, step: 0.01 }}
                onChange={(event) => setDrafts((current) => ({ ...current, [group.key]: event.target.value }))} error={error}
                helperText={error ? 'Enter an MRP from 0 to 99999999.99 with up to 2 decimals.' : group.price === '' && !Object.hasOwn(drafts, group.key) ? 'Mixed current prices — enter a shared MRP to replace them.' : 'Shared MRP for this group'} />
            </Box>;
          })}
        </Stack>
        <Typography sx={{ mt: 2 }} fontWeight={600}>{changes.size} of {entries.length} variant prices will change.</Typography>
        <Typography variant="body2" color="text.secondary">{saveHint}</Typography>
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" disabled={disabled || invalid || !changes.size} onClick={apply}>Apply prices to draft</Button></DialogActions>
    </Dialog>
  </>;
}
