import { useEffect, useState } from 'react';
import { Alert, Box, Button, Grid, Typography } from '@mui/material';
import { getStats, getLowStock, getRecentOrders } from '../../services/adminService';
import { useSettings, useCurrency } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';
import { getEnabledDashboardWidgets, getOrderedDashboardWidgets } from '../../components/admin/dashboard/dashboardWidgets';
import { densitySpacing, sizeToGrid } from '../../components/admin/dashboard/dashboardUtils';
import { getApiErrorMessage } from '../../utils/apiErrors';

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sectionErrors, setSectionErrors] = useState({});

  const loadDashboard = () => {
    setLoading(true);
    setError('');
    setSectionErrors({});
    Promise.allSettled([getStats(), getLowStock(10), getRecentOrders()])
      .then(([s, ls, ro]) => {
        const errors = {};
        if (s.status === 'fulfilled') setStats(s.value.data.data);
        else errors.stats = getApiErrorMessage(s.reason, 'Failed to load stats.');

        if (ls.status === 'fulfilled') setLowStock(ls.value.data.data || []);
        else errors.lowStock = getApiErrorMessage(ls.reason, 'Failed to load low stock.');

        if (ro.status === 'fulfilled') setRecentOrders(ro.value.data.data || []);
        else errors.recentOrders = getApiErrorMessage(ro.reason, 'Failed to load recent orders.');

        if (Object.keys(errors).length === 3) {
          setError('Failed to load dashboard data.');
        }
        setSectionErrors(errors);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
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
    sectionErrors,
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

      {error && (
        <Alert
          severity="error"
          sx={{ mb: spacing.page }}
          action={(
            <Button color="inherit" size="small" onClick={loadDashboard}>
              Retry
            </Button>
          )}
        >
          {error}
        </Alert>
      )}

      {!error && Object.keys(sectionErrors).length > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: spacing.page }}
          action={(
            <Button color="inherit" size="small" onClick={loadDashboard}>
              Retry
            </Button>
          )}
        >
          Some sections failed to load: {Object.values(sectionErrors).join(' ')}
        </Alert>
      )}

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
