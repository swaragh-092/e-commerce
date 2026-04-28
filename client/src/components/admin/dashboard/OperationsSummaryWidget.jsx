import { Grid, Paper, Typography } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import InventoryIcon from '@mui/icons-material/Inventory';
import PeopleIcon from '@mui/icons-material/People';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { getPanelSx } from './dashboardUtils';

const OperationsSummaryWidget = ({ stats, spacing }) => {
  const items = [
    { label: 'Pending Payment', value: stats?.pendingOrders ?? 0, icon: <ShoppingCartIcon />, color: 'warning.main' },
    { label: 'Low Stock', value: stats?.lowStockCount ?? 0, icon: <InventoryIcon />, color: 'error.main' },
    { label: 'Customers', value: stats?.customerCount ?? 0, icon: <PeopleIcon />, color: 'info.main' },
    { label: 'Published', value: stats?.productCount ?? 0, icon: <StorefrontIcon />, color: 'success.main' },
  ];

  return (
    <Paper elevation={0} sx={getPanelSx(spacing)}>
      <Typography variant="h6" fontWeight={600} mb={2}>Operations Summary</Typography>
      <Grid container spacing={1.5}>
        {items.map((item) => (
          <Grid item xs={6} key={item.label}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
              <Typography sx={{ color: item.color, lineHeight: 0 }}>{item.icon}</Typography>
              <Typography variant="h5" fontWeight={800} mt={1}>{item.value}</Typography>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

export default OperationsSummaryWidget;
