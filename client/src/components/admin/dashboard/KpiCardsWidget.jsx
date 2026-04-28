import { Grid } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import StatCard from '../StatCard';
import { checkBool } from './dashboardUtils';
import { PERMISSIONS } from '../../../utils/permissions';

const KpiCardsWidget = ({ stats, loading, settings, formatPrice, spacing, hasAnyPermission }) => {
  const showStatCards = checkBool(settings['dashboard.showStatCards']);
  const canViewOrders = typeof hasAnyPermission === 'function' ? hasAnyPermission([PERMISSIONS.ORDERS_READ]) : true;
  const canViewCustomers = typeof hasAnyPermission === 'function' ? hasAnyPermission([PERMISSIONS.CUSTOMERS_READ]) : true;
  const canViewProducts = typeof hasAnyPermission === 'function' ? hasAnyPermission([PERMISSIONS.PRODUCTS_READ]) : true;
  const cards = [
    showStatCards && canViewOrders && checkBool(settings['dashboard.showRevenueCard']) && {
      title: 'Total Revenue',
      value: formatPrice(stats?.totalRevenue),
      icon: <AttachMoneyIcon fontSize="inherit" />,
      color: 'success.main',
    },
    showStatCards && canViewOrders && checkBool(settings['dashboard.showOrdersCard']) && {
      title: 'Total Orders',
      value: stats?.orderCount ?? 0,
      icon: <ShoppingCartIcon fontSize="inherit" />,
      color: 'primary.main',
    },
    showStatCards && canViewCustomers && checkBool(settings['dashboard.showCustomersCard']) && {
      title: 'Customers',
      value: stats?.customerCount ?? 0,
      icon: <PeopleIcon fontSize="inherit" />,
      color: 'info.main',
    },
    showStatCards && canViewProducts && checkBool(settings['dashboard.showProductsCard']) && {
      title: 'Published Products',
      value: stats?.productCount ?? 0,
      icon: <InventoryIcon fontSize="inherit" />,
      color: 'warning.main',
    },
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <Grid container spacing={spacing.grid} mb={spacing.page}>
      {cards.map((card) => (
        <Grid item xs={12} sm={6} lg={3} key={card.title}>
          <StatCard {...card} loading={loading} />
        </Grid>
      ))}
    </Grid>
  );
};

export default KpiCardsWidget;
