import { Box, Chip, Paper, Typography } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useNavigate } from 'react-router-dom';
import { getPanelSx } from './dashboardUtils';

const InventoryWarningsWidget = ({ lowStock, loading, spacing, stats }) => {
  const navigate = useNavigate();
  const criticalItems = lowStock.filter((item) => item.availableQty <= 0 || item.status === 'out_of_stock');
  const warningItems = lowStock.filter((item) => item.availableQty > 0).slice(0, 4);
  const outOfStockCount = Number(stats?.inventory?.outOfStockCount ?? stats?.outOfStockCount ?? criticalItems.length);
  const totalAtRisk = Number(stats?.inventory?.totalAtRisk ?? stats?.lowStockCount ?? lowStock.length);

  return (
    <Paper elevation={0} sx={getPanelSx(spacing)}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Inventory2OutlinedIcon color={outOfStockCount ? 'error' : 'warning'} />
        <Typography variant="h6" fontWeight={600}>Inventory Warnings ({totalAtRisk})</Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Available = on hand − reserved. Alerts count individual active SKUs.</Typography>
      {!loading && totalAtRisk === 0 && lowStock.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No inventory warnings right now.</Typography>
      ) : !loading && lowStock.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {outOfStockCount > 0 ? `${outOfStockCount} item${outOfStockCount === 1 ? '' : 's'} are out of stock.` : 'Inventory items need attention.'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {criticalItems.slice(0, 3).map((item) => (
            <Box
              key={item.inventoryKey || item.variantId || item.id}
              onClick={() => navigate(`/admin/products/${item.id}/edit`)}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                p: 0.5, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>{item.name}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ overflowWrap: 'anywhere' }}>{item.variantId ? 'Variant' : 'Product'} · SKU: {item.sku || '—'}</Typography>
              </Box>
              <Chip label="Out" color="error" size="small" />
            </Box>
          ))}
          {warningItems.map((item) => (
            <Box
              key={item.inventoryKey || item.variantId || item.id}
              onClick={() => navigate(`/admin/products/${item.id}/edit`)}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                p: 0.5, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>{item.name}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ overflowWrap: 'anywhere' }}>{item.variantId ? 'Variant' : 'Product'} · SKU: {item.sku || '—'}</Typography>
              </Box>
              <Chip label={`${item.availableQty} available`} color="warning" size="small" />
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default InventoryWarningsWidget;
