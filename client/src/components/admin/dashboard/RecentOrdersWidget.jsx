import { Box, Chip, Paper, Skeleton, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getOrderStatusColor, getOrderStatusLabel } from '../../../utils/orderWorkflow';
import { getPanelSx } from './dashboardUtils';

const RecentOrdersWidget = ({ recentOrders, loading, formatPrice, spacing }) => {
  const navigate = useNavigate();

  return (
    <Paper elevation={0} sx={getPanelSx(spacing)}>
      <Typography variant="h6" fontWeight={600} mb={2}>Recent Orders</Typography>
      {loading
        ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={48} sx={{ mb: 1 }} />)
        : recentOrders.map((order) => (
            <Box
              key={order.id}
              onClick={() => navigate(`/admin/orders/${order.id}`)}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1.5,
                p: 1,
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={600}>{order.orderNumber}</Typography>
                <Typography variant="caption" color="text.secondary">{order.customer?.name || 'Guest'}</Typography>
              </Box>
              <Box textAlign="right">
                <Chip label={getOrderStatusLabel(order.status)} size="small" color={getOrderStatusColor(order.status)} sx={{ mb: 0.25 }} />
                <Typography variant="caption" display="block">{formatPrice(order.total)}</Typography>
              </Box>
            </Box>
          ))
      }
    </Paper>
  );
};

export default RecentOrdersWidget;
