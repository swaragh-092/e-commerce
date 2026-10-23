import React, { useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import attributeService from '../../services/attributeService';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';

const signature = (options) => options.map((option) => option.valueId).sort().join(',');
const validPrice = (value) => /^\d+(\.\d{0,2})?$/.test(String(value)) && Number(value) <= 99999999.99;
const validStock = (value) => /^\d+$/.test(String(value)) && Number(value) <= 2147483647;

export default function VariantSetup({ productId, rows, variants, basePrice, disabled, canManage, hasUnsavedChanges, onBusyChange, onCreated }) {
  const { notify } = useNotification();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [stale, setStale] = useState(false);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const groups = [...rows.reduce((map, row) => {
    if (!row.isVariantAttr || !row.attributeId || !row.valueId) return map;
    if (!map.has(row.attributeId)) map.set(row.attributeId, { id: row.attributeId, name: row.attribute?.name || 'Attribute', ids: new Set() });
    map.get(row.attributeId).ids.add(row.valueId);
    return map;
  }, new Map()).values()];
  const total = groups.length ? groups.reduce((count, group) => count * group.ids.size, 1) : 0;
  // Check membership without materializing a potentially huge Cartesian product.
  const matching = new Set(variants.filter((variant) => variant.options?.length === groups.length
    && groups.every((group) => variant.options.some((option) => option.attributeId === group.id && group.ids.has(option.valueId))))
    .map((variant) => signature(variant.options)));
  const needsUpdate = total > 0 && (matching.size !== total || variants.length !== matching.size);
  const customSelection = variants.length > 0 && matching.size === variants.length && matching.size < total;
  const tooMany = total > 500;
  const setWorking = (value) => { setBusy(value); onBusyChange(value); };
  const preview = async () => {
    if (!canManage || disabled || busy || hasUnsavedChanges || !total || tooMany) return;
    setWorking(true);
    try {
      const response = await attributeService.previewVariantGeneration(productId);
      const data = response?.data?.data;
      if (!data?.token || !Array.isArray(data.combinations) || data.combinations.length !== data.total || data.combinations.some((combo) => !Array.isArray(combo.valueIds) || !combo.valueIds.length)) throw new Error('Could not load the complete variant preview. Refresh the page and make sure the server is up to date.');
      if (!data.addedCount && !data.removedCount) {
        notify('Variants are already up to date.', 'info');
        await onCreated();
        return;
      }
      setReview(data); setConfirmed(false); setStale(false); setPrice(String(basePrice || 0)); setStock('0');
      setEntries(data.combinations.filter((combo) => combo.isNew).map((combo) => ({ ...combo, selected: true, price: null, stockQty: null })));
      setSearch('');
    } catch (error) { notify(getApiErrorMessage(error), 'error'); }
    finally { setWorking(false); }
  };
  const priceValid = validPrice(price);
  const stockValid = validStock(stock);
  const chosen = entries.filter((entry) => entry.selected);
  const invalidEntries = chosen.some((entry) => !validPrice(entry.price ?? price) || !validStock(entry.stockQty ?? stock));
  const totalStock = chosen.reduce((sum, entry) => sum + Number(entry.stockQty ?? stock), 0);
  const stockOverflow = totalStock > 2147483647;
  const cannotApply = !review || busy || disabled || !canManage || hasUnsavedChanges || stale || Boolean(review?.blockedRemovalCount)
    || (review?.removedCount > 0 && !confirmed) || invalidEntries || stockOverflow
    || (!chosen.length && !review?.removedCount) || (!chosen.length && !review?.keptCount);
  const changeEntry = (valueIds, changes) => setEntries((current) => current.map((entry) => entry.valueIds.join(',') === valueIds.join(',') ? { ...entry, ...changes } : entry));
  const apply = async () => {
    if (cannotApply) return;
    setWorking(true);
    try {
      await attributeService.bulkGenerateVariants(productId, {
        planToken: review.token, confirmRemovals: confirmed,
        newVariants: chosen.map((entry) => ({ valueIds: entry.valueIds, price: Number(entry.price ?? price), stockQty: Number(entry.stockQty ?? stock) })),
      });
      setReview(null);
      notify(variants.length ? 'Variant options updated with your prices and stock.' : 'Variants created with your prices and stock.', 'success');
      await onCreated();
    } catch (error) {
      if (error?.response?.status === 409) setStale(true);
      notify(getApiErrorMessage(error, 'Could not create variants. Please try again.'), 'error');
    } finally { setWorking(false); }
  };

  return <>
    <Box sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" fontWeight={700}>
        {!total ? 'Start with your product options' : needsUpdate && !customSelection ? (variants.length ? 'Your options have changed' : 'Ready to create variants') : 'Your variants are ready'}
      </Typography>
      {!total ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>Add product attributes and turn on “Use for variants” for options customers choose, such as size or color.{variants.length > 0 ? ' Existing variants stay unchanged.' : ''}</Typography>
        : <>
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.75} sx={{ my: 1 }}>
            {groups.map((group) => <Chip key={group.id} size="small" variant="outlined" label={`${group.name}: ${group.ids.size} ${group.ids.size === 1 ? 'value' : 'values'}`} />)}
          </Stack>
          <Typography variant="body2" color="text.secondary">{customSelection ? `${variants.length} ${variants.length === 1 ? 'variant selected' : 'variants selected'} from ${total.toLocaleString()} possible combinations. Keep only the combinations you need.` : `${total.toLocaleString()} ${total === 1 ? 'combination' : 'combinations'} · One variant for each combination.`}</Typography>
          {tooMany ? <Typography variant="body2" color="error" sx={{ mt: 1 }}>Choose fewer values. A product can have up to 500 variant combinations.</Typography>
            : needsUpdate ? <>
              <Button variant={customSelection ? 'outlined' : 'contained'} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <AddIcon />} onClick={preview}
                disabled={!canManage || disabled || busy || hasUnsavedChanges} sx={{ minHeight: 44, mt: 2 }}>
                {busy ? 'Preparing preview…' : customSelection ? 'Add missing variants' : variants.length ? 'Review option changes' : `Create ${total} ${total === 1 ? 'variant' : 'variants'}`}
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>{customSelection ? 'Deleted combinations stay removed unless you choose to add them again.' : 'Preview the combinations before applying changes.'}</Typography>
            </> : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Open a variant below to edit its price, stock, SKU, or images.</Typography>}
        </>}
      {hasUnsavedChanges && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Save your price, stock, or image changes below before updating variant options.</Typography>}
    </Box>

    <Dialog open={Boolean(review)} onClose={() => { if (!busy) setReview(null); }} fullWidth maxWidth="md" aria-labelledby="variant-review-title">
      {review && <>
        <DialogTitle id="variant-review-title">{variants.length ? 'Review variant changes' : 'Create variants'}</DialogTitle>
        <DialogContent dividers sx={{ pt: 2.5 }}>
          <Typography variant="body2" color="text.secondary">Choose the combinations you sell, then set the MRP and stock for each one. Unchecked combinations will not be created.</Typography>
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ my: 2 }}>
            <Chip label={`${chosen.length} selected to create`} color="primary" variant="outlined" />
            <Chip label={`${review.keptCount} unchanged`} variant="outlined" />
            {review.removedCount > 0 && <Chip label={`${review.removedCount} to remove`} color="warning" variant="outlined" />}
          </Stack>
          {review.addedCount > 0 && <Box sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Bulk defaults</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Defaults fill untouched fields. Edit individual combinations below, or apply these defaults to reset the selected combinations.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Starting MRP" type="number" value={price} onChange={(event) => setPrice(event.target.value)} disabled={busy} fullWidth inputProps={{ min: 0, step: 0.01 }} error={!priceValid} helperText={!priceValid ? 'Enter a price with up to 2 decimals.' : 'Price per new variant'} />
              <TextField label="Starting stock" type="number" value={stock} onChange={(event) => setStock(event.target.value)} disabled={busy} fullWidth inputProps={{ min: 0, step: 1 }} error={!stockValid} helperText={!stockValid ? 'Enter a whole number, 0 or more.' : 'Quantity per new variant'} />
            </Stack>
            <Button sx={{ mt: 1 }} disabled={busy || !priceValid || !stockValid || !chosen.length} onClick={() => setEntries((current) => current.map((entry) => entry.selected ? { ...entry, price: null, stockQty: null } : entry))}>Apply defaults to selected</Button>
          </Box>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>Combinations ({review.total})</Typography>
            {entries.length > 0 && <><Button size="small" disabled={busy} onClick={() => setEntries((current) => current.map((entry) => ({ ...entry, selected: true })))}>Select all new</Button><Button size="small" disabled={busy} onClick={() => setEntries((current) => current.map((entry) => ({ ...entry, selected: false })))}>Deselect all new</Button></>}
          </Stack>
          {review.total > 6 && <TextField fullWidth size="small" label="Find a combination" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ mb: 1.5 }} />}
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, maxHeight: 420, overflowY: 'auto' }}>
            {review.combinations.filter((combo) => combo.label.toLowerCase().includes(search.toLowerCase())).map((combo) => {
              const entry = entries.find((item) => item.valueIds.join(',') === combo.valueIds.join(','));
              return <Box key={combo.valueIds.join(',')} role="group" aria-label={combo.label} sx={{ p: 1.5, '& + &': { borderTop: 1, borderColor: 'divider' } }}>
                {entry ? <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                  <FormControlLabel sx={{ flex: 1, m: 0, minWidth: 0 }} control={<Checkbox checked={entry.selected} disabled={busy} onChange={(_, selected) => changeEntry(combo.valueIds, { selected })} />} label={<Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{combo.label}</Typography>} />
                  <TextField label="MRP" type="number" size="small" value={entry.price ?? price} disabled={busy || !entry.selected} onChange={(event) => changeEntry(combo.valueIds, { price: event.target.value })} inputProps={{ min: 0, step: 0.01 }} sx={{ width: { xs: '100%', sm: 145 } }} error={entry.selected && !validPrice(entry.price ?? price)} helperText={entry.selected && !validPrice(entry.price ?? price) ? 'Up to 2 decimals, 0 or more.' : undefined} />
                  <TextField label="Stock" type="number" size="small" value={entry.stockQty ?? stock} disabled={busy || !entry.selected} onChange={(event) => changeEntry(combo.valueIds, { stockQty: event.target.value })} inputProps={{ min: 0, step: 1 }} sx={{ width: { xs: '100%', sm: 130 } }} error={entry.selected && !validStock(entry.stockQty ?? stock)} helperText={entry.selected && !validStock(entry.stockQty ?? stock) ? 'Whole number, 0 or more.' : undefined} />
                </Stack> : <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2">{combo.label}</Typography><Chip size="small" label="Already exists" /></Stack>}
              </Box>;
            })}
            {!review.combinations.some((combo) => combo.label.toLowerCase().includes(search.toLowerCase())) && <Typography variant="body2" sx={{ p: 2 }}>No matching combinations.</Typography>}
          </Box>
          <Typography variant="body2" sx={{ mt: 1.5 }} aria-live="polite">{chosen.length} to create · {review.addedCount - chosen.length} skipped · New stock: {Number.isFinite(totalStock) ? totalStock.toLocaleString() : '—'}</Typography>
          {!chosen.length && review.addedCount > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Select at least one new combination to create, or go back to keep your current variants.</Typography>}
          {stockOverflow && <Alert severity="error" sx={{ mt: 1 }}>The combined stock is too large. Reduce the selected stock quantities.</Alert>}
          {review.keptCount > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Unchanged variants keep their prices, stock, SKUs, images, and availability.</Typography>}
          {!review.addedCount && !review.removedCount && <Typography variant="body2" sx={{ mt: 2 }}>These variants are already up to date. No option changes are needed.</Typography>}
          {review.removedCount > 0 && <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} /><Typography variant="subtitle2">These variants no longer match your options</Typography>
            <Box sx={{ maxHeight: 160, overflowY: 'auto', my: 1 }}>
              {review.removals.map((variant) => <Typography key={variant.id} variant="body2" sx={{ py: 0.5 }}>{variant.label} · Stock: {variant.stockQty}{variant.reservedQty > 0 ? ` · Reserved: ${variant.reservedQty}` : ''}</Typography>)}
            </Box>
            {review.blockedRemovalCount > 0 ? <Alert severity="warning">Some units are reserved for active orders. Finish or cancel those orders before removing these variants, or keep their options selected.</Alert>
              : <>
                {review.removals.some((variant) => variant.stockQty > 0) && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Deleting these variants removes {review.removals.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0)} units from the product’s stock.</Typography>}
                <FormControlLabel control={<Checkbox checked={confirmed} onChange={(_, value) => setConfirmed(value)} disabled={busy} />} label={`Remove ${review.removedCount} ${review.removedCount === 1 ? 'variant that no longer matches' : 'variants that no longer match'} these options`} />
              </>}
          </Box>}
          {stale && <Alert severity="warning" sx={{ mt: 2 }}>The product changed after this preview. Close this review and preview the latest changes.</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReview(null)} disabled={busy} sx={{ minHeight: 44 }}>Back</Button>
          <Button variant="contained" onClick={apply} disabled={cannotApply} sx={{ minHeight: 44 }}>
            {busy ? 'Applying changes…' : variants.length ? 'Apply changes' : `Create ${chosen.length} ${chosen.length === 1 ? 'variant' : 'variants'}`}
          </Button>
        </DialogActions>
      </>}
    </Dialog>
  </>;
}
