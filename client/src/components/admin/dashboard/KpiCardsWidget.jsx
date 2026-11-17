import { useState } from 'react';
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, MenuItem, TextField, Typography } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import RateReviewIcon from '@mui/icons-material/RateReview';
import { useNavigate } from 'react-router-dom';
import StatCard from '../StatCard';
import { checkBool } from './dashboardUtils';
import { PERMISSIONS } from '../../../utils/permissions';
import { useCurrency } from '../../../hooks/useSettings';

const CurrencyIcon = () => {
  const { symbol } = useCurrency();
  return <Typography fontSize="inherit" fontWeight={700} component="span">{symbol}</Typography>;
};

const KpiCardsWidget = ({ stats, loading, settings, formatPrice, spacing, hasAnyPermission, features, mode }) => {
  const preferenceKey = `dashboard-cards:${mode}`;
  const [editing, setEditing] = useState(false);
  const [preferences, setPreferences] = useState(() => {
    try { return JSON.parse(localStorage.getItem(preferenceKey)) || {}; } catch { return {}; }
  });
  const update = (id, change) => {
    const next = { ...preferences, [id]: { ...preferences[id], ...change } };
    setPreferences(next);
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)); } catch { /* Storage unavailable. */ }
  };
  const navigate = useNavigate();
  const showStatCards = checkBool(settings['dashboard.showStatCards']);
  const isOrdersAllowed = mode !== 'catalog' && features?.orders !== false;
  const canViewOrders = isOrdersAllowed && (typeof hasAnyPermission === 'function' ? hasAnyPermission([PERMISSIONS.ORDERS_READ]) : true);
  const canViewCustomers = features?.customers === true && (typeof hasAnyPermission === 'function' ? hasAnyPermission([PERMISSIONS.CUSTOMERS_READ]) : true);
  const canViewProducts = typeof hasAnyPermission === 'function' ? hasAnyPermission([PERMISSIONS.PRODUCTS_READ]) : true;
  const canViewReviews = features?.reviews === true && (typeof hasAnyPermission === 'function' ? hasAnyPermission([PERMISSIONS.REVIEWS_READ]) : true);

  const cards = [
    showStatCards && canViewOrders && checkBool(settings['dashboard.showRevenueCard']) && {
      id: 'totalRevenue',
      title: 'Total Revenue',
      amount: stats?.totalRevenue,
      value: formatPrice(stats?.totalRevenue),
      icon: <CurrencyIcon />,
      color: 'success.main',
      // Revenue is an aggregate; go to all orders
      onClick: () => navigate('/admin/orders'),
    },
    showStatCards && canViewOrders && checkBool(settings['dashboard.showOrdersCard']) && {
      id: 'orderCount',
      title: 'Total Orders',
      amount: stats?.orderCount,
      value: stats?.orderCount ?? 0,
      icon: <ShoppingCartIcon fontSize="inherit" />,
      color: 'primary.main',
      onClick: () => navigate('/admin/orders'),
    },
    showStatCards && canViewCustomers && checkBool(settings['dashboard.showCustomersCard']) && {
      id: 'customerCount',
      title: 'Customers',
      amount: stats?.customerCount,
      value: stats?.customerCount ?? 0,
      icon: <PeopleIcon fontSize="inherit" />,
      color: 'info.main',
      onClick: () => navigate('/admin/customers'),
    },
    showStatCards && canViewProducts && checkBool(settings['dashboard.showProductsCard']) && {
      id: 'productCount',
      title: 'Published Products',
      amount: stats?.productCount,
      value: stats?.productCount ?? 0,
      icon: <InventoryIcon fontSize="inherit" />,
      color: 'warning.main',
      // Opens products page pre-filtered to published
      onClick: () => navigate('/admin/products?status=published'),
    },
    showStatCards && canViewReviews && {
      id: 'totalReviewsCount',
      title: 'Total Reviews',
      amount: stats?.totalReviewsCount,
      value: stats?.totalReviewsCount ?? 0,
      icon: <RateReviewIcon fontSize="inherit" />,
      color: 'secondary.main',
      onClick: () => navigate('/admin/reviews'),
    },
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <>
      <Button onClick={() => setEditing(true)} sx={{ mb: 1 }}>Customize metric cards</Button>
      <Dialog open={editing} onClose={() => setEditing(false)} fullWidth>
        <DialogTitle>Customize metric cards</DialogTitle>
        <DialogContent>
          {cards.map(({ id, title }) => (
            <Grid container key={id} spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <FormControlLabel label={title} control={<Checkbox checked={!preferences[id]?.hidden}
                  onChange={(e) => update(id, { hidden: !e.target.checked })} />} />
              </Grid>
              <Grid item xs={6}>
                <TextField select fullWidth label={`${title} width`} value={preferences[id]?.width || 3}
                  onChange={(e) => update(id, { width: Number(e.target.value) })}>
                  <MenuItem value={3}>Quarter</MenuItem>
                  <MenuItem value={6}>Half</MenuItem>
                  <MenuItem value={12}>Full</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth type="number" label={`${title} target`} value={preferences[id]?.target ?? ''}
                  inputProps={{ min: 0, step: 'any' }}
                  onChange={(e) => {
                    if (Number(e.target.value) >= 0) update(id, { target: e.target.value });
                  }} />
              </Grid>
            </Grid>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setEditing(false)}>Done</Button></DialogActions>
      </Dialog>
      <Grid container spacing={spacing.grid} mb={spacing.page}>
        {cards.filter(({ id }) => !preferences[id]?.hidden).map(({ id, amount, ...card }) => {
          const target = preferences[id]?.target;
          return <Grid item xs={12} sm={preferences[id]?.width === 12 ? 12 : 6} lg={preferences[id]?.width || 3} key={id}>
            <StatCard {...card} value={amount == null ? '—' : card.value} loading={loading} />
            {!loading && amount != null && target && (
              <Typography variant="caption" color="text.secondary">
                Target {id === 'totalRevenue' ? formatPrice(Number(target)) : Number(target).toLocaleString()}
                {' · '}{Number(amount) >= Number(target) ? 'Reached' : 'In progress'}
              </Typography>
            )}
          </Grid>;
        })}
      </Grid>
    </>
  );
};

export default KpiCardsWidget;
