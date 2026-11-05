import { useEffect, useRef } from 'react';
import { Alert, Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { getVariantOptionLabel } from '../../utils/variantOptions';

const qty = (value) => Math.max(Number(value) || 0, 0);

export default function InventoryStockSummary({ quantity, reservedQty, variants = [], tracksVariants, enabled, published, selectedVariantId }) {
  const selectedRowRef = useRef(null);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  useEffect(() => {
    if (selectedVariant) selectedRowRef.current?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
  }, [selectedVariantId, selectedVariant?.id]);
  const active = variants.filter((variant) => variant.isActive !== false);
  const inactive = variants.filter((variant) => variant.isActive === false);
  const total = (rows, key) => rows.reduce((sum, row) => sum + qty(row[key]), 0);
  const stock = tracksVariants ? total(active, 'stockQty') : qty(quantity);
  const reserved = tracksVariants ? total(active, 'reservedQty') : qty(reservedQty);
  const available = tracksVariants
    ? active.reduce((sum, row) => sum + Math.max(qty(row.stockQty) - qty(row.reservedQty), 0), 0)
    : Math.max(stock - reserved, 0);
  return (
    <Box aria-label="Inventory stock breakdown" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
      {tracksVariants && <Typography variant="subtitle2">All active variants combined</Typography>}
      <Typography variant="body2">On hand: {stock} · Reserved: {reserved} · Available to sell: {available}</Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {tracksVariants ? 'Active variants only. Each variant has its own stock alert; totals do not make another variant available.' : 'Available stock is on hand minus units reserved for orders.'}
      </Typography>
      {selectedVariantId && !selectedVariant && <Alert severity="warning" sx={{ mt: 1 }}>{tracksVariants ? 'The selected variant is no longer available. Check this product’s current inventory.' : 'This is a Simple product. Stock and alerts now use the product quantity; the previous variant alert no longer applies.'}</Alert>}
      {tracksVariants && variants.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Stock by variant / SKU</Typography>
          <Typography variant="caption" color="text.secondary">Compare the dashboard alert with its matching SKU below.</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Variant inventory stock">
              <TableHead><TableRow>
                <TableCell>Variant / SKU</TableCell><TableCell align="right">On hand</TableCell><TableCell align="right">Reserved</TableCell><TableCell align="right">Available</TableCell>
              </TableRow></TableHead>
              <TableBody>{variants.map((variant, index) => {
                const disabled = variant.isActive === false;
                const rowAvailable = disabled ? 0 : Math.max(qty(variant.stockQty) - qty(variant.reservedQty), 0);
                const selected = Boolean(selectedVariantId && variant.id === selectedVariantId);
                return (
                  <TableRow key={variant.id || variant.sku || index} selected={selected} aria-selected={selected} ref={selected ? selectedRowRef : null}>
                    <TableCell sx={{ overflowWrap: 'anywhere', minWidth: 130 }}>
                      <Typography variant="body2">{variant.sku || 'SKU not assigned'}</Typography>
                      {getVariantOptionLabel(variant) && <Typography variant="caption" display="block">{getVariantOptionLabel(variant)}</Typography>}
                      <Typography variant="caption" display="block" color="text.secondary">{disabled ? 'Disabled' : 'Active'}{variant._dirty ? ' · Unsaved' : ''}{selected ? ' · Selected from inventory alert' : ''}</Typography>
                    </TableCell>
                    <TableCell align="right">{qty(variant.stockQty)}</TableCell><TableCell align="right">{qty(variant.reservedQty)}</TableCell><TableCell align="right">{rowAvailable}</TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          </Box>
        </Box>
      )}
      {inactive.length > 0 && <Typography variant="caption" color="text.secondary" display="block">Disabled variants: {total(inactive, 'stockQty')} on hand, {total(inactive, 'reservedQty')} reserved. Kept for existing orders; excluded from sale and stock alerts.</Typography>}
      {!enabled ? <Typography variant="caption" color="text.secondary" display="block">Disabled product: cannot be purchased and does not trigger stock alerts. Stock and order reservations are retained.</Typography>
        : !published ? <Typography variant="caption" color="text.secondary" display="block">Not published: excluded from sale and stock alerts.</Typography>
          : available === 0 && <Typography variant="caption" color="error" display="block">Out of stock. Purchasing is blocked until stock is available; the enabled setting stays unchanged.</Typography>}
      {tracksVariants && active.length === 0 && <Typography variant="caption" color="warning.main" display="block">No active variants. Create or enable a variant to make this product available.</Typography>}
      {variants.some((variant) => variant._dirty) && <Typography variant="caption" color="warning.main" display="block">Includes unsaved variant changes. Save variants to update storefront stock and alerts.</Typography>}
    </Box>
  );
}
