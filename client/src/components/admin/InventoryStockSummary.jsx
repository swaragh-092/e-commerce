import { Box, Typography } from '@mui/material';

const qty = (value) => Math.max(Number(value) || 0, 0);

export default function InventoryStockSummary({ quantity, reservedQty, variants = [], tracksVariants, enabled, published }) {
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
      <Typography variant="body2">On hand: {stock} · Reserved: {reserved} · Available to sell: {available}</Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {tracksVariants ? 'Active variants only. Each variant has its own stock alert; totals do not make another variant available.' : 'Available stock is on hand minus units reserved for orders.'}
      </Typography>
      {inactive.length > 0 && <Typography variant="caption" color="text.secondary" display="block">Disabled variants: {total(inactive, 'stockQty')} on hand, {total(inactive, 'reservedQty')} reserved. Kept for existing orders; excluded from sale and stock alerts.</Typography>}
      {!enabled ? <Typography variant="caption" color="text.secondary" display="block">Disabled product: cannot be purchased and does not trigger stock alerts. Stock and order reservations are retained.</Typography>
        : !published ? <Typography variant="caption" color="text.secondary" display="block">Not published: excluded from sale and stock alerts.</Typography>
          : available === 0 && <Typography variant="caption" color="error" display="block">Out of stock. Purchasing is blocked until stock is available; the enabled setting stays unchanged.</Typography>}
      {tracksVariants && active.length === 0 && <Typography variant="caption" color="warning.main" display="block">No active variants. Create or enable a variant to make this product available.</Typography>}
      {variants.some((variant) => variant._dirty) && <Typography variant="caption" color="warning.main" display="block">Includes unsaved variant changes. Save variants to update storefront stock and alerts.</Typography>}
    </Box>
  );
}
