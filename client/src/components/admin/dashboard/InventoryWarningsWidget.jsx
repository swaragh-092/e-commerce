import { Box, Chip, Paper, Typography } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { getPanelSx } from './dashboardUtils';

const InventoryWarningsWidget = ({ lowStock, loading, spacing }) => {
  const criticalItems = lowStock.filter((item) => item.availableQty <= 0);
  const warningItems = lowStock.filter((item) => item.availableQty > 0).slice(0, 4);

  return (
    <Paper elevation={0} sx={getPanelSx(spacing)}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Inventory2OutlinedIcon color={criticalItems.length ? 'error' : 'warning'} />
        <Typography variant="h6" fontWeight={600}>Inventory Warnings</Typography>
      </Box>

      {!loading && lowStock.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No inventory warnings right now.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {criticalItems.slice(0, 3).map((item) => (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" noWrap>{item.name}</Typography>
              <Chip label="Out" color="error" size="small" />
            </Box>
          ))}
          {warningItems.map((item) => (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" noWrap>{item.name}</Typography>
              <Chip label={`${item.availableQty} left`} color="warning" size="small" />
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default InventoryWarningsWidget;
