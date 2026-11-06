import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, FormControlLabel, IconButton, Paper, Stack, Switch, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import attributeService from '../../services/attributeService';
import { useNotification } from '../../context/NotificationContext';
import { formatAttributeValue, getSwatchColor } from '../../utils/attributePresentation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import ProductAttributeDialog from './ProductAttributeDialog';

const ProductAttributesSection = ({ productId, rows, templates, variants = [], categorySuggestions = {}, loading, error, canManage, onRowsChange, onRetry, onBusyChange }) => {
  const { notify, confirm } = useNotification();
  const { attributes: suggestions = [], loading: suggestionsLoading, error: suggestionsError, hasCategories, retry: retrySuggestions } = categorySuggestions;
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const groups = [...rows.reduce((map, row) => {
    const key = row.attributeId || `custom:${row.customName?.trim().toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, attribute: row.attribute, name: row.attribute?.name || row.customName, rows: [] });
    map.get(key).rows.push(row);
    return map;
  }, new Map()).values()];
  const usedByVariants = (group, row = null) => Boolean(group.rows[0]?.attributeId && variants.some((variant) => !variant.deletedAt
    && variant.options?.some((option) => (option.attributeId || option.attribute?.id) === group.rows[0].attributeId
      && (!row || (option.valueId || option.value?.id) === row.valueId))));
  const removalReason = (group, row = null) => {
    if (row && group.rows.length > 1) return usedByVariants(group, row)
      ? 'This value is used by existing variants. Delete those variants before removing it.' : '';
    return usedByVariants(group)
      ? 'Delete all variants using this attribute, then turn off “Use for variants” before removing this attribute.'
      : group.rows.some((item) => item.attributeId && item.isVariantAttr)
        ? 'Turn off “Use for variants” before removing this attribute.' : '';
  };
  const reorder = async ({ source, destination, type }) => {
    if (!destination || !canManage || busy || loading || error || (source.index === destination.index && source.droppableId === destination.droppableId)) return;
    const next = groups.map((group) => ({ ...group, rows: [...group.rows] }));
    const list = type === 'ATTRIBUTE' ? next : next.find((group) => `values:${group.key}` === source.droppableId)?.rows;
    if (!list || source.droppableId !== destination.droppableId) return;
    const [moved] = list.splice(source.index, 1);
    list.splice(destination.index, 0, moved);
    const nextRows = next.flatMap((group) => group.rows).map((row, sortOrder) => ({ ...row, sortOrder }));
    setBusy(true); onRowsChange(nextRows);
    try {
      const response = await attributeService.reorderProductAttributes(productId, nextRows.map((row) => row.id));
      if (!Array.isArray(response?.data?.data)) throw new Error('Could not confirm the saved order. Refresh attributes before ordering again.');
      onRowsChange(response.data.data);
      notify('Product attribute order saved.', 'success');
    } catch (err) { onRowsChange(rows); notify(getApiErrorMessage(err, 'Could not save the order. Your previous order was restored.'), 'error'); }
    finally { setBusy(false); }
  };
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
    if (!canManage || busy || loading || error || !group.attribute?.id) return;
    if (!checked && usedByVariants(group)) {
      notify('Delete all variants using this attribute before turning off “Use for variants”.', 'warning'); return;
    }
    setBusy(true);
    try {
      const response = await attributeService.updateProductAttributeGroup(productId, group.rows[0].id, { isVariantAttr: checked });
      if (!Array.isArray(response?.data?.data)) throw new Error('Could not refresh product attributes.');
      onRowsChange(response.data.data);
      notify(checked ? 'Attribute enabled for variants.' : 'Attribute set to display only.', 'success');
    } catch (err) { notify(getApiErrorMessage(err), 'error'); }
    finally { setBusy(false); }
  };
  const remove = async (group, row = null) => {
    if (!canManage || busy || loading || error) return;
    const reason = removalReason(group, row);
    if (reason) { notify(reason, 'warning'); return; }
    if (!(await confirm({
      title: row ? 'Remove value from product?' : 'Remove attribute from product?',
      message: row ? `Remove this value from ${group.name} on this product? The reusable value remains available.`
        : `Remove ${group.name} and all ${group.rows.length} assigned ${group.rows.length === 1 ? 'value' : 'values'} from this product? The reusable attribute and values remain available.`,
      confirmText: row ? 'Remove value' : 'Remove attribute', severity: 'warning',
    }))) return;
    setBusy(true);
    try {
      if (row) await attributeService.deleteProductAttribute(productId, row.id);
      else await attributeService.deleteProductAttributeGroup(productId, group.rows[0].id);
      // Reflect the successful removal even if refreshing the list fails.
      const removedIds = new Set((row ? [row] : group.rows).map((item) => item.id));
      onRowsChange(rows.filter((item) => !removedIds.has(item.id)));
      await reloadRows();
      notify(row ? 'Value removed from product.' : 'Attribute removed from product.', 'success');
    } catch (err) { notify(getApiErrorMessage(err), 'error'); }
    finally { setBusy(false); }
  };

  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, height: '100%' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
      <Box><Typography variant="h6" fontWeight={700}>Product attributes</Typography><Typography variant="body2" color="text.secondary">Drag attributes and their values into display order. Order saves automatically for this product.</Typography></Box>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => open()} disabled={!canManage || !productId || loading || busy || Boolean(error)} sx={{ flexShrink: 0, minHeight: 44 }}>Add attribute</Button>
    </Stack>
    {error ? <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Attributes could not be loaded. Retry before making changes.</Typography><Button onClick={onRetry}>Retry</Button></Stack>
      : loading ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} aria-label="Loading product attributes" /></Box>
        : <>
          {canManage && suggestionsLoading && <Stack direction="row" spacing={1} alignItems="center" role="status" sx={{ mb: 2 }}><CircularProgress size={16} /><Typography variant="body2" color="text.secondary">Loading category suggestions…</Typography></Stack>}
          {canManage && suggestionsError && <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={retrySuggestions}>Retry suggestions</Button>}>Category suggestions could not be loaded. {suggestionsError}</Alert>}
          {canManage && hasCategories && !suggestionsLoading && !suggestionsError && suggestions.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No attributes are linked to the selected categories or their parents.</Typography>}
          {canManage && !suggestionsLoading && !suggestionsError && suggestions.some((item) => !groups.some((group) => group.attribute?.id === item.id)) && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Suggested from categories and parents:</Typography>
            {suggestions.filter((item) => !groups.some((group) => group.attribute?.id === item.id)).map((item) => <Chip key={item.id} label={item.name} size="small" variant="outlined" onClick={() => open(item)} disabled={busy} />)}
          </Stack>}
          {!groups.length ? <Box sx={{ py: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}><Typography fontWeight={600}>No attributes assigned</Typography><Typography variant="body2" color="text.secondary">Add details such as height, color, or package size.</Typography></Box>
            : <DragDropContext onDragEnd={reorder}><Droppable droppableId="product-attributes" type="ATTRIBUTE">
              {(provided) => <Box role="list" aria-label="Product attribute order" ref={provided.innerRef} {...provided.droppableProps}>
              {groups.map((group, index) => <Draggable key={group.key} draggableId={`attribute:${group.key}`} index={index} isDragDisabled={!canManage || busy}>
                {(drag, snapshot) => <Box role="listitem" ref={drag.innerRef} {...drag.draggableProps} sx={{ mb: 2, border: 1, borderColor: snapshot.isDragging ? 'primary.main' : 'divider', bgcolor: 'background.paper', borderRadius: 2, p: 2, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>{canManage && <Box {...drag.dragHandleProps} aria-label={`Reorder ${group.name}`} sx={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}><DragIndicatorIcon /></Box>}<Typography variant="caption" color="text.secondary">{index + 1}.</Typography><Typography fontWeight={700} sx={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>{group.name}</Typography>{group.attribute && <Button size="small" onClick={() => open(group.attribute)} disabled={!canManage || busy} sx={{ minHeight: 44 }}>Add values</Button>}
                  {canManage && <Tooltip title={removalReason(group) || 'Remove attribute from product'}><span><IconButton color="error" aria-label={`Remove ${group.name} attribute`} onClick={() => remove(group)} disabled={busy || Boolean(removalReason(group))} sx={{ minWidth: 44, minHeight: 44 }}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>}
                </Stack>
                <Droppable droppableId={`values:${group.key}`} type={`VALUE:${group.key}`}>
                  {(valuesProvided) => <Box ref={valuesProvided.innerRef} {...valuesProvided.droppableProps} role="list" aria-label={`${group.name} value order`}>
                  {group.rows.map((row, valueIndex) => <Draggable key={row.id} draggableId={`value:${row.id}`} index={valueIndex} isDragDisabled={!canManage || busy}>
                    {(valueDrag) => <Box role="listitem" ref={valueDrag.innerRef} {...valueDrag.draggableProps} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, minWidth: 0 }}>
                    {canManage && <Box {...valueDrag.dragHandleProps} aria-label={`Reorder ${row.value ? formatAttributeValue(row.value, row.attribute) : row.customValue} in ${group.name}`} sx={{ minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}><DragIndicatorIcon fontSize="small" /></Box>}
                    <Chip label={row.value ? formatAttributeValue(row.value, row.attribute) : row.customValue}
                    icon={row.value?.imageUrl ? <Box component="img" src={row.value.imageUrl} alt="" sx={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 0.75 }} />
                      : getSwatchColor(row.value) ? <Box component="span" sx={{ bgcolor: getSwatchColor(row.value), width: 18, height: 18, borderRadius: '50%', border: 1, borderColor: 'divider' }} /> : undefined}
                    onDelete={canManage && !busy && !removalReason(group, row) ? () => remove(group, row) : undefined} sx={{ maxWidth: '100%' }} />
                    </Box>}
                  </Draggable>)}
                  {valuesProvided.placeholder}</Box>}
                </Droppable>
                {group.attribute ? <Box sx={{ mt: 1.5 }}><FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={group.rows.every((row) => row.isVariantAttr)} disabled={!canManage || busy || (group.rows.every((row) => row.isVariantAttr) && usedByVariants(group))} onChange={(_, checked) => toggleGroup(group, checked)} inputProps={{ 'aria-label': `Use ${group.name} for variants` }} />} label={<Typography variant="body2">Use for variants</Typography>} />
                  {group.rows.some((row) => row.isVariantAttr) && !group.rows.every((row) => row.isVariantAttr) && <Typography variant="caption" color="text.secondary" display="block">Some values currently create variants. Turn on to include all values.</Typography>}
                </Box> : <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>Product-only specification · display only</Typography>}
                {removalReason(group) && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>{removalReason(group)}{group.rows.length > 1 && ' Unused values can be removed directly.'}</Typography>}
              </Box>}
              </Draggable>)}
              {provided.placeholder}</Box>}
            </Droppable></DragDropContext>}
        </>}
    {busy && <Typography variant="caption" role="status" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>Updating product attributes…</Typography>}
    {picker && <ProductAttributeDialog productId={productId} templates={templates} rows={rows} variants={variants} initialTemplate={picker.initial} onClose={() => setPicker(null)} onSaved={(nextRows) => { onRowsChange(nextRows); setPicker(null); }} />}
  </Paper>;
};

export default ProductAttributesSection;
