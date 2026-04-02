import { useEffect, useState } from 'react';
import {
  Box, Grid, Typography, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Alert, Skeleton,
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningIcon from '@mui/icons-material/Warning';
import StatCard from '../../components/admin/StatCard';
import SalesChart from '../../components/admin/SalesChart';
import { getStats, getLowStock, getRecentOrders } from '../../services/adminService';

const statusColor = {
  pending_payment: 'warning', paid: 'info', processing: 'info',
  shipped: 'primary', delivered: 'success', cancelled: 'error', refunded: 'default',
};

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getLowStock(10), getRecentOrders()])
      .then(([s, ls, ro]) => {
        setStats(s.data.data);
        setLowStock(ls.data.data || []);
        setRecentOrders(ro.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Dashboard Overview</Typography>

      {/* Stat Cards */}
      <Grid container spacing={3} mb={4}>
        {[
          { title: 'Total Revenue', value: fmt(stats?.totalRevenue), icon: <AttachMoneyIcon fontSize="inherit" />, color: 'success.main' },
          { title: 'Total Orders', value: stats?.orderCount ?? 0, icon: <ShoppingCartIcon fontSize="inherit" />, color: 'primary.main' },
          { title: 'Customers', value: stats?.customerCount ?? 0, icon: <PeopleIcon fontSize="inherit" />, color: 'info.main' },
          { title: 'Published Products', value: stats?.productCount ?? 0, icon: <InventoryIcon fontSize="inherit" />, color: 'warning.main' },
        ].map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <StatCard {...card} loading={loading} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} mb={4}>
        {/* Sales Chart */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <SalesChart />
          </Paper>
        </Grid>

        {/* Recent Orders */}
        <Grid item xs={12} lg={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Typography variant="h6" fontWeight={600} mb={2}>Recent Orders</Typography>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={48} sx={{ mb: 1 }} />)
              : recentOrders.map((o) => (
                  <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{o.orderNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">{o.customer?.name || 'Guest'}</Typography>
                    </Box>
                    <Box textAlign="right">
                      <Chip label={o.status} size="small" color={statusColor[o.status] || 'default'} sx={{ mb: 0.25 }} />
                      <Typography variant="caption" display="block">${o.total.toFixed(2)}</Typography>
                    </Box>
                  </Box>
                ))
            }
          </Paper>
        </Grid>
      </Grid>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6" fontWeight={600}>Low Stock Alerts ({lowStock.length})</Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">Total Qty</TableCell>
                <TableCell align="right">Reserved</TableCell>
                <TableCell align="right">Available</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lowStock.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell align="right">{p.quantity}</TableCell>
                  <TableCell align="right">{p.reservedQty}</TableCell>
                  <TableCell align="right">
                    <Chip label={p.availableQty} size="small" color={p.availableQty <= 0 ? 'error' : 'warning'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {!loading && lowStock.length === 0 && (
        <Alert severity="success" sx={{ borderRadius: 2 }}>All products have adequate stock levels.</Alert>
      )}
    </Box>
  );
};

export default DashboardPage;
