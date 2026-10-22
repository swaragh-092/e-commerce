import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, CircularProgress, FormControlLabel, Paper, Stack, Switch, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import attributeService from '../../services/attributeService';
import { useNotification } from '../../context/NotificationContext';
import { formatAttributeValue, getSwatchColor } from '../../utils/attributePresentation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import ProductAttributeDialog from './ProductAttributeDialog';

const ProductAttributesSection = ({ productId, rows, templates, suggestions = [], loading, error, canManage, onRowsChange, onRetry, onBusyChange }) => {
  const { notify, confirm } = useNotification();
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const groups = [...rows.reduce((map, row) => {
    const key = row.attributeId || `custom:${row.customName?.trim().toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, attribute: row.attribute, name: row.attribute?.name || row.customName, rows: [] });
    map.get(key).rows.push(row);
    return map;
  }, new Map()).values()];
  const open = (attribute = null) => {
    if (!canManage || !productId || loading || busy || error) return;
    setPicker({ initial: templates.find((template) => template.id === attribute?.id) || attribute });
  };
  const reloadRows = async () => {
    const response = await attributeService.getProductAttributes(productId);
    if (!Array.isArray(response?.data?.data)) throw new Error('Could not refresh product attributes.');
    onRowsChange(response.data.data);
  };
  const toggleGroup = async (group, checked) => {
    if (!canManage || busy || !group.attribute?.id) return;
    setBusy(true);
    try {
      const response = await attributeService.assignProductAttribute(productId, {
        attributeId: group.attribute.id,
        values: group.rows.map((row) => ({ valueId: row.valueId })), isVariantAttr: checked,
      });
      if (!Array.isArray(response?.data?.data)) throw new Error('Could not refresh product attributes.');
      onRowsChange(response.data.data);
      notify(checked ? 'Attribute enabled for variants.' : 'Attribute set to display only.', 'success');
    } catch (err) { notify(getApiErrorMessage(err), 'error'); }
    finally { setBusy(false); }
  };
  const remove = async (row) => {
    if (!canManage || busy) return;
    if (!(await confirm({ title: 'Remove value from product?', message: 'This removes only the product assignment. Existing variants stay unchanged until you review and apply the updated variant options.', confirmText: 'Remove value', severity: 'warning' }))) return;
    setBusy(true);
    try {
      await attributeService.deleteProductAttribute(productId, row.id);
      // Reflect the successful removal even if refreshing the list fails.
      onRowsChange(rows.filter((item) => item.id !== row.id));
      await reloadRows();
      notify('Value removed from product.', 'success');
    } catch (err) { notify(getApiErrorMessage(err), 'error'); }
    finally { setBusy(false); }
  };

  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, height: '100%' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
      <Box><Typography variant="h6" fontWeight={700}>Product attributes</Typography><Typography variant="body2" color="text.secondary">Choose specifications and the options customers can buy.</Typography></Box>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => open()} disabled={!canManage || !productId || loading || busy || Boolean(error)} sx={{ flexShrink: 0, minHeight: 44 }}>Add attribute</Button>
    </Stack>
    {error ? <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Attributes could not be loaded. Retry before making changes.</Typography><Button onClick={onRetry}>Retry</Button></Stack>
      : loading ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} aria-label="Loading product attributes" /></Box>
        : <>
          {canManage && suggestions.some((item) => !groups.some((group) => group.attribute?.id === item.id)) && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Suggested for this category:</Typography>
            {suggestions.filter((item) => !groups.some((group) => group.attribute?.id === item.id)).map((item) => <Chip key={item.id} label={item.name} size="small" variant="outlined" onClick={() => open(item)} disabled={busy} />)}
          </Stack>}
          {!groups.length ? <Box sx={{ py: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}><Typography fontWeight={600}>No attributes assigned</Typography><Typography variant="body2" color="text.secondary">Add details such as height, color, or package size.</Typography></Box>
            : <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
              {groups.map((group) => <Box key={group.key} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}><Typography fontWeight={700} sx={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>{group.name}</Typography>{group.attribute && <Button size="small" onClick={() => open(group.attribute)} disabled={!canManage || busy} sx={{ minHeight: 44 }}>Add values</Button>}</Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {group.rows.map((row) => <Chip key={row.id} label={row.value ? formatAttributeValue(row.value, row.attribute) : row.customValue}
                    icon={row.value?.imageUrl ? <Box component="img" src={row.value.imageUrl} alt="" sx={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 0.75 }} />
                      : getSwatchColor(row.value) ? <Box component="span" sx={{ bgcolor: getSwatchColor(row.value), width: 18, height: 18, borderRadius: '50%', border: 1, borderColor: 'divider' }} /> : undefined}
                    onDelete={canManage && !busy ? () => remove(row) : undefined} sx={{ maxWidth: '100%' }} />)}
                </Stack>
                {group.attribute ? <Box sx={{ mt: 1.5 }}><FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={group.rows.every((row) => row.isVariantAttr)} disabled={!canManage || busy} onChange={(_, checked) => toggleGroup(group, checked)} inputProps={{ 'aria-label': `Use ${group.name} for variants` }} />} label={<Typography variant="body2">Use for variants</Typography>} />
                  {group.rows.some((row) => row.isVariantAttr) && !group.rows.every((row) => row.isVariantAttr) && <Typography variant="caption" color="text.secondary" display="block">Some values currently create variants. Turn on to include all values.</Typography>}
                </Box> : <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>Product-only specification · display only</Typography>}
              </Box>)}
            </Box>}
        </>}
    {busy && <Typography variant="caption" role="status" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>Updating product attributes…</Typography>}
    {picker && <ProductAttributeDialog productId={productId} templates={templates} rows={rows} initialTemplate={picker.initial} onClose={() => setPicker(null)} onSaved={(nextRows) => { onRowsChange(nextRows); setPicker(null); }} />}
  </Paper>;
};

export default ProductAttributesSection;
