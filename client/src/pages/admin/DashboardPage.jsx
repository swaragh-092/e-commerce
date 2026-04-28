import { useEffect, useState } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { getStats, getLowStock, getRecentOrders } from '../../services/adminService';
import { useSettings, useCurrency } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';
import { getEnabledDashboardWidgets, getOrderedDashboardWidgets } from '../../components/admin/dashboard/dashboardWidgets';
import { densitySpacing, sizeToGrid } from '../../components/admin/dashboard/dashboardUtils';

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

  const { settings } = useSettings();
  const { formatPrice } = useCurrency();
  const { hasAnyPermission } = useAuth();
  const adminSettings = settings?.admin || {};

  const defaultChartPeriod = adminSettings['dashboard.defaultChartPeriod'] || 'monthly';
  const dashboardLayout = adminSettings['dashboard.layout'] || 'balanced';
  const dashboardDensity = adminSettings['dashboard.density'] || 'comfortable';
  const spacing = densitySpacing[dashboardDensity] || densitySpacing.comfortable;
  const salesChartSize = dashboardLayout === 'analytics' ? 'full' : (adminSettings['dashboard.salesChartSize'] || 'large');
  const recentOrdersSize = dashboardLayout === 'compact' ? 'medium' : (adminSettings['dashboard.recentOrdersSize'] || 'medium');
  const lowStockSize = adminSettings['dashboard.lowStockSize'] || 'full';
  const operationsSummarySize = adminSettings['dashboard.operationsSummarySize'] || 'medium';
  const inventoryWarningsSize = adminSettings['dashboard.inventoryWarningsSize'] || 'medium';
  const storeHealthSize = adminSettings['dashboard.storeHealthSize'] || 'medium';
  const widgetProps = {
    stats,
    lowStock,
    recentOrders,
    loading,
    settings: adminSettings,
    allSettings: settings,
    formatPrice,
    spacing,
    defaultChartPeriod,
    hasAnyPermission,
  };
  const widgetSizes = {
    salesChart: salesChartSize,
    recentOrders: recentOrdersSize,
    lowStock: lowStockSize,
    operationsSummary: operationsSummarySize,
    inventoryWarnings: inventoryWarningsSize,
    storeHealth: storeHealthSize,
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={spacing.page}>Dashboard Overview</Typography>

      {getEnabledDashboardWidgets(adminSettings, 'top', hasAnyPermission).map(({ id, component: Widget }) => (
        <Widget key={id} {...widgetProps} />
      ))}

      <Grid container spacing={spacing.grid} mb={spacing.page}>
        {getOrderedDashboardWidgets(adminSettings, hasAnyPermission).map(({ id, component: Widget, defaultSize }) => (
          <Grid item {...(sizeToGrid[widgetSizes[id] || defaultSize] || sizeToGrid.medium)} key={id}>
            <Widget {...widgetProps} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default DashboardPage;
